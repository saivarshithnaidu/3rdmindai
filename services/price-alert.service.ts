import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { PriceWatch } from '../types';
import supabaseService from './supabase.service';

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
    auth: {
      user,
      pass,
    },
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

export const priceAlertService = {
  async sendEmailAlert(watch: PriceWatch, currentPrice: number): Promise<{ success: boolean; message: string }> {
    const emailTo = watch.alert_email;
    if (!emailTo) {
      return { success: false, message: 'No email address configured for this price watch.' };
    }

    const discount = watch.original_price && watch.original_price > 0
      ? Math.round(((watch.original_price - currentPrice) / watch.original_price) * 100)
      : 0;

    const emailSubject = `🚨 Price Drop Alert: ${watch.product_name} hit ₹${currentPrice}!`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Price Drop Alert</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0d0e12;
            color: #e2e8f0;
            margin: 0;
            padding: 20px;
          }
          .card {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(22, 28, 45, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .content {
            padding: 30px;
          }
          .product-title {
            font-size: 20px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 20px;
            color: #ffffff;
            line-height: 1.4;
          }
          .image-container {
            text-align: center;
            margin-bottom: 25px;
          }
          .product-image {
            max-width: 200px;
            max-height: 200px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
            text-align: center;
          }
          .metric-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 15px 10px;
          }
          .metric-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #94a3b8;
            margin-bottom: 5px;
          }
          .metric-value {
            font-size: 18px;
            font-weight: 700;
          }
          .metric-value.highlight {
            color: #10b981;
            font-size: 20px;
          }
          .metric-value.discount {
            color: #f43f5e;
          }
          .btn-container {
            text-align: center;
            margin-bottom: 20px;
          }
          .btn {
            display: inline-block;
            background: #f59e0b;
            color: #000000;
            text-decoration: none;
            padding: 14px 30px;
            font-weight: 700;
            border-radius: 30px;
            transition: all 0.2s ease;
          }
          .footer {
            background: rgba(0, 0, 0, 0.2);
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Target Price Hit!</h1>
          </div>
          <div class="content">
            <h2 class="product-title">${watch.product_name}</h2>
            ${watch.image_url ? `
            <div class="image-container">
              <img src="${watch.image_url}" alt="${watch.product_name}" class="product-image" />
            </div>
            ` : ''}
            <div class="metrics">
              <div class="metric-card">
                <div class="metric-label">Current Price</div>
                <div class="metric-value highlight">₹${currentPrice}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Target Price</div>
                <div class="metric-value">₹${watch.target_price}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Discount</div>
                <div class="metric-value discount">-${discount}%</div>
              </div>
            </div>
            <div class="btn-container">
              <a href="${watch.product_url}" target="_blank" class="btn">Buy Now on ${watch.platform.toUpperCase()}</a>
            </div>
          </div>
          <div class="footer">
            Sent by 3RDMIND Price Watch Agent. You are receiving this because you set a price alert for this product.
          </div>
        </div>
      </body>
      </html>
    `;

    const transporter = getTransporter();
    const messageRecord = `Email sent to ${emailTo}: ${emailSubject}`;

    if (transporter) {
      try {
        const mailOptions = {
          from: process.env.SMTP_FROM || '"3RDMIND Price Watch" <no-reply@3rdmind.ai>',
          to: emailTo,
          subject: emailSubject,
          html: htmlContent,
        };
        await transporter.sendMail(mailOptions);
        await this.logAlertSent(watch.id, 'email', messageRecord, true);
        return { success: true, message: 'Email alert dispatched successfully via SMTP.' };
      } catch (err: any) {
        console.error('SMTP sending error:', err);
        await this.logAlertSent(watch.id, 'email', `ERROR sending to ${emailTo}: ${err.message}`, false);
        return { success: false, message: `SMTP sending failed: ${err.message}` };
      }
    } else {
      // Simulate
      console.log(`[SIMULATED EMAIL ALERT] To: ${emailTo}\nSubject: ${emailSubject}\nBody: See HTML content.`);
      await this.logAlertSent(watch.id, 'email', `[SIMULATED] ${messageRecord}`, true);
      return { success: true, message: 'Email alert simulated successfully.' };
    }
  },

  async sendWhatsAppAlert(watch: PriceWatch, currentPrice: number): Promise<{ success: boolean; message: string }> {
    const phone = watch.alert_whatsapp;
    if (!phone) {
      return { success: false, message: 'No WhatsApp number configured for this price watch.' };
    }

    const discount = watch.original_price && watch.original_price > 0
      ? Math.round(((watch.original_price - currentPrice) / watch.original_price) * 100)
      : 0;

    const messageText = `🚨 *3RDMIND Price Drop Alert* 🚨\n\nYour tracked product *${watch.product_name}* has dropped to *₹${currentPrice}* (Target: ₹${watch.target_price}) on ${watch.platform.toUpperCase()}! 🔥 Save *${discount}%* off the original price.\n\n👉 *Buy Now:* ${watch.product_url}`;

    const client = getTwilioClient();
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

    if (client) {
      try {
        // Format to whatsapp:+[number] if it doesn't already have it
        let formattedTo = phone.trim();
        if (!formattedTo.startsWith('whatsapp:')) {
          if (!formattedTo.startsWith('+')) {
            // Assume Indian number if no code is provided and it's 10 digits
            if (formattedTo.length === 10) {
              formattedTo = '+91' + formattedTo;
            } else {
              formattedTo = '+' + formattedTo;
            }
          }
          formattedTo = `whatsapp:${formattedTo}`;
        }

        await client.messages.create({
          from: fromWhatsApp,
          to: formattedTo,
          body: messageText,
        });

        await this.logAlertSent(watch.id, 'whatsapp', messageText, true);
        return { success: true, message: 'WhatsApp alert dispatched successfully via Twilio.' };
      } catch (err: any) {
        console.error('Twilio sending error:', err);
        await this.logAlertSent(watch.id, 'whatsapp', `ERROR sending to ${phone}: ${err.message}`, false);
        return { success: false, message: `Twilio sending failed: ${err.message}` };
      }
    } else {
      // Simulate
      console.log(`[SIMULATED WHATSAPP ALERT] To: ${phone}\nMessage: ${messageText}`);
      await this.logAlertSent(watch.id, 'whatsapp', `[SIMULATED] ${messageText}`, true);
      return { success: true, message: 'WhatsApp alert simulated successfully.' };
    }
  },

  async logAlertSent(watchId: string, channel: 'email' | 'whatsapp', message: string, delivered: boolean): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    await supabase.from('price_alerts_sent').insert({
      watch_id: watchId,
      channel,
      message,
      delivered,
      sent_at: new Date().toISOString()
    });
  }
};

export default priceAlertService;
