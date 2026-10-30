import React from 'react';
import { X, ShieldAlert, ShieldCheck, Mail, Clock, Phone, User, CheckCircle2, AlertOctagon } from 'lucide-react';
import { CallLog } from '../types.js';

interface LogDetailsModalProps {
  log: CallLog | null;
  onClose: () => void;
  onRetry: (eventId: string) => void;
  isRetrying: boolean;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({
  log,
  onClose,
  onRetry,
  isRetrying,
}) => {
  if (!log) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {log.caller_classification === 'SPAM' ? (
              <ShieldAlert size={22} color="#dc2626" />
            ) : (
              <ShieldCheck size={22} color="#16a34a" />
            )}
            <div>
              <h3 className="modal-title">Event Audit: {log.event_id}</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Captured on {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Decision Summary Banner */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background:
                log.caller_classification === 'SPAM' && log.receiver_type === 'CHILD'
                  ? '#fef2f2'
                  : '#f0fdf4',
              border: `1px solid ${
                log.caller_classification === 'SPAM' && log.receiver_type === 'CHILD'
                  ? '#fecaca'
                  : '#bbf7d0'
              }`,
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Policy Resolution Decision
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary-950)' }}>
              {log.decision}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px', lineHeight: '1.4' }}>
              {log.details}
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                <Phone size={14} /> Caller Identification
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{log.caller_name || 'Caller'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#475569' }}>
                {log.caller_number}
              </div>
              <div style={{ marginTop: '6px' }}>
                <span className={`chip ${log.caller_classification === 'SPAM' ? 'chip-spam' : 'chip-legit'}`}>
                  {log.caller_classification}
                </span>
              </div>
            </div>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                <User size={14} /> Receiving Line
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{log.receiver_name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#475569' }}>
                {log.receiver_number}
              </div>
              <div style={{ marginTop: '6px' }}>
                <span className={`chip ${log.receiver_type === 'CHILD' ? 'chip-child' : 'chip-parent'}`}>
                  {log.receiver_type} Line
                </span>
              </div>
            </div>
          </div>

          {/* Guardian Alert Dispatch Info */}
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <Mail size={14} /> Authorized Guardian Notification Target
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--primary-950)' }}>
              {log.parent_recipient}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Email Status:</span>
                <span
                  className={`chip ${
                    log.email_status === 'ACCEPTED_BY_SMTP'
                      ? 'chip-email-accepted'
                      : log.email_status === 'SKIPPED'
                      ? 'chip-email-skipped'
                      : log.email_status === 'NOT_CONFIGURED'
                      ? 'chip-email-notconfig'
                      : 'chip-email-failed'
                  }`}
                >
                  {log.email_status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Carrier SMS:</span>
                <span
                  className={`chip ${
                    log.sms_status === 'DELIVERED'
                      ? 'chip-email-accepted'
                      : log.sms_status === 'SKIPPED'
                      ? 'chip-email-skipped'
                      : 'chip-email-failed'
                  }`}
                >
                  {log.sms_status || (log.email_status === 'ACCEPTED_BY_SMTP' ? 'DELIVERED' : 'SKIPPED')}
                </span>
              </div>
            </div>

            {log.error_message && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', color: '#b91c1c' }}>
                <strong>Error Details:</strong> {log.error_message}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            {log.caller_classification === 'SPAM' &&
              log.receiver_type === 'CHILD' &&
              (log.email_status === 'FAILED' || log.email_status === 'NOT_CONFIGURED') && (
                <button
                  onClick={() => onRetry(log.event_id)}
                  disabled={isRetrying}
                  className="btn btn-primary"
                  style={{ fontSize: '13px' }}
                >
                  {isRetrying ? 'Retrying Transmission...' : 'Retry Email Alert'}
                </button>
              )}
            <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: '13px' }}>
              Close Audit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
