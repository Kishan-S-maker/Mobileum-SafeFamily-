import React, { useState } from 'react';
import { Bell, X, ShieldAlert, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { SmtpStatusResponse, CallLog } from '../types.js';

interface HeaderProps {
  smtpStatus: SmtpStatusResponse | null;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  callLogs?: CallLog[];
  onNavigateToLogs?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  smtpStatus,
  onRefreshAll,
  isRefreshing,
  callLogs = [],
  onNavigateToLogs,
}) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Filter spam threat notifications
  const threatNotifications = callLogs.filter(
    (l) => l.caller_classification === 'SPAM' || l.decision.includes('PARENT ALERT')
  );

  return (
    <header className="top-header" style={{ position: 'relative' }}>
      <div className="header-inner">
        {/* Top Left Brand Section with Mobileum Logo */}
        <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              padding: '2px',
            }}
          >
            <img
              src="/mobileum-logo.png"
              alt="Mobileum"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                // Fallback if public folder image load fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="brand-title" style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--primary-950)' }}>
              Mobileum SafeFamily
            </h1>
          </div>
        </div>

        {/* Top Right Group: Sync Excel + Notifications Bell */}
        <div className="header-status-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Refresh / Sync Button */}
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ padding: '7px 14px', fontSize: '13px' }}
            title="Reload data from Excel workbook"
          >
            {isRefreshing ? 'Refreshing...' : 'Sync Excel'}
          </button>

          {/* Notification Bell Icon */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="btn btn-secondary"
              style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isNotificationsOpen ? '#eff6ff' : '#ffffff',
                border: isNotificationsOpen ? '1px solid #3b82f6' : '1px solid var(--surface-border)',
                cursor: 'pointer',
              }}
              title="View all notifications"
            >
              <Bell size={18} color={isNotificationsOpen ? '#2563eb' : '#475569'} />
              {threatNotifications.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 800,
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  {threatNotifications.length > 99 ? '99+' : threatNotifications.length}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            {isNotificationsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '50px',
                  right: 0,
                  width: '380px',
                  maxWidth: '90vw',
                  background: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                  zIndex: 99999,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Popover Header */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--surface-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={16} color="#2563eb" />
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary-950)' }}>
                      Notifications & Alerts
                    </span>
                    <span
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '9999px',
                      }}
                    >
                      {threatNotifications.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsNotificationsOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Notifications List */}
                <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
                  {threatNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={28} color="#22c55e" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>No active security alerts</div>
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>
                        Minor subscriber lines are protected.
                      </div>
                    </div>
                  ) : (
                    threatNotifications.slice(0, 10).map((log) => (
                      <div
                        key={log.event_id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#dc2626',
                              background: '#fee2e2',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            🚨 SPAM INTERCEPTED
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--primary-950)' }}>
                          {log.caller_name || 'Spam Caller'} ({log.caller_number})
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#475569' }}>
                          Target: <strong>{log.receiver_name}</strong> • Alert: {log.decision}
                        </div>

                        {log.parent_recipient && (
                          <div style={{ fontSize: '10.5px', color: '#0369a1', marginTop: '1px' }}>
                            ✉ Dispatched to: {log.parent_recipient}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Popover Footer */}
                {onNavigateToLogs && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderTop: '1px solid var(--surface-border)',
                      background: '#f8fafc',
                      textAlign: 'center',
                    }}
                  >
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        onNavigateToLogs();
                      }}
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>View All Call Logs & Delivery Audits</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
