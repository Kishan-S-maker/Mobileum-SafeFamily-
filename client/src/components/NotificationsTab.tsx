import React, { useState } from 'react';
import {
  Radio,
  Server,
  Mail,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Code,
  Send,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { SmtpStatusResponse, OverviewStats } from '../types.js';
import { api } from '../api/client.js';

interface NotificationsTabProps {
  smtpStatus: SmtpStatusResponse | null;
  stats: OverviewStats | null;
  onRefresh: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  smtpStatus,
  stats,
  onRefresh,
  showToast,
}) => {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [webhookPayload, setWebhookPayload] = useState<string>(
    JSON.stringify(
      {
        callerNumber: '+1-800-555-0191',
        callerName: 'IRS Automated Robocall',
        isSpamOverride: true,
        spamCategory: 'IRS Impersonator',
        riskScore: 98,
        receiverNumber: '+1-555-0101',
      },
      null,
      2
    )
  );
  const [webhookResponse, setWebhookResponse] = useState<string | null>(null);
  const [isFiringWebhook, setIsFiringWebhook] = useState<boolean>(false);

  // Trigger SMTP Connection check
  const handleVerifySmtp = async () => {
    setIsVerifying(true);
    try {
      await onRefresh();
      showToast('info', 'Checked SMTP connection status.');
    } catch (err: any) {
      showToast('error', err.message || 'Verification check failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Test Webhook execution
  const handleFireWebhook = async () => {
    setIsFiringWebhook(true);
    setWebhookResponse(null);
    try {
      const parsed = JSON.parse(webhookPayload);
      const res = await api.simulateCall(parsed);
      setWebhookResponse(JSON.stringify(res, null, 2));
      showToast('success', `Policy Engine processed carrier webhook event: ${res.decision}`);
      onRefresh();
    } catch (err: any) {
      setWebhookResponse(JSON.stringify({ error: err.message }, null, 2));
      showToast('error', err.message || 'Webhook simulation error');
    } finally {
      setIsFiringWebhook(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Network Header */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Radio size={20} color="var(--primary-600)" />
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-950)' }}>
                Notification Telemetry & Telecom Integration Engine
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Inspect mail delivery metrics, gateway handshakes, and carrier signaling firewall specifications.
            </p>
          </div>

          <button
            onClick={handleVerifySmtp}
            disabled={isVerifying}
            className="btn btn-secondary"
          >
            <RefreshCw size={14} className={isVerifying ? 'spin' : ''} /> Check Gateway Health
          </button>
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* ================= SMTP Gateway Diagnostics ================= */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Mail size={18} color="var(--primary-600)" />
              <div>
                <h3 className="card-title">SMTP Mail Gateway Telemetry</h3>
                <p className="card-subtitle">Nodemailer service connection & acceptance metrics</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: smtpStatus?.status.configured ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${smtpStatus?.status.configured ? '#bbf7d0' : '#fde68a'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {smtpStatus?.status.configured ? (
                  <CheckCircle2 size={18} color="#16a34a" />
                ) : (
                  <AlertTriangle size={18} color="#d97706" />
                )}
                <strong style={{ fontSize: '14px', color: 'var(--primary-950)' }}>
                  {smtpStatus?.status.configured
                    ? 'SMTP Gateway Configured'
                    : 'SMTP Not Configured (Safe Demo Mode)'}
                </strong>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                {smtpStatus?.connection.message ||
                  'No credentials supplied in .env. Simulator executes all verification logic smoothly and logs events without sending live messages.'}
              </p>
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>
                  {stats?.emailsAcceptedBySmtp || 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Accepted by SMTP</div>
              </div>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>
                  {stats?.failedNotifications || 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed Attempts</div>
              </div>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>
                  {stats?.unconfiguredNotifications || 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Safe Mode Logged</div>
              </div>
            </div>

            {/* Critical Distinction Notice */}
            <div style={{ padding: '14px', background: '#f1f5f9', borderRadius: 'var(--radius-md)', fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
              <strong>Carrier Delivery Integrity Notice:</strong>
              <p style={{ marginTop: '4px' }}>
                Our backend records <code>ACCEPTED_BY_SMTP</code> when the upstream mail server (e.g., Google Gmail SMTP or Amazon SES) acknowledges acceptance of the envelope. Final inbox delivery depends on recipient mailbox providers, DNS SPF/DKIM verification, and user spam filters.
              </p>
            </div>
          </div>
        </div>

        {/* ================= Telecom Integration Readiness ================= */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Server size={18} color="var(--primary-600)" />
              <div>
                <h3 className="card-title">Live Telecom Integration Engine</h3>
                <p className="card-subtitle">REST / Webhook API for Mobileum Spam Risk Policy Firewall</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              In real-world telco deployments, incoming SS7/SIP call signaling is intercepted by the carrier firewall and posted to this endpoint:
            </div>

            <div
              style={{
                background: '#0f172a',
                color: '#38bdf8',
                padding: '10px 14px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}
            >
              POST /api/simulate-call
            </div>

            {/* Payload Editor */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>
                <span>Incoming Carrier Event Payload (JSON):</span>
              </label>
              <textarea
                className="form-textarea"
                rows={7}
                value={webhookPayload}
                onChange={(e) => setWebhookPayload(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: '#fafafa' }}
              />
            </div>

            <button
              onClick={handleFireWebhook}
              disabled={isFiringWebhook}
              className="btn btn-primary"
              style={{ padding: '10px 16px', fontSize: '13px' }}
            >
              <Send size={14} /> {isFiringWebhook ? 'Processing in Policy Engine...' : 'Post Carrier Event to Policy Engine'}
            </button>

            {webhookResponse && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Policy Engine Dispatch Response:
                </div>
                <pre
                  style={{
                    background: '#1e293b',
                    color: '#e2e8f0',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}
                >
                  {webhookResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
