import React from 'react';
import {
  Baby,
  UserCheck,
  ShieldAlert,
  Send,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import { OverviewStats, CallLog } from '../types.js';

interface OverviewTabProps {
  stats: OverviewStats | null;
  onNavigateToSimulator: () => void;
  onNavigateToLogs: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  onNavigateToSimulator,
  onNavigateToLogs,
}) => {
  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        Loading overview metrics from Excel workbook...
      </div>
    );
  }

  const kpis = [
    {
      label: 'Registered Children',
      value: stats.registeredChildren,
      icon: <Baby size={24} color="#0284c7" />,
      bg: '#e0f2fe',
      subtext: 'Active minor lines protected',
    },
    {
      label: 'Registered Parents',
      value: stats.registeredParents,
      icon: <UserCheck size={24} color="#7c3aed" />,
      bg: '#f3e8ff',
      subtext: 'Linked authorized guardians',
    },
    {
      label: 'Spam Calls Simulated',
      value: stats.spamCallsSimulated,
      icon: <ShieldAlert size={24} color="#dc2626" />,
      bg: '#fee2e2',
      subtext: 'Threats flagged by engine',
    },
    {
      label: 'Parent Alerts Triggered',
      value: stats.parentAlertsTriggered,
      icon: <Send size={24} color="#2563eb" />,
      bg: '#dbeafe',
      subtext: 'Minor defense events',
    },
    {
      label: 'Accepted by SMTP',
      value: stats.emailsAcceptedBySmtp,
      icon: <CheckCircle2 size={24} color="#16a34a" />,
      bg: '#dcfce7',
      subtext: 'Confirmed mail gateway receipts',
    },
    {
      label: 'Failed / Unconfigured',
      value: stats.failedNotifications + stats.unconfiguredNotifications,
      icon: <AlertOctagon size={24} color="#d97706" />,
      bg: '#fef3c7',
      subtext: stats.unconfiguredNotifications > 0 ? `${stats.unconfiguredNotifications} safe mode / pending SMTP` : 'Requires retry',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {kpis.map((kpi, idx) => (
          <div key={idx} className="kpi-card">
            <div className="kpi-icon" style={{ background: kpi.bg }}>
              {kpi.icon}
            </div>
            <div>
              <div className="kpi-val">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                {kpi.subtext}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Recent Events Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Clock size={18} color="var(--primary-600)" />
              <div>
                <h3 className="card-title">Recent Intercepted Events</h3>
                <p className="card-subtitle">Real-time log derived from Excel workbook</p>
              </div>
            </div>
            <button
              onClick={onNavigateToLogs}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              View All Logs
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Caller</th>
                  <th>Classification</th>
                  <th>Receiver</th>
                  <th>Decision</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No call events logged yet. Try triggering a simulation!
                    </td>
                  </tr>
                ) : (
                  stats.recentLogs.map((log: CallLog) => (
                    <tr key={log.event_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>
                        {log.event_id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.caller_name || 'Caller'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {log.caller_number}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`chip ${
                            log.caller_classification === 'SPAM' ? 'chip-spam' : 'chip-legit'
                          }`}
                        >
                          {log.caller_classification}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.receiver_name}</div>
                        <span
                          className={`chip ${
                            log.receiver_type === 'CHILD' ? 'chip-child' : 'chip-parent'
                          }`}
                          style={{ fontSize: '10px', padding: '2px 6px' }}
                        >
                          {log.receiver_type}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.decision}
                      </td>
                      <td>
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Threat Distribution Chart & Architecture Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <TrendingUp size={18} color="var(--primary-600)" />
                <div>
                  <h3 className="card-title">Threat Breakdown</h3>
                  <p className="card-subtitle">Volume by intercepted caller category</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {stats.categoryDistribution.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  No category telemetry available yet.
                </div>
              ) : (
                stats.categoryDistribution.map((cat, i) => {
                  const total = stats.categoryDistribution.reduce((acc, curr) => acc + curr.count, 0);
                  const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
                  return (
                    <div key={i}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ color: 'var(--text-main)' }}>{cat.category}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {cat.count} calls ({pct}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: '8px',
                          background: '#f1f5f9',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background:
                              cat.category === 'Legitimate'
                                ? '#16a34a'
                                : 'linear-gradient(90deg, #f59e0b 0%, #dc2626 100%)',
                            borderRadius: '9999px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
