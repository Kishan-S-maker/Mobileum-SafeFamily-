import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  Eye,
  RefreshCw,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { CallLog } from '../types.js';
import { LogDetailsModal } from './LogDetailsModal.js';
import { api } from '../api/client.js';

interface CallLogsTabProps {
  logs: CallLog[];
  onRefresh: () => void;
  isLoading: boolean;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const CallLogsTab: React.FC<CallLogsTabProps> = ({
  logs,
  onRefresh,
  isLoading,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [receiverTypeFilter, setReceiverTypeFilter] = useState<string>('ALL');
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>('ALL');
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Filter logs locally with case-insensitive and alias-aware checks
  const filteredLogs = logs.filter((log) => {
    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const match =
        (log.event_id || '').toLowerCase().includes(q) ||
        (log.caller_number || '').toLowerCase().includes(q) ||
        (log.caller_name || '').toLowerCase().includes(q) ||
        (log.receiver_name || '').toLowerCase().includes(q) ||
        (log.receiver_number || '').toLowerCase().includes(q) ||
        (log.parent_recipient || '').toLowerCase().includes(q) ||
        (log.decision || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    // Classification
    if (classificationFilter !== 'ALL') {
      const cls = (log.caller_classification || '').toUpperCase();
      if (classificationFilter === 'SPAM' && !cls.includes('SPAM')) return false;
      if (classificationFilter === 'LEGITIMATE' && cls.includes('SPAM')) return false;
    }

    // Receiver Type
    if (receiverTypeFilter !== 'ALL') {
      const rType = (log.receiver_type || '').toUpperCase();
      if (receiverTypeFilter === 'CHILD' && !rType.includes('CHILD') && !rType.includes('MINOR')) return false;
      if (receiverTypeFilter === 'PARENT' && !rType.includes('PARENT') && !rType.includes('ADULT')) return false;
    }

    // Email Status
    if (emailStatusFilter !== 'ALL') {
      const eStat = (log.email_status || '').toUpperCase();
      if (emailStatusFilter === 'SENT') {
        if (!eStat.includes('ACCEPTED') && !eStat.includes('DELIVERED') && !eStat.includes('SENT')) return false;
      } else if (emailStatusFilter === 'SKIPPED') {
        if (!eStat.includes('SKIP')) return false;
      } else if (emailStatusFilter === 'FAILED') {
        if (!eStat.includes('FAIL')) return false;
      } else if (emailStatusFilter === 'NOT_CONFIGURED') {
        if (!eStat.includes('NOT') && !eStat.includes('CONFIG')) return false;
      }
    }

    return true;
  });

  // Bulk Delete Call Logs
  const handleBulkDeleteLogs = async () => {
    if (selectedEventIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedEventIds.length} selected call log record(s) from Excel?`)) return;

    try {
      await api.bulkDeleteCallLogs(selectedEventIds);
      showToast('success', `Successfully deleted ${selectedEventIds.length} call log record(s).`);
      setSelectedEventIds([]);
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete selected call logs');
    }
  };

  // Individual Delete Call Log
  const handleDeleteLog = async (log: CallLog) => {
    if (!window.confirm(`Delete call log record ${log.event_id}? This will remove it from the Excel CallLogs sheet.`)) {
      return;
    }
    try {
      await api.deleteCallLog(log.event_id);
      showToast('success', `Deleted call log ${log.event_id} from Excel workbook.`);
      setSelectedEventIds((prev) => prev.filter((id) => id !== log.event_id));
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete call log');
    }
  };

  // Clear All Call Logs with confirmation
  const handleClearAllLogs = async () => {
    const confirmMsg =
      'Are you sure you want to CLEAR ALL call logs in the Excel CallLogs sheet?\n\n' +
      '• All call history and delivery audits will be deleted.\n' +
      '• Subscriber records and Spam numbers will NOT be affected.\n\n' +
      'Click OK to confirm permanent deletion.';

    if (!window.confirm(confirmMsg)) return;

    setIsClearing(true);
    try {
      await api.clearAllCallLogs();
      showToast('success', 'All call logs successfully cleared from Excel workbook.');
      setSelectedEventIds([]);
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to clear call logs');
    } finally {
      setIsClearing(false);
    }
  };

  // Format Duration seconds
  const formatDuration = (secs?: number) => {
    if (secs === undefined || secs === null || secs === 0) return '0s';
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (mins > 0) return `${mins}m ${rem}s`;
    return `${rem}s`;
  };

  // Handle retry
  const handleRetry = async (eventId: string) => {
    setIsRetrying(true);
    try {
      const res = await api.retryNotification(eventId);
      if (res.success) {
        showToast('success', res.message);
        onRefresh();
        setSelectedLog(null);
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Filter and Search Bar */}
      <div className="card" style={{ padding: '18px 24px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 240px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by caller, receiver, ID, or decision..."
                className="form-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '34px', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <select
              className="form-select"
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="ALL">All Classifications</option>
              <option value="SPAM">SPAM Threats Only</option>
              <option value="LEGITIMATE">LEGITIMATE Calls Only</option>
            </select>

            <select
              className="form-select"
              value={receiverTypeFilter}
              onChange={(e) => setReceiverTypeFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="ALL">All Receiver Lines</option>
              <option value="CHILD">Child Line Calls</option>
              <option value="PARENT">Adult Line Calls</option>
            </select>

            <select
              className="form-select"
              value={emailStatusFilter}
              onChange={(e) => setEmailStatusFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="ALL">All Email States</option>
              <option value="SENT">Sent / Delivered</option>
              <option value="SKIPPED">Skipped</option>
              <option value="FAILED">Failed</option>
              <option value="NOT_CONFIGURED">Not Configured</option>
            </select>

            {/* Bulk Delete Selected Logs */}
            {selectedEventIds.length > 0 && (
              <button
                onClick={handleBulkDeleteLogs}
                disabled={isClearing}
                className="btn btn-outline-danger"
                style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Delete selected call log records from Excel"
              >
                <Trash2 size={14} /> Delete Selected ({selectedEventIds.length})
              </button>
            )}

            {/* Clear All Logs Action Button */}
            <button
              onClick={handleClearAllLogs}
              disabled={isClearing || logs.length === 0}
              className="btn btn-outline-danger"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              title="Clear all call log records from Excel workbook"
            >
              <Trash2 size={14} /> Clear All Records
            </button>

            {/* CSV Download */}
            <a
              href={api.getExportLogsUrl()}
              download
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '13px', textDecoration: 'none' }}
              title="Download CSV report"
            >
              <Download size={14} /> Export CSV
            </a>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              title="Refresh logs from Excel"
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', overflowX: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredLogs.length > 0 && selectedEventIds.length === filteredLogs.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEventIds(filteredLogs.map((l) => l.event_id));
                      } else {
                        setSelectedEventIds([]);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Select all logs"
                  />
                </th>
                <th style={{ width: '13%' }}>Time / Event ID</th>
                <th style={{ width: '15%' }}>Caller Details</th>
                <th style={{ width: '11%' }}>Classification</th>
                <th style={{ width: '16%' }}>Protected Receiver</th>
                <th style={{ width: '13%' }}>Call Status & Time</th>
                <th style={{ width: '22%' }}>Parent Alert & Decision</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Reading call logs from Excel workbook...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={32} color="#94a3b8" />
                      <div style={{ fontWeight: 600 }}>No matching call log records found</div>
                      <div style={{ fontSize: '12px' }}>
                        Try clearing active filters or trigger a call simulation.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.event_id}
                    style={{
                      background: selectedEventIds.includes(log.event_id) ? 'rgba(59, 130, 246, 0.05)' : undefined,
                    }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedEventIds.includes(log.event_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEventIds((prev) => [...prev, log.event_id]);
                          } else {
                            setSelectedEventIds((prev) => prev.filter((id) => id !== log.event_id));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    {/* Time / ID */}
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--primary-900)' }}>
                        {log.event_id}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </td>

                    {/* Caller */}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.caller_name || 'Caller'}>
                        {log.caller_name || 'Caller'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {log.caller_number}
                      </div>
                    </td>

                    {/* Classification */}
                    <td>
                      <span
                        className={`chip ${
                          log.caller_classification === 'SPAM' ? 'chip-spam' : 'chip-legit'
                        }`}
                        style={{ fontSize: '10.5px', padding: '3px 8px' }}
                      >
                        {log.caller_classification === 'SPAM' ? '🚨 SPAM' : '✅ SAFE'}
                      </span>
                    </td>

                    {/* Receiver */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.receiver_name}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: log.receiver_type === 'CHILD' ? '#e0f2fe' : '#f1f5f9',
                            color: log.receiver_type === 'CHILD' ? '#0369a1' : '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {log.receiver_type === 'CHILD' ? 'Child' : 'Adult'}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {log.receiver_number}
                      </div>
                    </td>

                    {/* Call Status & Duration */}
                    <td>
                      <div
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color:
                            log.call_status === 'Connected'
                              ? '#15803d'
                              : log.call_status === 'Rejected'
                              ? '#b91c1c'
                              : '#475569',
                        }}
                      >
                        {log.call_status || 'Disconnected'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        ⏱️ {formatDuration(log.duration)}
                      </div>
                    </td>

                    {/* Parent Alert & Decision */}
                    <td>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.parent_recipient}>
                        {log.parent_recipient}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
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
                          style={{ fontSize: '9.5px', padding: '1px 6px' }}
                        >
                          {log.email_status === 'ACCEPTED_BY_SMTP' ? 'Sent' : log.email_status}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.decision}>
                          {log.decision}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="View event audit details"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log)}
                          className="btn btn-outline-danger"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Delete call log record"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Audit Modal */}
      <LogDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    </div>
  );
};
