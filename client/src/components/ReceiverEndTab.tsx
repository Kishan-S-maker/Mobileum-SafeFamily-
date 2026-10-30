import React, { useState } from 'react';
import {
  Smartphone,
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Mail,
  MessageSquare,
  Baby,
  UserCheck,
  Clock,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
} from 'lucide-react';
import { Subscriber, CallStatus } from '../types.js';

interface ReceiverEndTabProps {
  subscribers: Subscriber[];
  activeCall: any | null;
  callTimer: number;
  onAnswerCall: () => void;
  onRejectCall: () => Promise<void>;
  onEndCall: () => Promise<void>;
  onSwitchToDialer: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ReceiverEndTab: React.FC<ReceiverEndTabProps> = ({
  subscribers,
  activeCall,
  callTimer,
  onAnswerCall,
  onRejectCall,
  onEndCall,
  onSwitchToDialer,
  showToast,
}) => {
  // Mobile UI controls
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);

  // Format MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Find receiver subscriber details
  const receiverSub = activeCall?.receiverId
    ? subscribers.find((s) => s.subscriber_id === activeCall.receiverId)
    : activeCall?.receiverNumber
    ? subscribers.find(
        (s) => s.phone_number.replace(/[^0-9]/g, '') === activeCall.receiverNumber.replace(/[^0-9]/g, '')
      )
    : subscribers.find((s) => s.subscriber_type === 'CHILD');

  const receiverName = activeCall?.receiverName || receiverSub?.name || 'Leo Miller';
  const receiverNumber = activeCall?.receiverNumber || receiverSub?.phone_number || '+1-555-0101';
  const receiverType = activeCall?.receiverType || receiverSub?.subscriber_type || 'CHILD';
  const isChild = receiverType === 'CHILD';
  const subscriptionStatus = receiverSub?.subscription_status || (receiverSub?.is_active ? 'Active' : 'Inactive');

