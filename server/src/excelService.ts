import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import {
  Subscriber,
  ParentChildMapping,
  SpamNumber,
  CallLog,
  EmailTemplate,
  EmailDeliveryStatus,
  SmsDeliveryStatus,
  CallStatus,
} from './types.js';

// Mutex / Queue to avoid concurrent Excel file read/write corruption
class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

const fileLock = new AsyncLock();

// Default email template
export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  template_id: 'TMPL-001',
  template_name: 'Default Child Spam Alert',
  subject: '🚨 CHILD SAFETY ALERT: Suspected Spam Call to {{child_name}}',
  body_html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; padding: 24px 28px; text-align: left;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
      <span style="background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px;">PRIORITY SAFETY ALERT</span>
    </div>
    <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">SafeFamily Telecom Shield</h1>
    <p style="margin: 6px 0 0 0; font-size: 13px; color: #93c5fd;">Real-Time Child Call Protection Network</p>
  </div>

  <div style="padding: 28px;">
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hello <strong>{{parent_name}}</strong>,</p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Our telecom firewall just intercepted a <strong>{{spam_classification}}</strong> incoming call targeting your child's line. We are notifying you immediately as an authorized guardian.
    </p>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 40%;"><strong>Target Child:</strong></td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">{{child_name}} ({{child_phone}})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Incoming Caller:</strong></td>
          <td style="padding: 6px 0; color: #dc2626; font-weight: 700; font-family: monospace; font-size: 15px;">{{caller_number}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Threat Classification:</strong></td>
          <td style="padding: 6px 0; color: #b91c1c; font-weight: 600;">{{spam_classification}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Intercept Timestamp:</strong></td>
          <td style="padding: 6px 0; color: #0f172a;">{{event_time}}</td>
        </tr>
      </table>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">Recommended Guardian Actions</h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
        <li>Instruct {{child_name}} <strong>not to call back</strong> or share personal information.</li>
        <li>Review your family call log in the SafeFamily portal.</li>
        <li>Block this number in the child's device settings or via our telecom parent app.</li>
      </ul>
    </div>

    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
      This security dispatch was automatically triggered by the Mobileum Child Spam Call Alert Policy Engine. For subscriber support, contact your telecom customer safety center.
    </p>
  </div>

  <div style="background: #f1f5f9; padding: 14px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
    © Mobileum Telecom Security Network • SafeFamily Live Protection Demo
  </div>
</div>`,
  body_text: `[PRIORITY SAFETY ALERT] SafeFamily Telecom Shield

Hello {{parent_name}},

Our telecom firewall intercepted a {{spam_classification}} incoming call targeting your child's line.

CALL DETAILS:
- Target Child: {{child_name}} ({{child_phone}})
- Incoming Caller: {{caller_number}}
- Classification: {{spam_classification}}
- Timestamp: {{event_time}}

RECOMMENDED ACTIONS:
1. Instruct {{child_name}} not to call back or disclose sensitive details.
2. Confirm the number is blocked on the child's device.
3. Access the SafeFamily portal to inspect telecom call logs.

SafeFamily Telecom Security Demo`,
  updated_at: new Date().toISOString(),
  is_active: true,
};

// Helper to safely extract string text even from Excel hyperlinks or rich text objects
function parseCellText(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    if (val.text) return String(val.text).trim();
    if (val.result) return String(val.result).trim();
    if (val.hyperlink) return String(val.hyperlink).replace(/^mailto:/i, '').trim();
  }
  return String(val).trim();
}

export class ExcelService {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || config.excelPath;
  }

  getFilePath(): string {
    return this.filePath;
  }

  // Ensure file exists with all sheets and default data
  async initialize(): Promise<void> {
    return fileLock.acquire(async () => {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        console.log(`[ExcelService] Creating demo database workbook at ${this.filePath}...`);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Mobileum Telecom Child Spam Alert System';
        workbook.created = new Date();

        this.populateDefaultSheets(workbook);
        await workbook.xlsx.writeFile(this.filePath);
        console.log(`[ExcelService] Initialized demo workbook successfully.`);
      } else {
        // Validate existing sheets and ensure all exist
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.filePath);
        let modified = false;

        const requiredSheets = [
          'Subscribers',
          'ParentChildMapping',
          'SpamNumbers',
          'CallLogs',
          'EmailTemplate',
          'README',
        ];

        for (const sheetName of requiredSheets) {
          if (!workbook.getWorksheet(sheetName)) {
            console.log(`[ExcelService] Missing sheet ${sheetName}, creating it...`);
            this.createMissingSheet(workbook, sheetName);
            modified = true;
          }
        }

        const logsSheet = workbook.getWorksheet('CallLogs');
        if (logsSheet) {
          const row1 = logsSheet.getRow(1);
          const cell14 = parseCellText(row1.getCell(14).value);
          const cell15 = parseCellText(row1.getCell(15).value);
          const cell16 = parseCellText(row1.getCell(16).value);
          if (!cell14) {
            row1.getCell(14).value = 'sms_status';
            modified = true;
          }
          if (cell15 !== 'call_status') {
            row1.getCell(15).value = 'call_status';
            modified = true;
          }
          if (cell16 !== 'duration') {
            row1.getCell(16).value = 'duration';
            modified = true;
          }
          if (modified) {
            row1.commit();
          }
        }

        if (modified) {
          await workbook.xlsx.writeFile(this.filePath);
        }
      }
    });
  }

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Rich navy
    };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 24;
  }

  private populateDefaultSheets(workbook: ExcelJS.Workbook): void {
    // 1. Subscribers Sheet
    const subSheet = workbook.addWorksheet('Subscribers');
    subSheet.columns = [
      { header: 'subscriber_id', key: 'subscriber_id', width: 16 },
      { header: 'name', key: 'name', width: 22 },
      { header: 'subscriber_type', key: 'subscriber_type', width: 18 },
      { header: 'phone_number', key: 'phone_number', width: 18 },
      { header: 'email', key: 'email', width: 32 },
      { header: 'email_alerts_enabled', key: 'email_alerts_enabled', width: 22 },
      { header: 'sms_alerts_enabled', key: 'sms_alerts_enabled', width: 20 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'created_at', key: 'created_at', width: 24 },
    ];
    this.styleHeaderRow(subSheet.getRow(1));

    const subscribersData: Subscriber[] = [
      {
        subscriber_id: 'SUB-101',
        name: 'Leo Miller',
        subscriber_type: 'CHILD',
        phone_number: '+1-555-0101',
        email: 'leo.m@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: false,
        is_active: true,
        created_at: '2026-01-10T08:00:00Z',
      },
      {
        subscriber_id: 'SUB-102',
        name: 'Emma Miller',
        subscriber_type: 'CHILD',
        phone_number: '+1-555-0102',
        email: 'emma.m@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: true,
        is_active: true,
        created_at: '2026-01-10T08:05:00Z',
      },
      {
        subscriber_id: 'SUB-103',
        name: 'Sarah Miller',
        subscriber_type: 'PARENT',
        phone_number: '+1-555-0100',
        email: 'sarah.miller.parent@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: true,
        is_active: true,
        created_at: '2026-01-10T07:50:00Z',
      },
      {
        subscriber_id: 'SUB-104',
        name: 'David Miller',
        subscriber_type: 'PARENT',
        phone_number: '+1-555-0199',
        email: 'david.miller.family@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: false,
        is_active: true,
        created_at: '2026-01-10T07:55:00Z',
      },
      {
        subscriber_id: 'SUB-105',
        name: 'Lucas Chen',
        subscriber_type: 'CHILD',
        phone_number: '+1-555-0201',
        email: 'lucas.c@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: true,
        is_active: true,
        created_at: '2026-01-12T09:00:00Z',
      },
      {
        subscriber_id: 'SUB-106',
        name: 'Grace Chen',
        subscriber_type: 'PARENT',
        phone_number: '+1-555-0200',
        email: 'grace.chen.mom@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: true,
        is_active: true,
        created_at: '2026-01-12T08:45:00Z',
      },
      {
        subscriber_id: 'SUB-107',
        name: 'Tommy Watson', // Intentionally unmapped child for test requirement #5
        subscriber_type: 'CHILD',
        phone_number: '+1-555-0301',
        email: '',
        email_alerts_enabled: true,
        sms_alerts_enabled: false,
        is_active: true,
        created_at: '2026-01-15T11:00:00Z',
      },
      {
        subscriber_id: 'SUB-108',
        name: 'Arthur Watson',
        subscriber_type: 'PARENT',
        phone_number: '+1-555-0300',
        email: 'arthur.w@example.com',
        email_alerts_enabled: false,
        sms_alerts_enabled: true,
        is_active: true,
        created_at: '2026-01-15T10:45:00Z',
      },
      {
        subscriber_id: 'SUB-109',
        name: 'Maya Patel', // Child without email address (testing graceful lack of child email)
        subscriber_type: 'CHILD',
        phone_number: '+1-555-0401',
        email: '',
        email_alerts_enabled: true,
        sms_alerts_enabled: false,
        is_active: true,
        created_at: '2026-01-18T14:00:00Z',
      },
      {
        subscriber_id: 'SUB-110',
        name: 'Raj Patel',
        subscriber_type: 'PARENT',
        phone_number: '+1-555-0400',
        email: 'raj.patel.family@example.com',
        email_alerts_enabled: true,
        sms_alerts_enabled: true,
        is_active: true,
        created_at: '2026-01-18T13:30:00Z',
      },
    ];

    subscribersData.forEach((s) => subSheet.addRow(s));

    // 2. ParentChildMapping Sheet
    const mapSheet = workbook.addWorksheet('ParentChildMapping');
    mapSheet.columns = [
      { header: 'mapping_id', key: 'mapping_id', width: 16 },
      { header: 'parent_id', key: 'parent_id', width: 16 },
      { header: 'child_id', key: 'child_id', width: 16 },
      { header: 'relationship_type', key: 'relationship_type', width: 22 },
      { header: 'can_receive_alerts', key: 'can_receive_alerts', width: 20 },
      { header: 'created_at', key: 'created_at', width: 24 },
    ];
    this.styleHeaderRow(mapSheet.getRow(1));

    const mappingData: ParentChildMapping[] = [
      {
        mapping_id: 'MAP-001',
        parent_id: 'SUB-103', // Sarah Miller
        child_id: 'SUB-101',  // Leo Miller
        relationship_type: 'Mother / Primary Guardian',
        can_receive_alerts: true,
        created_at: '2026-01-10T08:10:00Z',
      },
      {
        mapping_id: 'MAP-002',
        parent_id: 'SUB-104', // David Miller (Multiple parents for same child!)
        child_id: 'SUB-101',  // Leo Miller
        relationship_type: 'Father / Authorized Guardian',
        can_receive_alerts: true,
        created_at: '2026-01-10T08:12:00Z',
      },
      {
        mapping_id: 'MAP-003',
        parent_id: 'SUB-103', // Sarah Miller (Multiple children for same parent!)
        child_id: 'SUB-102',  // Emma Miller
        relationship_type: 'Mother / Primary Guardian',
        can_receive_alerts: true,
        created_at: '2026-01-10T08:15:00Z',
      },
      {
        mapping_id: 'MAP-004',
        parent_id: 'SUB-106', // Grace Chen
        child_id: 'SUB-105',  // Lucas Chen
        relationship_type: 'Mother / Primary Guardian',
        can_receive_alerts: true,
        created_at: '2026-01-12T09:10:00Z',
      },
      {
        mapping_id: 'MAP-005',
        parent_id: 'SUB-110', // Raj Patel
        child_id: 'SUB-109',  // Maya Patel
        relationship_type: 'Father / Primary Guardian',
        can_receive_alerts: true,
        created_at: '2026-01-18T14:10:00Z',
      },
    ];
    mappingData.forEach((m) => mapSheet.addRow(m));

    // 3. SpamNumbers Sheet
    const spamSheet = workbook.addWorksheet('SpamNumbers');
    spamSheet.columns = [
      { header: 'spam_id', key: 'spam_id', width: 16 },
      { header: 'phone_number', key: 'phone_number', width: 18 },
      { header: 'caller_name', key: 'caller_name', width: 28 },
      { header: 'category', key: 'category', width: 22 },
      { header: 'risk_score', key: 'risk_score', width: 14 },
      { header: 'reputation_status', key: 'reputation_status', width: 22 },
      { header: 'is_spam', key: 'is_spam', width: 12 },
      { header: 'notes', key: 'notes', width: 42 },
    ];
    this.styleHeaderRow(spamSheet.getRow(1));

    const spamData: SpamNumber[] = [
      {
        spam_id: 'SPAM-101',
        phone_number: '+1-800-555-0191',
        caller_name: 'IRS Tax Audit Threats',
        category: 'IRS Impersonator',
        risk_score: 98,
        reputation_status: 'CRITICAL THREAT',
        is_spam: true,
        notes: 'Pre-recorded voice demanding payment via prepaid gift cards',
      },
      {
        spam_id: 'SPAM-102',
        phone_number: '+1-888-234-5678',
        caller_name: 'Global Microsoft Tech Desk',
        category: 'Tech Support Scam',
        risk_score: 95,
        reputation_status: 'CRITICAL THREAT',
        is_spam: true,
        notes: 'Claims recipient computer has malware; seeks remote access',
      },
      {
        spam_id: 'SPAM-103',
        phone_number: '+1-800-999-8877',
        caller_name: 'Federal Student Debt Relief',
        category: 'Robocall',
        risk_score: 91,
        reputation_status: 'HIGH RISK SPAM',
        is_spam: true,
        notes: 'Mass auto-dialer harvesting Social Security numbers',
      },
      {
        spam_id: 'SPAM-104',
        phone_number: '+1-877-444-1234',
        caller_name: 'Sweepstakes Winner Department',
        category: 'Lottery Fraud',
        risk_score: 96,
        reputation_status: 'CRITICAL THREAT',
        is_spam: true,
        notes: 'Fake prize claims requiring upfront insurance fee',
      },
      {
        spam_id: 'SPAM-105',
        phone_number: '+1-800-111-2233',
        caller_name: 'EcoRoof Solar Telemarketing',
        category: 'Telemarketer',
        risk_score: 75,
        reputation_status: 'SUSPECTED SPAM',
        is_spam: true,
        notes: 'Do-Not-Call registry violation automated sales pitch',
      },
      {
        spam_id: 'LEGIT-201',
        phone_number: '+1-555-0188',
        caller_name: 'Lincoln Middle School Main Office',
        category: 'School / Verified',
        risk_score: 2,
        reputation_status: 'LEGITIMATE',
        is_spam: false,
        notes: 'Verified municipal school district administrative line',
      },
      {
        spam_id: 'LEGIT-202',
        phone_number: '+1-555-0177',
        caller_name: 'Pediatric Health Clinic',
        category: 'Healthcare / Verified',
        risk_score: 4,
        reputation_status: 'LEGITIMATE',
        is_spam: false,
        notes: 'Verified pediatrician clinic appointment desk',
      },
      {
        spam_id: 'LEGIT-203',
        phone_number: '+1-555-0166',
        caller_name: 'Grandma Evelyn',
        category: 'Family / Personal',
        risk_score: 0,
        reputation_status: 'LEGITIMATE',
        is_spam: false,
        notes: 'Known family member contact',
      },
    ];
    spamData.forEach((s) => spamSheet.addRow(s));

    // 4. CallLogs Sheet
    const logsSheet = workbook.addWorksheet('CallLogs');
    logsSheet.columns = [
      { header: 'event_id', key: 'event_id', width: 22 },
      { header: 'timestamp', key: 'timestamp', width: 24 },
      { header: 'caller_number', key: 'caller_number', width: 18 },
      { header: 'caller_classification', key: 'caller_classification', width: 22 },
      { header: 'caller_name', key: 'caller_name', width: 24 },
      { header: 'receiver_name', key: 'receiver_name', width: 20 },
      { header: 'receiver_number', key: 'receiver_number', width: 18 },
      { header: 'receiver_type', key: 'receiver_type', width: 16 },
      { header: 'parent_recipient', key: 'parent_recipient', width: 34 },
      { header: 'decision', key: 'decision', width: 32 },
      { header: 'email_status', key: 'email_status', width: 20 },
      { header: 'details', key: 'details', width: 44 },
      { header: 'error_message', key: 'error_message', width: 32 },
      { header: 'sms_status', key: 'sms_status', width: 18 },
      { header: 'call_status', key: 'call_status', width: 18 },
      { header: 'duration', key: 'duration', width: 12 },
    ];
    this.styleHeaderRow(logsSheet.getRow(1));

    const initialLogs: CallLog[] = [
      {
        event_id: 'EVT-20261028-091522',
        timestamp: '2026-10-28T09:15:22.000Z',
        caller_number: '+1-800-555-0191',
        caller_classification: 'SPAM',
        caller_name: 'IRS Tax Audit Threats',
        receiver_name: 'Leo Miller',
        receiver_number: '+1-555-0101',
        receiver_type: 'CHILD',
        parent_recipient: 'Sarah Miller (sarah.miller.parent@example.com), David Miller (david.miller.family@example.com)',
        decision: 'PARENT ALERTS SENT (SMS + EMAIL)',
        email_status: 'ACCEPTED_BY_SMTP',
        sms_status: 'DELIVERED',
        details: 'High-risk IRS Impersonator targeting minor line. Alert dispatched to 2 active guardians via Email & Carrier SMS.',
      },
      {
        event_id: 'EVT-20261028-112040',
        timestamp: '2026-10-28T11:20:40.000Z',
        caller_number: '+1-555-0188',
        caller_classification: 'LEGITIMATE',
        caller_name: 'Lincoln Middle School Main Office',
        receiver_name: 'Leo Miller',
        receiver_number: '+1-555-0101',
        receiver_type: 'CHILD',
        parent_recipient: 'None',
        decision: 'NO ALERT — LEGITIMATE CALL',
        email_status: 'SKIPPED',
        sms_status: 'SKIPPED',
        details: 'Verified educational institution. Safe caller policy passed.',
      },
      {
        event_id: 'EVT-20261028-140510',
        timestamp: '2026-10-28T14:05:10.000Z',
        caller_number: '+1-888-234-5678',
        caller_classification: 'SPAM',
        caller_name: 'Global Microsoft Tech Desk',
        receiver_name: 'Sarah Miller',
        receiver_number: '+1-555-0100',
        receiver_type: 'PARENT',
        parent_recipient: 'None',
        decision: 'NO ALERT — RECEIVER IS A PARENT',
        email_status: 'SKIPPED',
        sms_status: 'SKIPPED',
        details: 'Receiver is adult subscriber. Child safety alert not applicable.',
      },
    ];
    initialLogs.forEach((l) => logsSheet.addRow(l));

    // 5. EmailTemplate Sheet
    const tmplSheet = workbook.addWorksheet('EmailTemplate');
    tmplSheet.columns = [
      { header: 'template_id', key: 'template_id', width: 16 },
      { header: 'template_name', key: 'template_name', width: 26 },
      { header: 'subject', key: 'subject', width: 45 },
      { header: 'body_html', key: 'body_html', width: 60 },
      { header: 'body_text', key: 'body_text', width: 50 },
      { header: 'updated_at', key: 'updated_at', width: 24 },
      { header: 'is_active', key: 'is_active', width: 14 },
    ];
    this.styleHeaderRow(tmplSheet.getRow(1));
    tmplSheet.addRow(DEFAULT_EMAIL_TEMPLATE);

    // 6. README Sheet
    const readmeSheet = workbook.addWorksheet('README');
    readmeSheet.columns = [
      { header: 'Section', key: 'section', width: 25 },
      { header: 'Description / Documentation', key: 'desc', width: 85 },
    ];
    this.styleHeaderRow(readmeSheet.getRow(1));
    readmeSheet.addRow({
      section: 'System Title',
      desc: 'Mobileum Child Spam Call Alert System — Enterprise Telecom Safety Demo',
    });
    readmeSheet.addRow({
      section: 'Architecture Notice',
      desc: 'This Excel workbook serves as the single-user demo datastore. For carrier production deployments, this service integrates with relational databases (PostgreSQL/Oracle) and real-time telecom SS7/SIP firewalls.',
    });
    readmeSheet.addRow({
      section: 'Data Integrity',
      desc: 'Thread-safe writes are serialized via in-process mutex to prevent file lock corruption during concurrent simulation and template updates.',
    });
    readmeSheet.addRow({
      section: 'Sheet: Subscribers',
      desc: 'Stores active/inactive subscribers categorized as CHILD or PARENT with alert preferences.',
    });
    readmeSheet.addRow({
      section: 'Sheet: ParentChildMapping',
      desc: 'M:N relationship mapping between children and authorized guardians with alert permissions.',
    });
    readmeSheet.addRow({
      section: 'Sheet: SpamNumbers',
      desc: 'Known telecom reputation database with risk scores, categories, and classification tags.',
    });
    readmeSheet.addRow({
      section: 'Sheet: CallLogs',
      desc: 'Immutable audit log of all intercepted incoming calls, pipeline verification steps, decisions, and SMTP delivery states.',
    });
    readmeSheet.addRow({
      section: 'Sheet: EmailTemplate',
      desc: 'Configurable guardian safety alert notification template supporting variables {{parent_name}}, {{child_name}}, {{caller_number}}, {{child_phone}}, {{event_time}}, {{spam_classification}}.',
    });
  }

  private createMissingSheet(workbook: ExcelJS.Workbook, sheetName: string): void {
    if (sheetName === 'Subscribers') {
      const s = workbook.addWorksheet('Subscribers');
      s.columns = [
        { header: 'subscriber_id', key: 'subscriber_id', width: 16 },
        { header: 'name', key: 'name', width: 22 },
        { header: 'subscriber_type', key: 'subscriber_type', width: 18 },
        { header: 'phone_number', key: 'phone_number', width: 18 },
        { header: 'email', key: 'email', width: 32 },
        { header: 'email_alerts_enabled', key: 'email_alerts_enabled', width: 22 },
        { header: 'sms_alerts_enabled', key: 'sms_alerts_enabled', width: 20 },
        { header: 'is_active', key: 'is_active', width: 14 },
        { header: 'created_at', key: 'created_at', width: 24 },
      ];
      this.styleHeaderRow(s.getRow(1));
    } else if (sheetName === 'EmailTemplate') {
      const s = workbook.addWorksheet('EmailTemplate');
      s.columns = [
        { header: 'template_id', key: 'template_id', width: 16 },
        { header: 'template_name', key: 'template_name', width: 26 },
        { header: 'subject', key: 'subject', width: 45 },
        { header: 'body_html', key: 'body_html', width: 60 },
        { header: 'body_text', key: 'body_text', width: 50 },
        { header: 'updated_at', key: 'updated_at', width: 24 },
        { header: 'is_active', key: 'is_active', width: 14 },
      ];
      this.styleHeaderRow(s.getRow(1));
      s.addRow(DEFAULT_EMAIL_TEMPLATE);
    }
  }

  // Helper to load workbook safely with retry if locked by Excel
  private async loadWorkbook(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await workbook.xlsx.readFile(this.filePath);
        return workbook;
      } catch (err: any) {
        if (err.code === 'EBUSY' && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        } else if (err.code === 'EBUSY') {
          throw new Error(
            `Excel workbook '${path.basename(this.filePath)}' is currently locked by another program (e.g. Microsoft Excel). Please close or save the file in Excel.`
          );
        } else {
          throw err;
        }
      }
    }
    return workbook;
  }

  // Helper to write workbook safely with retry if locked by Excel
  private async saveWorkbook(workbook: ExcelJS.Workbook): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await workbook.xlsx.writeFile(this.filePath);
        return;
      } catch (err: any) {
        if (err.code === 'EBUSY' && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        } else if (err.code === 'EBUSY') {
          throw new Error(
            `Excel workbook '${path.basename(this.filePath)}' is currently open in Microsoft Excel. Please close or save the file in Excel so updates can be written.`
          );
        } else {
          throw err;
        }
      }
    }
  }

  // --- SUBSCRIBERS ---
  async getSubscribers(): Promise<Subscriber[]> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('Subscribers');
      if (!sheet) return [];

      const subscribers: Subscriber[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const values = row.values as any[];
        // ExcelJS row.values is 1-indexed (index 0 is undefined)
        const sub: Subscriber = {
          subscriber_id: parseCellText(values[1]),
          name: parseCellText(values[2]),
          subscriber_type: (parseCellText(values[3]).toUpperCase() === 'PARENT'
            ? 'PARENT'
            : 'CHILD'),
          phone_number: parseCellText(values[4]),
          email: parseCellText(values[5]),
          email_alerts_enabled: values[6] === true || String(values[6]).toLowerCase() === 'true',
          sms_alerts_enabled: values[7] === true || String(values[7]).toLowerCase() === 'true',
          is_active: values[8] === true || String(values[8]).toLowerCase() === 'true',
          subscription_status: (values[8] === true || String(values[8]).toLowerCase() === 'true') ? 'Active' : 'Inactive',
          created_at: parseCellText(values[9]) || new Date().toISOString(),
        };
        if (sub.subscriber_id && sub.name) {
          subscribers.push(sub);
        }
      });
      return subscribers;
    });
  }

  async getSubscriberById(id: string): Promise<Subscriber | undefined> {
    const subs = await this.getSubscribers();
    return subs.find((s) => s.subscriber_id.toLowerCase() === id.toLowerCase());
  }

  async getSubscriberByPhone(phone: string): Promise<Subscriber | undefined> {
    const subs = await this.getSubscribers();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return subs.find((s) => s.phone_number.replace(/[^0-9]/g, '') === cleanPhone);
  }

  async saveSubscriber(subscriber: Subscriber): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('Subscribers');
      if (!sheet) return { success: false, error: 'Subscribers sheet not found' };

      if (subscriber.subscription_status !== undefined) {
        subscriber.is_active = subscriber.subscription_status === 'Active';
      }

      // Validation
      const existingSubs: { rowNumber: number; id: string; phone: string }[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        existingSubs.push({
          rowNumber,
          id: String(vals[1] || '').trim(),
          phone: String(vals[4] || '').trim(),
        });
      });

      const cleanNewPhone = subscriber.phone_number.replace(/[^0-9]/g, '');
      const existingById = existingSubs.find(
        (s) => s.id.toLowerCase() === subscriber.subscriber_id.toLowerCase()
      );

      // Check duplicate phone if creating or updating another record
      const duplicatePhone = existingSubs.find(
        (s) =>
          s.phone.replace(/[^0-9]/g, '') === cleanNewPhone &&
          s.id.toLowerCase() !== subscriber.subscriber_id.toLowerCase()
      );

      if (duplicatePhone) {
        return {
          success: false,
          error: `Phone number ${subscriber.phone_number} is already registered to another subscriber (${duplicatePhone.id})`,
        };
      }

      if (existingById) {
        // Update existing row
        const row = sheet.getRow(existingById.rowNumber);
        row.getCell(2).value = subscriber.name;
        row.getCell(3).value = subscriber.subscriber_type;
        row.getCell(4).value = subscriber.phone_number;
        row.getCell(5).value = subscriber.email;
        row.getCell(6).value = subscriber.email_alerts_enabled;
        row.getCell(7).value = subscriber.sms_alerts_enabled;
        row.getCell(8).value = subscriber.is_active;
        row.commit();
      } else {
        // Add new row as array to guarantee column alignment on loaded sheets
        sheet.addRow([
          subscriber.subscriber_id,
          subscriber.name,
          subscriber.subscriber_type,
          subscriber.phone_number,
          subscriber.email,
          subscriber.email_alerts_enabled,
          subscriber.sms_alerts_enabled,
          subscriber.is_active,
          subscriber.created_at || new Date().toISOString(),
        ]);
      }

      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async deleteSubscriber(subscriberId: string): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const subSheet = workbook.getWorksheet('Subscribers');
      if (!subSheet) return { success: false, error: 'Subscribers sheet not found' };

      let targetRowIndex = -1;
      subSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (parseCellText(vals[1]).toLowerCase() === subscriberId.toLowerCase()) {
          targetRowIndex = rowNumber;
        }
      });

      if (targetRowIndex === -1) {
        return { success: false, error: `Subscriber ${subscriberId} not found` };
      }

      subSheet.spliceRows(targetRowIndex, 1);

      // Clean up any parent-child mappings linked to this subscriber
      const mapSheet = workbook.getWorksheet('ParentChildMapping');
      if (mapSheet) {
        const rowsToDelete: number[] = [];
        mapSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const pId = parseCellText(vals[2]).toLowerCase();
          const cId = parseCellText(vals[3]).toLowerCase();
          if (pId === subscriberId.toLowerCase() || cId === subscriberId.toLowerCase()) {
            rowsToDelete.push(rowNumber);
          }
        });
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
          mapSheet.spliceRows(rowsToDelete[i], 1);
        }

        // Clean up orphan parents who have no remaining mapped children
        const mappedParentIds = new Set<string>();
        mapSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const pId = parseCellText(vals[2]).toLowerCase();
          if (pId) mappedParentIds.add(pId);
        });

        const orphanParentRows: number[] = [];
        subSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const sId = parseCellText(vals[1]).toLowerCase();
          const sType = parseCellText(vals[3]).toUpperCase();
          if (sType === 'PARENT' && !mappedParentIds.has(sId)) {
            orphanParentRows.push(rowNumber);
          }
        });
        for (let i = orphanParentRows.length - 1; i >= 0; i--) {
          subSheet.spliceRows(orphanParentRows[i], 1);
        }
      }

      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async registerChildWithFamily(data: {
    child: {
      name: string;
      phone_number: string;
      email?: string;
      subscriber_id?: string;
      subscription_status?: 'Active' | 'Inactive';
    };
    guardians?: Array<{
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email?: string;
      relationship?: string;
    }>;
    parent?: {
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email: string;
      relationship?: string;
    };
    extraAdult?: {
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email?: string;
      relationship?: string;
    };
  }): Promise<{ success: boolean; error?: string; child_id?: string; parent_id?: string; extra_adult_id?: string }> {
    return fileLock.acquire(async () => {
      const childName = (data.child.name || '').trim();
      const childPhone = (data.child.phone_number || '').trim();

      if (!childName || !childPhone) {
        return { success: false, error: 'Child name and phone number are required.' };
      }

      // Collect list of guardians from either data.guardians or data.parent / data.extraAdult
      const guardiansList: Array<{
        subscriber_id?: string;
        name: string;
        phone_number: string;
        email?: string;
        relationship?: string;
      }> = [];

      if (Array.isArray(data.guardians) && data.guardians.length > 0) {
        guardiansList.push(...data.guardians);
      } else {
        if (data.parent && data.parent.name?.trim()) {
          guardiansList.push(data.parent);
        }
        if (data.extraAdult && data.extraAdult.name?.trim()) {
          guardiansList.push(data.extraAdult);
        }
      }

      const workbook = await this.loadWorkbook();
      const subSheet = workbook.getWorksheet('Subscribers');
      const mapSheet = workbook.getWorksheet('ParentChildMapping');
      if (!subSheet || !mapSheet) {
        return { success: false, error: 'Database sheets missing.' };
      }

      const cleanChildPhone = childPhone.replace(/[^0-9]/g, '');

      let existingChildId = '';
      const existingIds = new Set<string>();

      subSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const sId = parseCellText(vals[1]);
        const sPhone = parseCellText(vals[4]).replace(/[^0-9]/g, '');
        if (sId) existingIds.add(sId.toUpperCase());
        if (sPhone === cleanChildPhone) {
          existingChildId = sId;
        }
      });

      if (existingChildId) {
        return { success: false, error: `Child phone number ${childPhone} is already registered under ID ${existingChildId}.` };
      }

      const generateUniqueSubId = () => {
        for (let i = 0; i < 500; i++) {
          const candidate = `SUB-${Math.floor(100 + Math.random() * 900)}`;
          if (!existingIds.has(candidate)) {
            existingIds.add(candidate);
            return candidate;
          }
        }
        return `SUB-${Date.now().toString(36).toUpperCase()}`;
      };

      const childId = data.child.subscriber_id || generateUniqueSubId();
      existingIds.add(childId.toUpperCase());
      const isChildActive = data.child.subscription_status !== 'Inactive';
      const childEmail = data.child.email?.trim() || `${childName.toLowerCase().replace(/\s+/g, '.')}@family.local`;

      // 1. Add child subscriber row
      subSheet.addRow([
        childId,
        childName,
        'CHILD',
        childPhone,
        childEmail,
        true,
        true,
        isChildActive,
        new Date().toISOString(),
      ]);

      let primaryParentId = '';
      let secondaryParentId: string | undefined = undefined;

      // 2. Add each guardian and create mappings
      for (let idx = 0; idx < guardiansList.length; idx++) {
        const g = guardiansList[idx];
        if (!g.name?.trim() || !g.phone_number?.trim()) continue;

        const gName = g.name.trim();
        const gPhone = g.phone_number.trim();
        const gEmail = g.email?.trim() || `${gName.toLowerCase().replace(/\s+/g, '.')}@family.local`;
        const cleanGPhone = gPhone.replace(/[^0-9]/g, '');

        let pId = g.subscriber_id || '';
        let existingGuardianRow: any = null;

        subSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const sId = parseCellText(vals[1]);
          const sPhone = parseCellText(vals[4]).replace(/[^0-9]/g, '');
          const sType = parseCellText(vals[3]).toUpperCase();
          if ((pId && sId.toLowerCase() === pId.toLowerCase()) || (!pId && sPhone === cleanGPhone && sType === 'PARENT')) {
            pId = sId;
            existingGuardianRow = row;
          }
        });

        if (existingGuardianRow) {
          // Update details if provided
          if (gName) existingGuardianRow.getCell(2).value = gName;
          if (gPhone) existingGuardianRow.getCell(4).value = gPhone;
          if (gEmail) existingGuardianRow.getCell(5).value = gEmail;
          existingGuardianRow.commit();
        } else {
          if (!pId) {
            pId = generateUniqueSubId();
            existingIds.add(pId.toUpperCase());
          }
          subSheet.addRow([
            pId,
            gName,
            'PARENT',
            gPhone,
            gEmail,
            true,
            true,
            true,
            new Date().toISOString(),
          ]);
        }

        if (idx === 0) {
          primaryParentId = pId;
        } else if (idx === 1) {
          secondaryParentId = pId;
        }

        // Add mapping
        const mapId = `MAP-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
        mapSheet.addRow([
          mapId,
          pId,
          childId,
          g.relationship || (idx === 0 ? 'Primary Guardian' : 'Secondary Guardian'),
          true,
          new Date().toISOString(),
        ]);
      }

      await this.saveWorkbook(workbook);
      return { success: true, child_id: childId, parent_id: primaryParentId, extra_adult_id: secondaryParentId };
    });
  }

  async updateChildGuardians(
    childId: string,
    guardians: Array<{
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email?: string;
      relationship?: string;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const subSheet = workbook.getWorksheet('Subscribers');
      const mapSheet = workbook.getWorksheet('ParentChildMapping');
      if (!subSheet || !mapSheet) {
        return { success: false, error: 'Database sheets missing.' };
      }

      // Remove existing mappings for this child
      const rowsToRemove: number[] = [];
      mapSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const cId = parseCellText(vals[3]).toLowerCase();
        if (cId === childId.toLowerCase()) {
          rowsToRemove.push(rowNumber);
        }
      });
      for (let i = rowsToRemove.length - 1; i >= 0; i--) {
        mapSheet.spliceRows(rowsToRemove[i], 1);
      }

      const existingIds = new Set<string>();
      subSheet.eachRow((r, i) => {
        if (i === 1) return;
        const sId = parseCellText((r.values as any[])[1]);
        if (sId) existingIds.add(sId.toUpperCase());
      });

      const generateUniqueSubId = () => {
        for (let i = 0; i < 500; i++) {
          const candidate = `SUB-${Math.floor(100 + Math.random() * 900)}`;
          if (!existingIds.has(candidate)) {
            existingIds.add(candidate);
            return candidate;
          }
        }
        return `SUB-${Date.now().toString(36).toUpperCase()}`;
      };

      for (let idx = 0; idx < guardians.length; idx++) {
        const g = guardians[idx];
        if (!g.name?.trim() || !g.phone_number?.trim()) continue;

        const gName = g.name.trim();
        const gPhone = g.phone_number.trim();
        const gEmail = g.email?.trim() || `${gName.toLowerCase().replace(/\s+/g, '.')}@family.local`;
        const cleanPhone = gPhone.replace(/[^0-9]/g, '');

        let pId = g.subscriber_id;
        let existingRow: any = null;

        subSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const sId = parseCellText(vals[1]);
          const sPhone = parseCellText(vals[4]).replace(/[^0-9]/g, '');
          if ((pId && sId.toLowerCase() === pId.toLowerCase()) || (!pId && sPhone === cleanPhone)) {
            pId = sId;
            existingRow = row;
          }
        });

        if (existingRow) {
          existingRow.getCell(2).value = gName;
          existingRow.getCell(4).value = gPhone;
          if (gEmail) existingRow.getCell(5).value = gEmail;
          existingRow.commit();
        } else {
          if (!pId) {
            pId = generateUniqueSubId();
            existingIds.add(pId.toUpperCase());
          }
          subSheet.addRow([
            pId,
            gName,
            'PARENT',
            gPhone,
            gEmail,
            true,
            true,
            true,
            new Date().toISOString(),
          ]);
        }

        const mapId = `MAP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
        mapSheet.addRow([
          mapId,
          pId,
          childId,
          g.relationship || 'Guardian',
          true,
          new Date().toISOString(),
        ]);
      }

      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async bulkDeleteSubscribers(subscriberIds: string[]): Promise<{ success: boolean; deletedCount: number }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const subSheet = workbook.getWorksheet('Subscribers');
      const mapSheet = workbook.getWorksheet('ParentChildMapping');
      if (!subSheet) return { success: false, deletedCount: 0 };

      const idSet = new Set(subscriberIds.map((id) => id.toLowerCase()));

      const subRowsToDelete: number[] = [];
      subSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const sId = parseCellText(vals[1]).toLowerCase();
        if (idSet.has(sId)) {
          subRowsToDelete.push(rowNumber);
        }
      });
      for (let i = subRowsToDelete.length - 1; i >= 0; i--) {
        subSheet.spliceRows(subRowsToDelete[i], 1);
      }

      if (mapSheet) {
        const mapRowsToDelete: number[] = [];
        mapSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const pId = parseCellText(vals[2]).toLowerCase();
          const cId = parseCellText(vals[3]).toLowerCase();
          if (idSet.has(pId) || idSet.has(cId)) {
            mapRowsToDelete.push(rowNumber);
          }
        });
        for (let i = mapRowsToDelete.length - 1; i >= 0; i--) {
          mapSheet.spliceRows(mapRowsToDelete[i], 1);
        }

        // Clean up orphan parents who have no remaining mapped children
        const mappedParentIds = new Set<string>();
        mapSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const pId = parseCellText(vals[2]).toLowerCase();
          if (pId) mappedParentIds.add(pId);
        });

        const orphanParentRows: number[] = [];
        subSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = row.values as any[];
          const sId = parseCellText(vals[1]).toLowerCase();
          const sType = parseCellText(vals[3]).toUpperCase();
          if (sType === 'PARENT' && !mappedParentIds.has(sId)) {
            orphanParentRows.push(rowNumber);
          }
        });
        for (let i = orphanParentRows.length - 1; i >= 0; i--) {
          subSheet.spliceRows(orphanParentRows[i], 1);
        }
      }

      await this.saveWorkbook(workbook);
      return { success: true, deletedCount: subRowsToDelete.length };
    });
  }

  async bulkDeleteCallLogs(eventIds: string[]): Promise<{ success: boolean; deletedCount: number }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('CallLogs');
      if (!sheet) return { success: false, deletedCount: 0 };

      const eventSet = new Set(eventIds.map((e) => e.toLowerCase()));
      const rowsToDelete: number[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const evId = parseCellText(vals[1]).toLowerCase();
        if (eventSet.has(evId)) {
          rowsToDelete.push(rowNumber);
        }
      });

      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        sheet.spliceRows(rowsToDelete[i], 1);
      }

      await this.saveWorkbook(workbook);
      return { success: true, deletedCount: rowsToDelete.length };
    });
  }

  // --- PARENT CHILD MAPPINGS ---
  async getParentChildMappings(): Promise<ParentChildMapping[]> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('ParentChildMapping');
      if (!sheet) return [];

      const mappings: ParentChildMapping[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const map: ParentChildMapping = {
          mapping_id: String(vals[1] || '').trim(),
          parent_id: String(vals[2] || '').trim(),
          child_id: String(vals[3] || '').trim(),
          relationship_type: String(vals[4] || 'Guardian').trim(),
          can_receive_alerts: vals[5] === true || String(vals[5]).toLowerCase() === 'true',
          created_at: String(vals[6] || new Date().toISOString()),
        };
        if (map.mapping_id && map.parent_id && map.child_id) {
          mappings.push(map);
        }
      });
      return mappings;
    });
  }

  async addParentChildMapping(mapping: ParentChildMapping): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('ParentChildMapping');
      if (!sheet) return { success: false, error: 'ParentChildMapping sheet not found' };

      // Check duplicates
      let duplicate = false;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (
          String(vals[2] || '').trim() === mapping.parent_id &&
          String(vals[3] || '').trim() === mapping.child_id
        ) {
          duplicate = true;
        }
      });

      if (duplicate) {
        return { success: false, error: 'This parent is already mapped to this child.' };
      }

      sheet.addRow([
        mapping.mapping_id,
        mapping.parent_id,
        mapping.child_id,
        mapping.relationship_type,
        mapping.can_receive_alerts,
        mapping.created_at,
      ]);
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async deleteParentChildMapping(mappingId: string): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('ParentChildMapping');
      if (!sheet) return { success: false, error: 'ParentChildMapping sheet not found' };

      let targetRowIndex = -1;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (String(vals[1] || '').trim() === mappingId) {
          targetRowIndex = rowNumber;
        }
      });

      if (targetRowIndex === -1) {
        return { success: false, error: `Mapping ID ${mappingId} not found` };
      }

      sheet.spliceRows(targetRowIndex, 1);
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  // --- SPAM NUMBERS ---
  async getSpamNumbers(): Promise<SpamNumber[]> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('SpamNumbers');
      if (!sheet) return [];

      const list: SpamNumber[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const item: SpamNumber = {
          spam_id: parseCellText(vals[1]),
          phone_number: parseCellText(vals[2]),
          caller_name: parseCellText(vals[3]),
          category: parseCellText(vals[4]) || 'General Spam',
          risk_score: parseInt(parseCellText(vals[5]) || '75', 10),
          reputation_status: parseCellText(vals[6]) || 'SUSPECTED SPAM',
          is_spam: vals[7] === true || String(vals[7]).toLowerCase() === 'true',
          notes: parseCellText(vals[8]),
        };
        if (item.spam_id && item.phone_number) {
          list.push(item);
        }
      });
      return list;
    });
  }

  async addSpamNumber(entry: SpamNumber): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('SpamNumbers');
      if (!sheet) return { success: false, error: 'SpamNumbers sheet not found' };

      sheet.addRow([
        entry.spam_id,
        entry.phone_number,
        entry.caller_name,
        entry.category,
        entry.risk_score,
        entry.reputation_status,
        entry.is_spam,
        entry.notes,
      ]);
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async updateSpamNumber(
    spamId: string,
    updates: Partial<SpamNumber>
  ): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('SpamNumbers');
      if (!sheet) return { success: false, error: 'SpamNumbers sheet not found' };

      let targetRow: ExcelJS.Row | null = null;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (parseCellText(vals[1]).toLowerCase() === spamId.toLowerCase()) {
          targetRow = row;
        }
      });

      if (!targetRow) {
        return { success: false, error: `Spam number entry ${spamId} not found` };
      }

      if (updates.phone_number !== undefined) (targetRow as ExcelJS.Row).getCell(2).value = updates.phone_number;
      if (updates.caller_name !== undefined) (targetRow as ExcelJS.Row).getCell(3).value = updates.caller_name;
      if (updates.category !== undefined) (targetRow as ExcelJS.Row).getCell(4).value = updates.category;
      if (updates.risk_score !== undefined) (targetRow as ExcelJS.Row).getCell(5).value = updates.risk_score;
      if (updates.reputation_status !== undefined) (targetRow as ExcelJS.Row).getCell(6).value = updates.reputation_status;
      if (updates.is_spam !== undefined) (targetRow as ExcelJS.Row).getCell(7).value = updates.is_spam;
      if (updates.notes !== undefined) (targetRow as ExcelJS.Row).getCell(8).value = updates.notes;

      (targetRow as ExcelJS.Row).commit();
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async deleteSpamNumber(spamId: string): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('SpamNumbers');
      if (!sheet) return { success: false, error: 'SpamNumbers sheet not found' };

      let targetRowIndex = -1;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (parseCellText(vals[1]).toLowerCase() === spamId.toLowerCase()) {
          targetRowIndex = rowNumber;
        }
      });

      if (targetRowIndex === -1) {
        return { success: false, error: `Spam entry ${spamId} not found` };
      }

      sheet.spliceRows(targetRowIndex, 1);
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  // --- CALL LOGS ---
  async getCallLogs(filters?: {
    search?: string;
    classification?: string;
    receiverType?: string;
    emailStatus?: string;
    limit?: number;
  }): Promise<CallLog[]> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('CallLogs');
      if (!sheet) return [];

      let logs: CallLog[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        const emailStatus = (parseCellText(vals[11]) || 'SKIPPED') as EmailDeliveryStatus;
        const smsStatus = (parseCellText(vals[14]) ||
          (emailStatus === 'ACCEPTED_BY_SMTP' ? 'DELIVERED' : 'SKIPPED')) as SmsDeliveryStatus;
        const rawCallStatus = parseCellText(vals[15]);
        const callStatus: CallStatus = rawCallStatus ? (rawCallStatus as CallStatus) : 'Disconnected';
        const rawDuration = parseCellText(vals[16]);
        const duration = rawDuration !== '' ? parseInt(rawDuration, 10) || 0 : 0;

        const log: CallLog = {
          event_id: parseCellText(vals[1]),
          timestamp: parseCellText(vals[2]),
          caller_number: parseCellText(vals[3]),
          caller_classification: (parseCellText(vals[4]).toUpperCase() === 'LEGITIMATE'
            ? 'LEGITIMATE'
            : 'SPAM'),
          caller_name: parseCellText(vals[5]),
          receiver_name: parseCellText(vals[6]),
          receiver_number: parseCellText(vals[7]),
          receiver_type: (parseCellText(vals[8]).toUpperCase() === 'PARENT'
            ? 'PARENT'
            : 'CHILD'),
          parent_recipient: parseCellText(vals[9]),
          decision: parseCellText(vals[10]),
          email_status: emailStatus,
          sms_status: smsStatus,
          details: parseCellText(vals[12]),
          error_message: vals[13] ? parseCellText(vals[13]) : undefined,
          call_status: callStatus,
          duration: duration,
        };
        if (log.event_id) {
          logs.push(log);
        }
      });

      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply filters if present
      if (filters) {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          logs = logs.filter(
            (l) =>
              l.event_id.toLowerCase().includes(q) ||
              l.caller_number.toLowerCase().includes(q) ||
              l.caller_name.toLowerCase().includes(q) ||
              l.receiver_name.toLowerCase().includes(q) ||
              l.receiver_number.toLowerCase().includes(q) ||
              l.parent_recipient.toLowerCase().includes(q) ||
              l.decision.toLowerCase().includes(q)
          );
        }
        if (filters.classification && filters.classification !== 'ALL') {
          logs = logs.filter(
            (l) => l.caller_classification.toUpperCase() === filters.classification?.toUpperCase()
          );
        }
        if (filters.receiverType && filters.receiverType !== 'ALL') {
          logs = logs.filter(
            (l) => l.receiver_type.toUpperCase() === filters.receiverType?.toUpperCase()
          );
        }
        if (filters.emailStatus && filters.emailStatus !== 'ALL') {
          logs = logs.filter(
            (l) => l.email_status.toUpperCase() === filters.emailStatus?.toUpperCase()
          );
        }
        if (filters.limit && filters.limit > 0) {
          logs = logs.slice(0, filters.limit);
        }
      }

      return logs;
    });
  }

  async getCallLogById(eventId: string): Promise<CallLog | undefined> {
    const logs = await this.getCallLogs();
    return logs.find((l) => l.event_id.toLowerCase() === eventId.toLowerCase());
  }

  async addCallLog(log: CallLog): Promise<void> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('CallLogs');
      if (!sheet) return;

      sheet.addRow([
        log.event_id,
        log.timestamp,
        log.caller_number,
        log.caller_classification,
        log.caller_name,
        log.receiver_name,
        log.receiver_number,
        log.receiver_type,
        log.parent_recipient,
        log.decision,
        log.email_status,
        log.details,
        log.error_message || '',
        log.sms_status || (log.email_status === 'ACCEPTED_BY_SMTP' ? 'DELIVERED' : 'SKIPPED'),
        log.call_status || 'Disconnected',
        log.duration !== undefined ? log.duration : 0,
      ]);
      await this.saveWorkbook(workbook);
    });
  }

  async updateCallLog(
    eventId: string,
    updates: Partial<CallLog>
  ): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('CallLogs');
      if (!sheet) return { success: false, error: 'CallLogs sheet not found' };

      let targetRow: ExcelJS.Row | null = null;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (String(vals[1] || '').trim().toLowerCase() === eventId.toLowerCase()) {
          targetRow = row;
        }
      });

      if (!targetRow) {
        return { success: false, error: `Event ID ${eventId} not found` };
      }

      if (updates.decision !== undefined) (targetRow as ExcelJS.Row).getCell(10).value = updates.decision;
      if (updates.email_status !== undefined) (targetRow as ExcelJS.Row).getCell(11).value = updates.email_status;
      if (updates.details !== undefined) (targetRow as ExcelJS.Row).getCell(12).value = updates.details;
      if (updates.error_message !== undefined) (targetRow as ExcelJS.Row).getCell(13).value = updates.error_message;
      if (updates.sms_status !== undefined) (targetRow as ExcelJS.Row).getCell(14).value = updates.sms_status;
      if (updates.call_status !== undefined) (targetRow as ExcelJS.Row).getCell(15).value = updates.call_status;
      if (updates.duration !== undefined) (targetRow as ExcelJS.Row).getCell(16).value = updates.duration;

      (targetRow as ExcelJS.Row).commit();
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async deleteCallLog(eventId: string): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('CallLogs');
      if (!sheet) return { success: false, error: 'CallLogs sheet not found' };

      let targetRowIndex = -1;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (parseCellText(vals[1]).toLowerCase() === eventId.toLowerCase()) {
          targetRowIndex = rowNumber;
        }
      });

      if (targetRowIndex === -1) {
        return { success: false, error: `Call log ${eventId} not found` };
      }

      sheet.spliceRows(targetRowIndex, 1);
      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  async clearAllCallLogs(): Promise<{ success: boolean; error?: string }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('CallLogs');
      if (!sheet) return { success: false, error: 'CallLogs sheet not found' };

      // Collect data rows (row 2 and above) and delete them from bottom to top
      const rowNumbers: number[] = [];
      sheet.eachRow((_row, rowNumber) => {
        if (rowNumber > 1) {
          rowNumbers.push(rowNumber);
        }
      });

      for (let i = rowNumbers.length - 1; i >= 0; i--) {
        sheet.spliceRows(rowNumbers[i], 1);
      }

      await this.saveWorkbook(workbook);
      return { success: true };
    });
  }

  // --- EMAIL TEMPLATE ---
  async getEmailTemplate(): Promise<EmailTemplate> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      const sheet = workbook.getWorksheet('EmailTemplate');
      if (!sheet || sheet.rowCount < 2) {
        return DEFAULT_EMAIL_TEMPLATE;
      }

      const row = sheet.getRow(2);
      const vals = row.values as any[];
      return {
        template_id: String(vals[1] || DEFAULT_EMAIL_TEMPLATE.template_id),
        template_name: String(vals[2] || DEFAULT_EMAIL_TEMPLATE.template_name),
        subject: String(vals[3] || DEFAULT_EMAIL_TEMPLATE.subject),
        body_html: String(vals[4] || DEFAULT_EMAIL_TEMPLATE.body_html),
        body_text: String(vals[5] || DEFAULT_EMAIL_TEMPLATE.body_text),
        updated_at: String(vals[6] || new Date().toISOString()),
        is_active: vals[7] === true || String(vals[7]).toLowerCase() === 'true',
      };
    });
  }

  async saveEmailTemplate(
    template: Partial<EmailTemplate>
  ): Promise<{ success: boolean; template: EmailTemplate }> {
    return fileLock.acquire(async () => {
      const workbook = await this.loadWorkbook();
      let sheet = workbook.getWorksheet('EmailTemplate');
      if (!sheet) {
        sheet = workbook.addWorksheet('EmailTemplate');
      }

      let current = DEFAULT_EMAIL_TEMPLATE;
      if (sheet.rowCount >= 2) {
        const row = sheet.getRow(2);
        const vals = row.values as any[];
        current = {
          template_id: String(vals[1] || DEFAULT_EMAIL_TEMPLATE.template_id),
          template_name: String(vals[2] || DEFAULT_EMAIL_TEMPLATE.template_name),
          subject: String(vals[3] || DEFAULT_EMAIL_TEMPLATE.subject),
          body_html: String(vals[4] || DEFAULT_EMAIL_TEMPLATE.body_html),
          body_text: String(vals[5] || DEFAULT_EMAIL_TEMPLATE.body_text),
          updated_at: String(vals[6] || new Date().toISOString()),
          is_active: vals[7] === true || String(vals[7]).toLowerCase() === 'true',
        };
      }

      const updated: EmailTemplate = {
        template_id: template.template_id || current.template_id,
        template_name: template.template_name || current.template_name,
        subject: template.subject !== undefined ? template.subject : current.subject,
        body_html: template.body_html !== undefined ? template.body_html : current.body_html,
        body_text: template.body_text !== undefined ? template.body_text : current.body_text,
        updated_at: new Date().toISOString(),
        is_active: template.is_active !== undefined ? template.is_active : current.is_active,
      };

      const row = sheet.getRow(2);
      row.getCell(1).value = updated.template_id;
      row.getCell(2).value = updated.template_name;
      row.getCell(3).value = updated.subject;
      row.getCell(4).value = updated.body_html;
      row.getCell(5).value = updated.body_text;
      row.getCell(6).value = updated.updated_at;
      row.getCell(7).value = updated.is_active;
      row.commit();

      await this.saveWorkbook(workbook);
      return { success: true, template: updated };
    });
  }

  async resetEmailTemplate(): Promise<{ success: boolean; template: EmailTemplate }> {
    return this.saveEmailTemplate(DEFAULT_EMAIL_TEMPLATE);
  }

  // --- STATS ---
  async getOverviewStats(): Promise<{
    registeredChildren: number;
    registeredParents: number;
    spamCallsSimulated: number;
    parentAlertsTriggered: number;
    emailsAcceptedBySmtp: number;
    failedNotifications: number;
    unconfiguredNotifications: number;
    totalSubscribers: number;
    recentLogs: CallLog[];
    categoryDistribution: { category: string; count: number }[];
  }> {
    const subs = await this.getSubscribers();
    const logs = await this.getCallLogs();

    const registeredChildren = subs.filter((s) => s.subscriber_type === 'CHILD').length;
    const registeredParents = subs.filter((s) => s.subscriber_type === 'PARENT').length;
    const spamCallsSimulated = logs.filter((l) => l.caller_classification === 'SPAM').length;
    const parentAlertsTriggered = logs.filter((l) => l.decision.includes('PARENT ALERT SENT')).length;
    const emailsAcceptedBySmtp = logs.filter((l) => l.email_status === 'ACCEPTED_BY_SMTP').length;
    const failedNotifications = logs.filter((l) => l.email_status === 'FAILED').length;
    const unconfiguredNotifications = logs.filter((l) => l.email_status === 'NOT_CONFIGURED').length;

    // Distribution by spam category or classification
    const categoryCount: Record<string, number> = {};
    logs.forEach((l) => {
      const cat = l.caller_classification === 'SPAM' ? (l.caller_name || 'Spam') : 'Legitimate';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const categoryDistribution = Object.entries(categoryCount).map(([category, count]) => ({
      category,
      count,
    }));

    return {
      registeredChildren,
      registeredParents,
      spamCallsSimulated,
      parentAlertsTriggered,
      emailsAcceptedBySmtp,
      failedNotifications,
      unconfiguredNotifications,
      totalSubscribers: subs.length,
      recentLogs: logs.slice(0, 7),
      categoryDistribution,
    };
  }

  // --- CSV EXPORT ---
  async exportLogsToCsv(): Promise<string> {
    const logs = await this.getCallLogs();
    const headers = [
      'Event ID',
      'Timestamp',
      'Caller Number',
      'Caller Name',
      'Classification',
      'Receiver Name',
      'Receiver Number',
      'Receiver Type',
      'Parent Recipient',
      'Decision',
      'Email Status',
      'Details',
      'Error Message',
    ];

    const escapeCsv = (val: string | undefined) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logs.map((l) =>
      [
        l.event_id,
        l.timestamp,
        l.caller_number,
        l.caller_name,
        l.caller_classification,
        l.receiver_name,
        l.receiver_number,
        l.receiver_type,
        l.parent_recipient,
        l.decision,
        l.email_status,
        l.details,
        l.error_message || '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    return [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  }
}

export const excelService = new ExcelService();
