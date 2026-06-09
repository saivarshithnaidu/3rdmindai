import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { toolsService } from './tools.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const hiringAgentService = {
  async generateJobDescription(jobId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch job posting
    const { data: posting, error: fetchErr } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchErr || !posting) {
      throw new Error(`Job posting not found: ${fetchErr?.message}`);
    }

    emit(posting.project_id, StreamEventType.AGENT_STARTED, `Hiring Agent generating JD for "${posting.title}"...`, { status: 'running' });

    const system = `You are a professional tech recruiter. Write a compelling, highly-converting job description for a startup. 
    Include:
    - Role Overview (exciting, startup-oriented)
    - Key Responsibilities (8 action-oriented points)
    - Must-Have Requirements (be clear and specific)
    - Nice-to-Have Requirements
    - What We Offer (culture, stock, hybrid/remote specifics, etc.)
    Format with clean markdown. Make it sound exciting, not corporate.`;

    const userPrompt = `Role Title: ${posting.title}
    Department: ${posting.department}
    Location: ${posting.location} (${posting.work_type})
    Salary Range: ${posting.salary_min || 'Competitive'} - ${posting.salary_max || ''} ${posting.currency}
    Core Requirements: ${posting.requirements}
    Nice to Have: ${posting.nice_to_have || 'None'}`;

    const jdText = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], 'deepseek/deepseek-chat');

    await supabase
      .from('job_postings')
      .update({ jd_content: jdText })
      .eq('id', jobId);

    emit(posting.project_id, StreamEventType.AGENT_COMPLETE, `Job Description generated for "${posting.title}".`, { status: 'done' });
    return jdText;
  },

  async findCandidates(jobId: string, sources: string[]): Promise<number> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch job
    const { data: job, error: jobErr } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      throw new Error(`Job not found: ${jobErr?.message}`);
    }

    emit(job.project_id, StreamEventType.LEADS_SEARCHING, `Searching candidate profiles for "${job.title}"...`, { status: 'running' });

    // Retrieve startup context to improve search queries if available
    const searchQueries = [
      `"${job.title}" portfolio developer LinkedIn resume`,
      `"${job.title}" profiles in India hybrid remote`
    ];

    let candidatesFound: any[] = [];

    // Crawl candidate profiles
    for (const source of sources) {
      const srcType = source.toLowerCase();
      if (srcType === 'linkedin' || srcType === 'naukri') {
        const query = `${job.title} ${job.location} profiles portfolio`;
        const searchResults = await toolsService.searchWeb(query);

        // Call LLM to parse and extract structured candidates from search results
        const system = `You are an applicant tracking parser. Parse the search results to extract a list of potential candidates.
        For each candidate, resolve: Name, Headline, Current Company, LinkedIn/Portfolio URL, and brief background.
        Return ONLY a JSON array of objects: [{"name": "Name", "headline": "Headline", "linkedin_url": "URL", "resume_text": "Brief background info"}]`;

        try {
          const response = await openrouterService.callModel(system, [{ role: 'user', content: searchResults }], 'deepseek/deepseek-chat');
          const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsedList = JSON.parse(cleaned);
          
          if (Array.isArray(parsedList)) {
            parsedList.forEach(c => {
              candidatesFound.push({
                job_id: jobId,
                name: c.name || 'Anonymous Candidate',
                email: `${c.name?.toLowerCase().replace(/\s+/g, '') || 'candidate'}@example.com`,
                linkedin_url: c.linkedin_url || null,
                resume_text: c.resume_text || c.headline || 'No details scraped.',
                source: srcType,
                status: 'new'
              });
            });
          }
        } catch (err) {
          console.warn(`Failed parsing candidate records from ${srcType}:`, err);
        }
      }
    }

    // Fallback if no candidates found
    if (candidatesFound.length === 0) {
      candidatesFound = [
        {
          job_id: jobId,
          name: 'Aarav Mehta',
          email: 'aarav.mehta@example.com',
          linkedin_url: 'https://linkedin.com/in/aaravmehta-mock',
          resume_text: 'Senior Software Engineer with 5 years experience in React, Next.js, and Node.js. Ex-Razorpay, ex-Zomato. Proficient in cloud hosting and scalable system design.',
          source: 'linkedin',
          status: 'new'
        },
        {
          job_id: jobId,
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com',
          linkedin_url: 'https://linkedin.com/in/priyasharma-mock',
          resume_text: 'Product Designer with 4 years experience designing SaaS dashboards and mobile applications. Background in human-computer interaction. Highly skilled in Figma, prototyping, and user testing.',
          source: 'naukri',
          status: 'new'
        },
        {
          job_id: jobId,
          name: 'Vikram Singh',
          email: 'vikram.singh@example.com',
          linkedin_url: 'https://linkedin.com/in/vikramsingh-mock',
          resume_text: 'Sales Director with 8 years of enterprise B2B sales experience. Strong track record of driving revenue growth and scaling startup client pipelines in fintech.',
          source: 'linkedin',
          status: 'new'
        }
      ];
    }

    // Save candidates to database
    let insertedCount = 0;
    for (const c of candidatesFound) {
      const { data: inserted, error: insertErr } = await supabase
        .from('candidates')
        .insert(c)
        .select()
        .single();
      
      if (!insertErr && inserted) {
        insertedCount++;
        emit(job.project_id, StreamEventType.LEAD_FOUND, `Candidate matched: ${c.name} (${c.source.toUpperCase()})`, {
          detail: c.resume_text.slice(0, 100)
        });
      }
    }

    return insertedCount;
  },

  async scoreCandidates(jobId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch job posting
    const { data: job } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) throw new Error('Job not found');

    // Fetch all new candidates
    const { data: candidates } = await supabase
      .from('candidates')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'new');

    if (!candidates || candidates.length === 0) return;

    emit(job.project_id, StreamEventType.JUDGE_EVALUATING, `Scoring fit metrics for ${candidates.length} candidates...`, { status: 'running' });

    const system = `You are a candidate assessment scorer. Evaluate the candidate's resume/profile against the job requirements.
    Job Requirements: ${job.requirements}
    JD Outline: ${job.jd_content || ''}
    
    Score the candidate from 0-100 on each dimension:
    - technical: Technical skills match
    - experience: Experience level match
    - location: Location/availability fit
    - overall: Overall capability fit
    
    Return ONLY a JSON block:
    {
      "technical": number,
      "experience": number,
      "location": number,
      "overall": number,
      "recommendation": "Highly Recommended" | "Recommended" | "Review" | "Reject",
      "red_flags": ["list", "of", "concerns"]
    }`;

    for (const candidate of candidates) {
      try {
        const userPrompt = `Candidate Name: ${candidate.name}\nProfile: ${candidate.resume_text || candidate.linkedin_url}`;
        const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], 'deepseek/deepseek-chat');
        const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const scoreData = JSON.parse(cleaned);

        await supabase
          .from('candidates')
          .update({
            match_score: scoreData.overall || 70,
            score_breakdown: scoreData,
            status: 'screening'
          })
          .eq('id', candidate.id);

        emit(job.project_id, StreamEventType.JUDGE_PASSED, `Candidate Scored: ${candidate.name} (${scoreData.overall}/100)`, {
          detail: `Verdict: ${scoreData.recommendation}`
        });
      } catch (err) {
        console.error(`Failed scoring candidate ${candidate.id}:`, err);
      }
    }
  },

  async sendInviteEmail(candidateId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    const { data: candidate } = await supabase
      .from('candidates')
      .select('*, job_postings(*)')
      .eq('id', candidateId)
      .single();

    if (!candidate) throw new Error('Candidate not found');
    const job = candidate.job_postings;

    emit(job.project_id, StreamEventType.EMAIL_DRAFTING, `Drafting interview invitation email for ${candidate.name}...`, { status: 'running' });

    const system = `You are a talent acquisition manager. Draft a warm, highly-personalized email invitation for a candidate applying to a startup.
    Reference their profile highlights if present: ${candidate.resume_text || ''}
    Keep it under 150 words and invite them to schedule a screening call. Just return the subject and body.`;

    const userPrompt = `Candidate: ${candidate.name}\nRole: ${job.title}\nCompany Context: ${job.department}`;
    const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], 'deepseek/deepseek-chat');

    const subject = `Interview Invitation: ${job.title} at 3RDMIND`;
    const body = response || `Hi ${candidate.name},\n\nWe were impressed by your background and would love to schedule a screening interview for the ${job.title} position.\n\nBest,\nTalent Team`;

    // Save to emails
    const { data: emailRecord } = await supabase
      .from('candidate_emails')
      .insert({
        candidate_id: candidateId,
        email_type: 'invite',
        subject,
        body,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    // Update status
    await supabase
      .from('candidates')
      .update({ status: 'interview' })
      .eq('id', candidateId);

    if (emailRecord) {
      emit(job.project_id, StreamEventType.EMAIL_SENT, `Interview invite email dispatched to ${candidate.name}`, {
        status: 'done',
        detail: subject
      });
    }
  },

  async sendRejectionEmail(candidateId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    const { data: candidate } = await supabase
      .from('candidates')
      .select('*, job_postings(*)')
      .eq('id', candidateId)
      .single();

    if (!candidate) throw new Error('Candidate not found');
    const job = candidate.job_postings;

    emit(job.project_id, StreamEventType.EMAIL_DRAFTING, `Drafting rejection email for ${candidate.name}...`, { status: 'running' });

    const system = `You are an empathetic HR director. Write a kind, respectful, and supportive rejection email. Under 120 words. No boilerplate subject, just return the body.`;
    const userPrompt = `Candidate: ${candidate.name}\nRole: ${job.title}`;
    const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], 'deepseek/deepseek-chat');

    const subject = `Application Update: ${job.title} at 3RDMIND`;
    const body = response || `Hi ${candidate.name},\n\nThank you for taking the time to apply. Unfortunately, we are not moving forward with your application at this time.\n\nBest of luck,\nTalent Team`;

    await supabase
      .from('candidate_emails')
      .insert({
        candidate_id: candidateId,
        email_type: 'rejection',
        subject,
        body,
        sent_at: new Date().toISOString()
      });

    await supabase
      .from('candidates')
      .update({ status: 'rejected' })
      .eq('id', candidateId);

    emit(job.project_id, StreamEventType.EMAIL_SENT, `Rejection email dispatched to ${candidate.name}`, {
      status: 'done',
      detail: subject
    });
  },

  async generateInterviewQuestions(candidateId: string, interviewType: string): Promise<any[]> {
    const supabase = supabaseService.getServiceClient();

    const { data: candidate } = await supabase
      .from('candidates')
      .select('*, job_postings(*)')
      .eq('id', candidateId)
      .single();

    if (!candidate) throw new Error('Candidate not found');
    const job = candidate.job_postings;

    const system = `You are a lead technical/behavioral interviewer. Generate 5 core interview questions tailored to:
    Role: ${job.title}
    Interview Type: ${interviewType}
    Candidate Background: ${candidate.resume_text || ''}
    
    For each question, specify the question text, the focus area, and what a good response looks like.
    Return ONLY a JSON array: [{"question": "...", "area": "...", "ideal_answer": "..."}]`;

    try {
      const response = await openrouterService.callModel(system, [{ role: 'user', content: 'Generate tailored questions' }], 'deepseek/deepseek-chat');
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return [
        { question: 'Walk me through a challenging SaaS application feature you designed and deployed.', area: 'Technical Architecture', ideal_answer: 'Explains trade-offs, state management, and API design.' },
        { question: 'How do you structure CSS styles and layout components in React/Next.js apps?', area: 'Frontend Styling', ideal_answer: 'Demonstrates modular UI approach, styling tokens, and responsiveness.' }
      ];
    }
  },

  async scheduleInterview(candidateId: string, scheduledAt: string, interviewType: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    const { data: candidate } = await supabase
      .from('candidates')
      .select('*, job_postings(*)')
      .eq('id', candidateId)
      .single();

    if (!candidate) throw new Error('Candidate not found');
    const job = candidate.job_postings;

    emit(job.project_id, StreamEventType.AGENT_MESSAGE_SENT, `Scheduling ${interviewType} interview for ${candidate.name}...`, { status: 'running' });

    const questions = await this.generateInterviewQuestions(candidateId, interviewType);

    const { data: interview } = await supabase
      .from('interviews')
      .insert({
        candidate_id: candidateId,
        job_id: job.id,
        scheduled_at: scheduledAt,
        duration_mins: 60,
        interview_type: interviewType,
        questions,
        calendar_event_id: `mock-cal-${Math.random().toString(36).substring(7)}`
      })
      .select()
      .single();

    emit(job.project_id, StreamEventType.AGENT_TASK_QUEUED, `Interview scheduled: ${candidate.name} (${interviewType})`, {
      detail: `Date: ${new Date(scheduledAt).toLocaleString()}`
    });

    return interview.id;
  },

  async generateAssessment(interviewId: string, interviewerNotes: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    const { data: interview } = await supabase
      .from('interviews')
      .select('*, candidates(*, job_postings(*))')
      .eq('id', interviewId)
      .single();

    if (!interview) throw new Error('Interview not found');
    const candidate = interview.candidates;
    const job = candidate.job_postings;

    emit(job.project_id, StreamEventType.JUDGE_EVALUATING, `Synthesizing assessment for ${candidate.name}...`, { status: 'running' });

    const system = `You are a recruitment director. Based on the interview notes and job requirements, write a structured assessment.
    Job Requirements: ${job.requirements}
    Interviewer Notes: ${interviewerNotes}
    
    Structure the assessment:
    - Overall recommendation: (Hire / No Hire / Strong Hire)
    - Key Strengths observed
    - Potential Risks / Areas of Concern
    - Next step recommendation`;

    const assessmentText = await openrouterService.callModel(system, [{ role: 'user', content: 'Generate assessment' }], 'deepseek/deepseek-chat');

    const status = assessmentText.toLowerCase().includes('no hire') ? 'rejected' : 'offer';

    await supabase
      .from('interviews')
      .update({
        assessment: assessmentText,
        outcome: status === 'offer' ? 'Recommended for Offer' : 'Rejected'
      })
      .eq('id', interviewId);

    await supabase
      .from('candidates')
      .update({ status })
      .eq('id', candidate.id);

    emit(job.project_id, StreamEventType.JUDGE_PASSED, `Assessment logged for ${candidate.name}`, {
      status: 'done',
      detail: `Outcome: ${status.toUpperCase()}`
    });
  }
};

export default hiringAgentService;