  const callStatus: CallStatus = activeCall?.callStatus || 'Disconnected';
  const isIncoming = callStatus === 'Ringing' || callStatus === 'Calling';
  const isConnected = callStatus === 'Connected';
  const isDisconnected = callStatus === 'Disconnected' || callStatus === 'Rejected';
  const isSpam = activeCall?.callerClassification === 'SPAM' || activeCall?.isSpam;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Main Content Layout: Smartphone Frame + Live Telecom Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '28px', alignItems: 'start' }}>
        {/* SMARTPHONE DEVICE INTERFACE */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            className="phone-device-frame"
            style={{
              width: '100%',
              maxWidth: '380px',
              height: '700px',
              borderRadius: '44px',
              background: '#090d16',
              border: '12px solid #1e293b',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Phone Notch & Speaker */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '130px',
                height: '24px',
                background: '#1e293b',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: '40px', height: '4px', background: '#334155', borderRadius: '2px' }} />
            </div>

            {/* Status Bar */}
            <div
              style={{
                padding: '12px 24px 8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                zIndex: 10,
              }}
            >
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ color: '#38bdf8' }}>SafeFamily 5G</span>
              <span>100% 🔋</span>
            </div>

            {/* Receiver Device Header */}
            <div
              style={{
                padding: '8px 20px 14px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <strong style={{ color: '#ffffff', fontSize: '14px' }}>{receiverName}</strong>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {receiverNumber}
              </div>
            </div>

            {/* Screen Dynamic Body */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
                color: '#ffffff',
                position: 'relative',
              }}
            >
              {/* TOP: Call State & Threat Badges */}
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                {isIncoming && (
                  <div style={{ animation: 'pulse-status 1.2s infinite', marginBottom: '8px' }}>
                    <span
                      style={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.5)',
                        color: '#fbbf24',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Incoming Call...
                    </span>
                  </div>
                )}

                {isConnected && (
                  <div style={{ marginBottom: '8px' }}>
                    <span
                      style={{
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                        color: '#4ade80',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Connected • {formatTimer(callTimer)}
                    </span>
                  </div>
                )}

                {isDisconnected && (
                  <div style={{ marginBottom: '8px' }}>
                    <span
                      style={{
                        background: 'rgba(148, 163, 184, 0.2)',
                        border: '1px solid rgba(148, 163, 184, 0.4)',
                        color: '#cbd5e1',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Call {callStatus}
                    </span>
                  </div>
                )}

                {/* Threat Banner */}
                {isSpam ? (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid #ef4444',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#fca5a5',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <ShieldAlert size={18} color="#ef4444" />
                    <span>🚨 SPAM WARNING: Threat Detected!</span>
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid #22c55e',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#86efac',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <ShieldCheck size={18} color="#22c55e" />
                    <span>✅ VERIFIED SAFE CALLER</span>
                  </div>
                )}
              </div>

              {/* MIDDLE: Caller Avatar & Info */}
              <div style={{ textAlign: 'center', margin: 'auto 0' }}>
                <div
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: isSpam
                      ? 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #064e3b 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                    boxShadow: isSpam ? '0 10px 25px rgba(220, 38, 38, 0.4)' : '0 10px 25px rgba(22, 163, 74, 0.4)',
                    border: '3px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {isSpam ? <ShieldAlert size={38} color="#ffffff" /> : <ShieldCheck size={38} color="#ffffff" />}
                </div>

                <h3 style={{ margin: '0 0 4px', fontSize: '19px', fontWeight: 800, color: '#ffffff' }}>
                  {activeCall ? activeCall.callerName : 'IRS Tax Audit Threats'}
                </h3>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#94a3b8' }}>
                  {activeCall ? activeCall.callerNumber : '+1-800-555-0191'}
                </div>
                <div style={{ fontSize: '11px', color: isSpam ? '#f87171' : '#4ade80', fontWeight: 600, marginTop: '4px' }}>
                  {activeCall ? activeCall.category : (isSpam ? 'Suspected Spam' : 'Incoming Call')}
                </div>

                {/* In-Call Controls when Connected */}
                {isConnected && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      style={{
                        background: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                      title="Mute"
                    >
                      {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                      onClick={() => setIsSpeaker(!isSpeaker)}
                      style={{
                        background: isSpeaker ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                      title="Speaker"
                    >
                      {isSpeaker ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                  </div>
                )}
              </div>

              {/* BOTTOM: Action Buttons (Answer, Reject, End Call) */}
              <div style={{ paddingBottom: '16px' }}>
                {isIncoming && (
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    {/* REJECT BUTTON */}
                    <button
                      onClick={onRejectCall}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#ffffff',
                      }}
                    >
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 20px rgba(239, 68, 68, 0.5)',
                        }}
                      >
                        <PhoneOff size={24} color="#ffffff" />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Decline / Reject</span>
                    </button>

                    {/* ANSWER BUTTON */}
                    <button
                      onClick={onAnswerCall}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#ffffff',
                      }}
                    >
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 20px rgba(34, 197, 94, 0.5)',
                        }}
                      >
                        <PhoneCall size={24} color="#ffffff" />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Answer</span>
                    </button>
                  </div>
                )}

                {isConnected && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={onEndCall}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#ffffff',
                      }}
                    >
                      <div
                        style={{
                          width: '68px',
                          height: '68px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 20px rgba(239, 68, 68, 0.5)',
                        }}
                      >
                        <PhoneOff size={28} color="#ffffff" />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>End Call</span>
                    </button>
                  </div>
                )}

                {isDisconnected && (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={onSwitchToDialer}
                      className="btn"
                      style={{
                        width: '100%',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#ffffff',
                        padding: '12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        borderRadius: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Make Another Call (Spam Caller Tab)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TELECOM NOTIFICATIONS & PARENT ALERT DISPATCH STATUS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* PARENT ALERT NOTIFICATION CARD (DISCONNECTION TRIGGER) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: isSpam && isChild ? '#fee2e2' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSpam && isChild ? '#dc2626' : '#64748b',
                }}
              >
                <Mail size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Automated Parent / Guardian Alert Pipeline
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Triggered upon spam call disconnection on minor subscriber lines
                </span>
              </div>
            </div>

            {/* Official Receiver Alert Notification Banner */}
            {activeCall?.parentNotified ? (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #22c55e',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 800, fontSize: '15px' }}>
                  <CheckCircle2 size={20} />
                  <span>Warning: A spam call was detected and disconnected. Your parent/family member has been notified.</span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#166534', lineHeight: 1.5 }}>
                  The telecom security firewall intercepted the spam call targeting this child line. An automated
                  priority safety alert has been accepted by the SMTP mail gateway and dispatched to linked guardians.
                </p>
              </div>
            ) : isDisconnected && isSpam && isChild && activeCall?.emailStatus === 'FAILED' ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #ef4444',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 800, fontSize: '15px' }}>
                  <XCircle size={20} />
                  <span>Warning: A spam call was detected and disconnected. Email delivery status: Email failed.</span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#991b1b', lineHeight: 1.5 }}>
                  {activeCall?.details || 'Email alert delivery encountered an SMTP configuration or connection error.'}
                </p>
              </div>
            ) : isDisconnected && isSpam && isChild && activeCall?.emailStatus === 'NOT_CONFIGURED' ? (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 800, fontSize: '14.5px' }}>
                  <AlertTriangle size={18} />
                  <span>Warning: A spam call was detected and disconnected. (SMTP Not Configured)</span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
                  Carrier SMS simulation recorded. Provide Gmail SMTP credentials in .env to dispatch live guardian emails.
                </p>
              </div>
            ) : isDisconnected && !isSpam ? (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  color: '#475569',
                  fontSize: '13px',
                }}
              >
                <strong>Call ended:</strong> Caller was classified as LEGITIMATE. Parent safety alert bypassed.
              </div>
            ) : isDisconnected && !isChild ? (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  color: '#475569',
                  fontSize: '13px',
                }}
              >
                <strong>Call ended:</strong> Receiver is registered as an ADULT subscriber. Guardian safety alert bypassed.
              </div>
            ) : isDisconnected && isChild && subscriptionStatus === 'Inactive' ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  color: '#b91c1c',
                  fontSize: '13px',
                }}
              >
                <strong>Alert Bypassed:</strong> Child subscriber subscription status is Inactive. No guardian email sent.
              </div>
            ) : null}

            {/* Notification Delivery Audit Table */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--surface-border)',
                borderRadius: '12px',
                padding: '18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isChild ? 'Target Minor / Line' : 'Target Recipient / Line'}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-950)', marginTop: '2px' }}>
                  {receiverName} ({receiverNumber})
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Subscriber Classification
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: isChild ? '#0284c7' : '#475569', marginTop: '2px' }}>
                  {isChild ? 'CHILD (<18) Line' : 'ADULT (18+) Line'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Parent Email Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  <span
                    className={`chip ${
                      activeCall?.emailStatus === 'ACCEPTED_BY_SMTP'
                        ? 'chip-email-accepted'
                        : activeCall?.emailStatus === 'SKIPPED'
                        ? 'chip-email-skipped'
                        : activeCall?.emailStatus === 'NOT_CONFIGURED'
                        ? 'chip-email-notconfig'
                        : 'chip-email-failed'
                    }`}
                    style={{ fontSize: '11px' }}
                  >
                    {activeCall?.emailStatus ? `Email: ${activeCall.emailStatus}` : 'Email: Standing By'}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Carrier SMS Alert
                </span>
                <div style={{ marginTop: '2px' }}>
                  <span
                    className={`chip ${
                      activeCall?.smsStatus === 'DELIVERED'
                        ? 'chip-email-accepted'
                        : activeCall?.smsStatus === 'SKIPPED'
                        ? 'chip-email-skipped'
                        : 'chip-email-failed'
                    }`}
                    style={{ fontSize: '11px' }}
                  >
                    {activeCall?.smsStatus ? `SMS: ${activeCall.smsStatus}` : 'SMS: Standing By'}
                  </span>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Linked Guardian Recipients
                </span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-950)', marginTop: '2px' }}>
                  {activeCall?.parentRecipient || 'Sarah Miller (sarah.miller.parent@example.com), David Miller'}
                </div>
              </div>

              {activeCall?.messageId && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SMTP Delivery Confirmation
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                    Message ID: {activeCall.messageId}
                  </div>
                </div>
              )}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};
