import nodemailer from 'nodemailer';
import { config } from './config.js';
import { EmailTemplate } from './types.js';

export interface EmailSendResult {
  success: boolean;
  notConfigured?: boolean;
  recipients: string[];
  subject: string;
  messageId?: string;
  response?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (config.smtp.isConfigured) {
      try {
        this.transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: {
            user: config.smtp.user.trim(),
            pass: config.smtp.pass.replace(/\s+/g, ''),
          },
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 10000, // 10s
        });
      } catch (err) {
        console.error('[EmailService] Failed to create SMTP transporter:', err);
        this.transporter = null;
      }
    } else {
      this.transporter = null;
    }
  }

  isConfigured(): boolean {
    return Boolean(config.smtp.isConfigured && this.transporter);
  }

  getSmtpStatus(): {
    configured: boolean;
    host: string;
    port: number;
    user: string;
    from: string;
  } {
    return {
      configured: this.isConfigured(),
      host: config.smtp.host || 'Not configured',
      port: config.smtp.port,
      user: config.smtp.user ? `${config.smtp.user.substring(0, 3)}***` : 'None',
      from: config.smtp.from,
    };
  }

  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured() || !this.transporter) {
      return {
        ok: false,
        message: 'SMTP credentials are not configured in .env. Real email delivery is disabled.',
      };
    }
    try {
      await this.transporter.verify();
      return { ok: true, message: 'SMTP connection verified successfully.' };
    } catch (err: any) {
      return {
        ok: false,
        message: `SMTP verification failed: ${err.message || 'Unknown network/authentication error'}`,
      };
    }
  }

  // Compile template variables with actual values
  compileTemplate(
    template: EmailTemplate,
    variables: {
      parent_name: string;
      child_name: string;
      caller_number: string;
      child_phone: string;
      event_time: string;
      spam_classification: string;
    }
  ): { subject: string; html: string; text: string } {
    let subject = template.subject;
    let html = template.body_html;
    let text = template.body_text;

    const replacements: Record<string, string> = {
      '{{parent_name}}': variables.parent_name || 'Guardian',
      '{{child_name}}': variables.child_name || 'Child',
      '{{caller_number}}': variables.caller_number || 'Unknown Caller',
      '{{child_phone}}': variables.child_phone || 'Protected Line',
      '{{event_time}}': variables.event_time || new Date().toLocaleString(),
      '{{spam_classification}}': variables.spam_classification || 'High Risk Spam',
    };

    for (const [key, val] of Object.entries(replacements)) {
      // Escape for regex
      const reg = new RegExp(key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'), 'g');
      subject = subject.replace(reg, val);
      html = html.replace(reg, val);
      text = text.replace(reg, val);
    }

    return { subject, html, text };
  }

  // Send real email alert to authorized parents
  async sendAlertEmail(
    recipients: string[],
    template: EmailTemplate,
    variables: {
      parent_name: string;
      child_name: string;
      caller_number: string;
      child_phone: string;
      event_time: string;
      spam_classification: string;
    }
  ): Promise<EmailSendResult> {
    const validRecipients = recipients.filter(
      (r) => r && r.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.trim())
    );

    if (validRecipients.length === 0) {
      return {
        success: false,
        recipients: [],
        subject: template.subject,
        error: 'No valid recipient email addresses found for linked guardians.',
      };
    }

    const { subject, html, text } = this.compileTemplate(template, variables);

    if (!this.isConfigured() || !this.transporter) {
      return {
        success: false,
        notConfigured: true,
        recipients: validRecipients,
        subject,
        error: 'SMTP not configured in environment. Email submission was not attempted.',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.smtp.from,
        to: validRecipients.join(', '),
        subject,
        text,
        html,
      });

      return {
        success: true,
        recipients: validRecipients,
        subject,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (err: any) {
      console.error('[EmailService] SMTP Send Error:', err);
      return {
        success: false,
        recipients: validRecipients,
        subject,
        error: `SMTP submission failed: ${err.message || 'Unknown error'}`,
      };
    }
  }

  // Send a test email from the Email Customization Studio
  async sendTestEmail(
    targetEmail: string,
    template: EmailTemplate
  ): Promise<EmailSendResult> {
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail.trim())) {
      return {
        success: false,
        recipients: [targetEmail],
        subject: template.subject,
        error: 'Please provide a valid test recipient email address.',
      };
    }

    const testVariables = {
      parent_name: 'Sarah Miller (Test)',
      child_name: 'Leo Miller',
      caller_number: '+1-800-555-0191',
      child_phone: '+1-555-0101',
      event_time: new Date().toLocaleString(),
      spam_classification: 'IRS Impersonator (Robocall)',
    };

    return this.sendAlertEmail([targetEmail.trim()], template, testVariables);
  }
}

export const emailService = new EmailService();
