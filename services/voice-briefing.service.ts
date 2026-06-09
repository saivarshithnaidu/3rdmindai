import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.mailtrap.io';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('SMTP credentials (SMTP_USER/SMTP_PASS) not configured. Using simulated SMTP transporter.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn('Twilio credentials (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN) not configured. Using simulated Twilio client.');
    return null;
  }

  return twilio(accountSid, authToken);
};

const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  josh: 'TxGEqnHWrfWFTfGW9XjX',
  elli: 'MF3mGyEYCl7XYWbV9V6O',
  adam: 'pNInz6obpgDQGcFmaJgB',
  domi: 'AZnzlk1XvdvUeBnXmlld',
  dave: 'CYw3kZ02Hs0563khs1Fj',
};

export const voiceBriefingService = {
  async generateBriefingScript(
    projectId: string,
    userId: string,
    briefingDate: string
  ): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    emit(projectId, StreamEventType.AGENT_STARTED, 'Voice Briefing Agent compiling your morning brief...', { status: 'running' });

    // Fetch project context
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    const companyName = project?.name || 'Your Startup';

    // Fetch briefing config for section preferences
    const { data: config } = await supabase
      .from('briefing_configs')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    const enabledSections: string[] = config?.sections && Array.isArray(config.sections) && config.sections.length > 0
      ? config.sections
      : ['team_activity', 'market_news', 'reputation', 'price_alerts', 'calendar', 'priorities', 'funding_deadlines'];

    // --- Gather data for each section ---
    const sectionData: Record<string, string> = {};

    // 1. Team Activity: fetch agent_tasks completed yesterday
    if (enabledSections.includes('team_activity')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStart = yesterday.toISOString().split('T')[0] + 'T00:00:00Z';
      const yesterdayEnd = yesterday.toISOString().split('T')[0] + 'T23:59:59Z';

      const { data: tasks } = await supabase
        .from('agent_tasks')
        .select('title, status, output')
        .eq('project_id', projectId)
        .gte('completed_at', yesterdayStart)
        .lte('completed_at', yesterdayEnd)
        .eq('status', 'done')
        .limit(10);

      if (tasks && tasks.length > 0) {
        sectionData.team_activity = `Team completed ${tasks.length} tasks yesterday: ${tasks.map((t: any) => t.title).join(', ')}.`;
      } else {
        sectionData.team_activity = 'No agent tasks were completed yesterday.';
      }
    }

    // 2. Market Intelligence: search web for industry news
    if (enabledSections.includes('market_news')) {
      try {
        const newsPrompt = `List 2-3 brief bullet points about the latest industry news relevant to a startup called "${companyName}". Keep it factual and concise.`;
        const newsResponse = await openrouterService.callModel(
          'You are a business news analyst. Provide brief, factual news summaries.',
          [{ role: 'user', content: newsPrompt }],
          'deepseek/deepseek-chat'
        );
        sectionData.market_news = newsResponse.slice(0, 500);
      } catch (err) {
        sectionData.market_news = 'Market intelligence could not be fetched today.';
      }
    }

    // 3. Reputation: new mentions if monitor active
    if (enabledSections.includes('reputation')) {
      const { data: mentions } = await supabase
        .from('reputation_mentions')
        .select('source, sentiment, snippet')
        .eq('project_id', projectId)
        .gte('found_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      if (mentions && mentions.length > 0) {
        sectionData.reputation = `${mentions.length} new mention(s) found: ${mentions.map((m: any) => `${m.source} (${m.sentiment})`).join(', ')}.`;
      } else {
        sectionData.reputation = 'No new brand mentions in the last 24 hours.';
      }
    }

    // 4. Price Watch: targets hit overnight
    if (enabledSections.includes('price_alerts')) {
      const { data: alerts } = await supabase
        .from('price_watches')
        .select('product_name, current_price, target_price, status')
        .eq('project_id', projectId)
        .eq('status', 'triggered')
        .limit(5);

      if (alerts && alerts.length > 0) {
        sectionData.price_alerts = `${alerts.length} price target(s) hit: ${alerts.map((a: any) => `${a.product_name} at ₹${a.current_price}`).join(', ')}.`;
      } else {
        sectionData.price_alerts = 'No price alerts triggered overnight.';
      }
    }

    // 5. Calendar: today's meetings (placeholder — no calendar table yet)
    if (enabledSections.includes('calendar')) {
      sectionData.calendar = 'Calendar integration pending. No meetings data available today.';
    }

    // 6. Priorities: CEO agent weekly priorities
    if (enabledSections.includes('priorities')) {
      const { data: ceoAgent } = await supabase
        .from('startup_agents')
        .select('id')
        .eq('project_id', projectId)
        .eq('role', 'ceo')
        .maybeSingle();

      if (ceoAgent) {
        const { data: priorities } = await supabase
          .from('agent_tasks')
          .select('title, output')
          .eq('agent_id', ceoAgent.id)
          .eq('status', 'done')
          .order('completed_at', { ascending: false })
          .limit(3);

        if (priorities && priorities.length > 0) {
          sectionData.priorities = `CEO priorities: ${priorities.map((p: any) => p.title).join(', ')}.`;
        } else {
          sectionData.priorities = 'No CEO priorities set this week.';
        }
      } else {
        sectionData.priorities = 'CEO agent not active for this project.';
      }
    }

    // 7. Funding Alerts: deadlines approaching
    if (enabledSections.includes('funding_deadlines')) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data: grants } = await supabase
        .from('funding_opportunities')
        .select('name, deadline, amount')
        .eq('project_id', projectId)
        .lte('deadline', nextWeek.toISOString())
        .gte('deadline', new Date().toISOString())
        .limit(5);

      if (grants && grants.length > 0) {
        sectionData.funding_deadlines = `${grants.length} funding deadline(s) this week: ${grants.map((g: any) => `${g.name} (${g.deadline})`).join(', ')}.`;
      } else {
        sectionData.funding_deadlines = 'No funding deadlines approaching this week.';
      }
    }

    emit(projectId, StreamEventType.AGENT_THINKING, 'Compiling briefing data into natural spoken script...', { status: 'running' });

    // --- Build the briefing script via LLM ---
    const dataContext = Object.entries(sectionData)
      .map(([key, value]) => `### ${key.replace(/_/g, ' ').toUpperCase()}\n${value}`)
      .join('\n\n');

    const system = `You are a professional morning briefing voice narrator for a startup founder.
Write a natural, spoken-word morning briefing script. The founder runs "${companyName}".

Rules:
- Write exactly 350-450 words, suitable for a 2-3 minute spoken audio briefing.
- Use a warm, professional, conversational tone — like a trusted chief of staff.
- Start with a greeting and the date.
- Cover each section naturally with smooth transitions. Skip sections with no meaningful data.
- End with a motivating one-liner for the day.
- Do NOT use markdown, bullet points, or formatting. Write it as flowing spoken paragraphs.
- Do NOT include any stage directions, speaker labels, or brackets.`;

    const model = 'deepseek/deepseek-chat';

    try {
      const script = await openrouterService.callModel(
        system,
        [{ role: 'user', content: `Here is today's data for the briefing on ${briefingDate}:\n\n${dataContext}` }],
        model
      );

      // Save to voice_briefings
      const { data: briefing, error: insErr } = await supabase
        .from('voice_briefings')
        .insert({
          project_id: projectId,
          user_id: userId,
          briefing_date: briefingDate,
          script,
          status: 'generating',
        })
        .select()
        .single();

      if (insErr) throw insErr;

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Briefing script generated for ${briefingDate} (${script.split(/\s+/).length} words)`, { status: 'done' });
      return briefing;

    } catch (err: any) {
      console.error('Failed to generate briefing script:', err);
      emit(projectId, StreamEventType.STREAM_ERROR, `Failed to generate briefing script: ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  async generateAudio(briefingId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // Fetch briefing and config
    const { data: briefing, error: fetchErr } = await supabase
      .from('voice_briefings')
      .select('*')
      .eq('id', briefingId)
      .single();

    if (fetchErr || !briefing) {
      throw new Error(`Briefing not found: ${fetchErr?.message}`);
    }

    const projectId = briefing.project_id;
    emit(projectId, StreamEventType.AGENT_STARTED, 'Generating voice audio via ElevenLabs...', { status: 'running' });

    // Get voice config
    const { data: config } = await supabase
      .from('briefing_configs')
      .select('voice_id')
      .eq('project_id', projectId)
      .eq('user_id', briefing.user_id)
      .maybeSingle();

    const voiceName = config?.voice_id || 'rachel';
    const elevenLabsVoiceId = ELEVENLABS_VOICE_MAP[voiceName] || ELEVENLABS_VOICE_MAP['rachel'];

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('ELEVENLABS_API_KEY not configured. Skipping audio generation.');
      await supabase
        .from('voice_briefings')
        .update({ status: 'ready' })
        .eq('id', briefingId);

      emit(projectId, StreamEventType.AGENT_COMPLETE, 'Audio generation skipped — ElevenLabs API key not configured. Script is ready.', { status: 'done' });
      return briefing;
    }

    try {
      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: briefing.script,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!ttsResponse.ok) {
        const errText = await ttsResponse.text();
        throw new Error(`ElevenLabs API error: ${ttsResponse.status} ${ttsResponse.statusText} - ${errText}`);
      }

      const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

      // Estimate duration: ~150 words per minute for TTS
      const wordCount = briefing.script.split(/\s+/).length;
      const estimatedDuration = Math.round((wordCount / 150) * 60);

      // Upload MP3 to Supabase Storage bucket 'briefings'
      const fileName = `${briefing.project_id}/${briefingId}.mp3`;
      const { error: uploadErr } = await supabase.storage
        .from('briefings')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Storage upload failed: ${uploadErr.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('briefings')
        .getPublicUrl(fileName);

      const audioUrl = publicUrlData.publicUrl;

      // Update briefing record
      const { data: updated, error: updateErr } = await supabase
        .from('voice_briefings')
        .update({
          audio_url: audioUrl,
          duration_secs: estimatedDuration,
          status: 'ready',
        })
        .eq('id', briefingId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Voice audio generated (${estimatedDuration}s). Ready for delivery.`, { status: 'done' });
      return updated;

    } catch (err: any) {
      console.error('Failed to generate audio:', err);
      await supabase
        .from('voice_briefings')
        .update({ status: 'failed' })
        .eq('id', briefingId);

      emit(projectId, StreamEventType.STREAM_ERROR, `Failed to generate voice audio: ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  async sendViaWhatsApp(briefingId: string): Promise<{ success: boolean; message: string }> {
    const supabase = supabaseService.getServiceClient();

    const { data: briefing, error: fetchErr } = await supabase
      .from('voice_briefings')
      .select('*')
      .eq('id', briefingId)
      .single();

    if (fetchErr || !briefing) {
      return { success: false, message: `Briefing not found: ${fetchErr?.message}` };
    }

    const projectId = briefing.project_id;

    const { data: config } = await supabase
      .from('briefing_configs')
      .select('whatsapp_number')
      .eq('project_id', projectId)
      .eq('user_id', briefing.user_id)
      .maybeSingle();

    const phone = config?.whatsapp_number;
    if (!phone) {
      return { success: false, message: 'No WhatsApp number configured in briefing config.' };
    }

    emit(projectId, StreamEventType.AGENT_STARTED, `Sending morning briefing via WhatsApp to ${phone}...`, { status: 'running' });

    const client = getTwilioClient();
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    // Format phone number
    let formattedTo = phone.trim();
    if (!formattedTo.startsWith('whatsapp:')) {
      if (!formattedTo.startsWith('+')) {
        if (formattedTo.length === 10) {
          formattedTo = '+91' + formattedTo;
        } else {
          formattedTo = '+' + formattedTo;
        }
      }
      formattedTo = `whatsapp:${formattedTo}`;
    }

    const scriptPreview = briefing.script.slice(0, 300) + (briefing.script.length > 300 ? '...' : '');
    const textMessage = `🎙️ *3RDMIND Morning Briefing — ${briefing.briefing_date}*\n\n${scriptPreview}`;

    if (client) {
      try {
        // Send text message
        await client.messages.create({
          from: fromWhatsApp,
          to: formattedTo,
          body: textMessage,
        });

        // Send audio media message if available
        if (briefing.audio_url) {
          await client.messages.create({
            from: fromWhatsApp,
            to: formattedTo,
            body: '🔊 Listen to your full audio briefing:',
            mediaUrl: [briefing.audio_url],
          });
        }

        await supabase
          .from('voice_briefings')
          .update({ whatsapp_sent: true, status: 'sent' })
          .eq('id', briefingId);

        emit(projectId, StreamEventType.AGENT_COMPLETE, `WhatsApp briefing sent to ${phone}`, { status: 'done' });
        return { success: true, message: 'WhatsApp briefing dispatched successfully via Twilio.' };

      } catch (err: any) {
        console.error('Twilio WhatsApp sending error:', err);
        emit(projectId, StreamEventType.STREAM_ERROR, `WhatsApp delivery failed: ${err.message}`, { status: 'error' });
        return { success: false, message: `Twilio sending failed: ${err.message}` };
      }
    } else {
      // Simulate
      console.log(`[SIMULATED WHATSAPP BRIEFING] To: ${phone}\nMessage: ${textMessage}`);
      await supabase
        .from('voice_briefings')
        .update({ whatsapp_sent: true, status: 'sent' })
        .eq('id', briefingId);

      emit(projectId, StreamEventType.AGENT_COMPLETE, `WhatsApp briefing sent to ${phone} (simulated)`, { status: 'done' });
      return { success: true, message: 'WhatsApp briefing simulated successfully.' };
    }
  },

  async sendViaEmail(briefingId: string): Promise<{ success: boolean; message: string }> {
    const supabase = supabaseService.getServiceClient();

    const { data: briefing, error: fetchErr } = await supabase
      .from('voice_briefings')
      .select('*')
      .eq('id', briefingId)
      .single();

    if (fetchErr || !briefing) {
      return { success: false, message: `Briefing not found: ${fetchErr?.message}` };
    }

    const projectId = briefing.project_id;

    const { data: config } = await supabase
      .from('briefing_configs')
      .select('email')
      .eq('project_id', projectId)
      .eq('user_id', briefing.user_id)
      .maybeSingle();

    const emailTo = config?.email;
    if (!emailTo) {
      return { success: false, message: 'No email address configured in briefing config.' };
    }

    emit(projectId, StreamEventType.AGENT_STARTED, `Sending morning briefing via email to ${emailTo}...`, { status: 'running' });

    const emailSubject = `🎙️ 3RDMIND Morning Briefing — ${briefing.briefing_date}`;

    const audioPlayerHtml = briefing.audio_url
      ? `<div style="margin: 24px 0; text-align: center;">
           <audio controls preload="metadata" style="width: 100%; max-width: 500px; border-radius: 8px;">
             <source src="${briefing.audio_url}" type="audio/mpeg">
             Your email client does not support the audio element. <a href="${briefing.audio_url}">Listen here</a>.
           </audio>
         </div>`
      : '';

    const scriptParagraphs = briefing.script
      .split('\n')
      .filter((p: string) => p.trim())
      .map((p: string) => `<p style="margin: 0 0 14px 0; line-height: 1.7; color: #3d3d3d;">${p}</p>`)
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Morning Briefing</title>
      </head>
      <body style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF8F5; color: #1a1a1a; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E0DA; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <div style="background: linear-gradient(135deg, #cc785c, #a9583e); padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.5px;">🎙️ Morning Briefing</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">${briefing.briefing_date}</p>
          </div>
          <div style="padding: 30px;">
            ${audioPlayerHtml}
            <div style="border-top: 1px solid #E5E0DA; padding-top: 20px; margin-top: 10px;">
              <h3 style="font-family: 'Lora', Georgia, serif; font-size: 16px; font-weight: 600; color: #1a1a1a; margin: 0 0 16px 0;">Full Transcript</h3>
              <div style="font-size: 14px;">
                ${scriptParagraphs}
              </div>
            </div>
          </div>
          <div style="background: #FAF8F5; padding: 20px; text-align: center; font-size: 11px; color: #94908a; border-top: 1px solid #E5E0DA;">
            Sent by 3RDMIND Voice Briefing Agent. Manage your briefing preferences in your dashboard.
          </div>
        </div>
      </body>
      </html>
    `;

    const transporter = getTransporter();

    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"3RDMIND Briefing" <briefing@3rdmind.ai>',
          to: emailTo,
          subject: emailSubject,
          html: htmlContent,
        });

        await supabase
          .from('voice_briefings')
          .update({ email_sent: true, status: 'sent' })
          .eq('id', briefingId);

        emit(projectId, StreamEventType.AGENT_COMPLETE, `Email briefing sent to ${emailTo}`, { status: 'done' });
        return { success: true, message: 'Email briefing dispatched successfully via SMTP.' };

      } catch (err: any) {
        console.error('SMTP sending error:', err);
        emit(projectId, StreamEventType.STREAM_ERROR, `Email delivery failed: ${err.message}`, { status: 'error' });
        return { success: false, message: `SMTP sending failed: ${err.message}` };
      }
    } else {
      // Simulate
      console.log(`[SIMULATED EMAIL BRIEFING] To: ${emailTo}\nSubject: ${emailSubject}`);
      await supabase
        .from('voice_briefings')
        .update({ email_sent: true, status: 'sent' })
        .eq('id', briefingId);

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Email briefing sent to ${emailTo} (simulated)`, { status: 'done' });
      return { success: true, message: 'Email briefing simulated successfully.' };
    }
  },

  async runMorningBriefing(projectId: string, userId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    const today = new Date().toISOString().split('T')[0];

    emit(projectId, StreamEventType.AGENT_STARTED, 'Morning Briefing Agent activated — generating your daily brief...', { status: 'running' });

    try {
      // Step 1: Generate briefing script
      const briefing = await this.generateBriefingScript(projectId, userId, today);

      // Step 2: Generate audio
      await this.generateAudio(briefing.id);

      // Step 3: Send via WhatsApp if configured
      const { data: config } = await supabase
        .from('briefing_configs')
        .select('whatsapp_number, email')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();

      if (config?.whatsapp_number) {
        await this.sendViaWhatsApp(briefing.id);
      }

      // Step 4: Send via email if configured
      if (config?.email) {
        await this.sendViaEmail(briefing.id);
      }

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Morning briefing pipeline complete for ${today}`, { status: 'done' });
      return briefing;

    } catch (err: any) {
      console.error('Morning briefing pipeline failed:', err);
      emit(projectId, StreamEventType.STREAM_ERROR, `Morning briefing failed: ${err.message}`, { status: 'error' });
      throw err;
    }
  },
};

export default voiceBriefingService;
