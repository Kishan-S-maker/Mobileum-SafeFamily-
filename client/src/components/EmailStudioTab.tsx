import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Send,
  Eye,
  Code,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { EmailTemplate } from '../types.js';
import { api } from '../api/client.js';

interface EmailStudioTabProps {
  initialTemplate: EmailTemplate | null;
  onTemplateUpdated: (tmpl: EmailTemplate) => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const EmailStudioTab: React.FC<EmailStudioTabProps> = ({
  initialTemplate,
  onTemplateUpdated,
  showToast,
}) => {
  const [subject, setSubject] = useState<string>('');
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      setSubject(initialTemplate.subject);
      setBodyHtml(initialTemplate.body_html);
    }
  }, [initialTemplate]);

  const templateVariables = [
    { key: '{{parent_name}}', desc: 'Authorized Guardian Name (e.g. Sarah Miller)' },
    { key: '{{child_name}}', desc: 'Protected Child Line Name (e.g. Leo Miller)' },
    { key: '{{caller_number}}', desc: 'Incoming Spam Phone Number (e.g. +1-800-555-0191)' },
    { key: '{{child_phone}}', desc: "Target Child's Phone Number (e.g. +1-555-0101)" },
    { key: '{{event_time}}', desc: 'Timestamp of intercepted call' },
    { key: '{{spam_classification}}', desc: 'Category & Threat Name (e.g. IRS Impersonator)' },
  ];

  // Insert variable into active editor
  const handleInsertVariable = (varKey: string) => {
    setBodyHtml((prev) => prev + ` ${varKey} `);
    showToast('info', `Inserted ${varKey} into template body.`);
  };

  // Compile live preview using sample data
  const renderCompiledHtml = () => {
    let html = bodyHtml;
    const sampleReplacements: Record<string, string> = {
      '{{parent_name}}': 'Sarah Miller',
      '{{child_name}}': 'Leo Miller',
      '{{caller_number}}': '+1-800-555-0191',
      '{{child_phone}}': '+1-555-0101',
      '{{event_time}}': new Date().toLocaleString(),
      '{{spam_classification}}': 'IRS Tax Audit Threats (Robocall)',
    };

    for (const [key, val] of Object.entries(sampleReplacements)) {
      const reg = new RegExp(key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'), 'g');
      html = html.replace(reg, val);
    }

    return html;
  };

  // Save Template
  const handleSave = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      showToast('error', 'Subject and template body cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await api.saveEmailTemplate({
        subject,
        body_html: bodyHtml,
      });
      onTemplateUpdated(saved);
      showToast('success', 'Email alert template saved to Excel workbook (EmailTemplate sheet)!');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Template
  const handleReset = async () => {
    if (!window.confirm('Reset template to system default? Any unsaved edits will be lost.')) return;
    setIsSaving(true);
    try {
      const resetTmpl = await api.resetEmailTemplate();
      setSubject(resetTmpl.subject);
      setBodyHtml(resetTmpl.body_html);
      onTemplateUpdated(resetTmpl);
      showToast('info', 'Template reset to Mobileum default design.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reset template');
    } finally {
      setIsSaving(false);
    }
  };

  // Send Test Email
  const handleSendTestEmail = async () => {
    if (!testEmailRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmailRecipient.trim())) {
      showToast('error', 'Please enter a valid recipient email address.');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      // First save current draft to ensure test email uses active modifications
      await api.saveEmailTemplate({ subject, body_html: bodyHtml });

      const res = await api.sendTestEmail(testEmailRecipient.trim());
      if (res.success) {
        setTestResult({
          success: true,
          type: 'success',
          message: `Test email successfully accepted by SMTP server for ${testEmailRecipient}! Message ID: ${res.messageId || 'OK'}`,
        });
        showToast('success', 'Test email dispatched through SMTP gateway!');
      } else if (res.notConfigured) {
        setTestResult({
          success: false,
          type: 'warning',
          message: `SMTP credentials are not configured in your .env file. Real email delivery requires SMTP_HOST, SMTP_USER, and SMTP_PASS.`,
        });
        showToast('warning', 'SMTP credentials not configured in environment.');
      } else {
        setTestResult({
          success: false,
          type: 'error',
          message: `SMTP Error: ${res.error || 'Connection failure'}`,
        });
        showToast('error', `Failed: ${res.error || 'SMTP Error'}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        type: 'error',
        message: err.message || 'Network error sending test email',
      });
      showToast('error', err.message || 'Send error');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Studio Header */}
      <div className="card" style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-950)' }}>
              Email Customization Studio
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Design and preview the security dispatch email delivered to parents when minor lines receive spam calls.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="btn btn-secondary"
              title="Reset template to default telecom design"
            >
              <RotateCcw size={15} /> Reset to Default
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
            >
              <Save size={15} /> {isSaving ? 'Saving to Excel...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Editor & Preview Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* ================= LEFT: TEMPLATE EDITOR ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Subject Line */}
          <div className="card">
            <label className="form-label" style={{ marginBottom: '8px' }}>
              <span>Email Subject Line:</span>
              <span className="telecom-pill">Supports Variables</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. 🚨 CHILD SAFETY ALERT: Suspected Spam Call to {{child_name}}"
              style={{ width: '100%', fontWeight: 600 }}
            />
          </div>

          {/* Template Variables Helper */}
          <div className="card">
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Click to Insert Template Variables:
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {templateVariables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => handleInsertVariable(v.key)}
                  className="btn btn-secondary"
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    borderRadius: '6px',
                  }}
                  title={v.desc}
                >
                  <Code size={12} /> {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* HTML Template Body Multiline Editor */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div className="card-title-group">
                <Code size={18} color="var(--primary-600)" />
                <div>
                  <h3 className="card-title">HTML & Plain Text Template Body</h3>
                  <p className="card-subtitle">Multiline responsive layout markup</p>
                </div>
              </div>
            </div>

            <textarea
              className="form-textarea"
              rows={16}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: '1.5',
                width: '100%',
                resize: 'vertical',
                background: '#fafafa',
              }}
            />
          </div>

          {/* Real Test Email Delivery Box */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary-950)', marginBottom: '8px' }}>
              Send Live Test Email via SMTP
            </h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Dispatches this exact customized alert to your personal inbox using the backend Nodemailer engine.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="email"
                className="form-input"
                placeholder="Send Preview to My Email (e.g. you@example.com)"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                <Send size={15} /> {isSendingTest ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>

            {testResult && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    testResult.type === 'success'
                      ? '#f0fdf4'
                      : testResult.type === 'warning'
                      ? '#fffbeb'
                      : '#fef2f2',
                  border: `1px solid ${
                    testResult.type === 'success'
                      ? '#bbf7d0'
                      : testResult.type === 'warning'
                      ? '#fde68a'
                      : '#fecaca'
                  }`,
                  fontSize: '12.5px',
                  color:
                    testResult.type === 'success'
                      ? '#166534'
                      : testResult.type === 'warning'
                      ? '#92400e'
                      : '#991b1b',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                {testResult.type === 'success' && <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                {testResult.type === 'warning' && <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                {testResult.type === 'error' && <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                <div>{testResult.message}</div>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT: LIVE EMAIL PREVIEW ================= */}
        <div className="card" style={{ position: 'sticky', top: '100px' }}>
          <div className="card-header">
            <div className="card-title-group">
              <Eye size={18} color="var(--primary-600)" />
              <div>
                <h3 className="card-title">Live Mail Client Preview</h3>
                <p className="card-subtitle">Rendered with active sample subscriber values</p>
              </div>
            </div>
            <span className="telecom-pill">Live Preview</span>
          </div>

          {/* Fake Email Client Chrome */}
          <div
            style={{
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: '#f8fafc',
            }}
          >
            {/* Header / Subject */}
            <div
              style={{
                background: '#ffffff',
                borderBottom: '1px solid var(--surface-border)',
                padding: '14px 18px',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <strong>Subject:</strong> {subject.replace('{{child_name}}', 'Leo Miller')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <strong>From:</strong> "SafeFamily Telecom Alert" &lt;noreply@telecom-security.net&gt;
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <strong>To:</strong> Sarah Miller &lt;sarah.miller.parent@example.com&gt;
              </div>
            </div>

            {/* Email HTML Body Canvas */}
            <div
              style={{
                padding: '20px',
                background: '#e2e8f0',
                minHeight: '440px',
                maxHeight: '600px',
                overflowY: 'auto',
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: renderCompiledHtml() }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
