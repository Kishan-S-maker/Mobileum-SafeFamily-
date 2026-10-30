import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { Navigation, NavTabId } from './components/Navigation.js';
import { OverviewTab } from './components/OverviewTab.js';
import { SpamCallerTab } from './components/SpamCallerTab.js';
import { ReceiverEndTab } from './components/ReceiverEndTab.js';
import { CallLogsTab } from './components/CallLogsTab.js';
import { SubscribersTab } from './components/SubscribersTab.js';
import { EmailStudioTab } from './components/EmailStudioTab.js';
import { ToastContainer, ToastMessage } from './components/Toast.js';
import { api } from './api/client.js';
import {
  Subscriber,
  ParentChildMapping,
  SpamNumber,
  CallLog,
  EmailTemplate,
  OverviewStats,
  SmtpStatusResponse,
  CallStatus,
} from './types.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>('spam-caller'); // Default to Spam Caller dialer
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [mappings, setMappings] = useState<ParentChildMapping[]>([]);
  const [spamNumbers, setSpamNumbers] = useState<SpamNumber[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse | null>(null);

  // Shared Active Call Session state across Spam Caller and Receiver End tabs
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [callTimer, setCallTimer] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast Helper
  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch all initial data from Excel backend
  const fetchAllData = useCallback(async () => {
    try {
      const [subsData, spamData, logsData, tmplData, statsData, smtpData] =
        await Promise.all([
          api.getSubscribers(),
          api.getSpamNumbers(),
          api.getCallLogs(),
          api.getEmailTemplate(),
          api.getStats(),
          api.getSmtpStatus(),
        ]);

      setSubscribers(subsData.subscribers);
      setMappings(subsData.mappings);
      setSpamNumbers(spamData);
      setCallLogs(logsData);
      setEmailTemplate(tmplData);
      setOverviewStats(statsData);
      setSmtpStatus(smtpData);
    } catch (err: any) {
      console.error('[App] Failed to fetch data:', err);
      showToast('error', `Failed to sync with backend: ${err.message || 'Network error'}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Live Call Duration Timer when Connected
  useEffect(() => {
    let interval: any = null;
    if (activeCall?.callStatus === 'Connected') {
      interval = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall?.callStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    showToast('info', 'Synchronized latest data with Excel workbook.');
  };

  // 1. INITIATE CALL (From Dialer)
  const handleInitiateCall = async (
    callerNumber: string,
    callerName: string,
    receiverNumber: string,
    receiverId?: string
  ) => {
    setCallTimer(0);
    const res = await api.initiateCall({ callerNumber, callerName, receiverNumber, receiverId });
    if (res.success && res.session) {
      setActiveCall(res.session);
      showToast(
        'info',
        `Call ringing on ${res.session.receiverName}'s phone! Switch to Receiver End tab to answer or inspect.`
      );
    }
  };

  // 2. ANSWER CALL (From Receiver End)
  const handleAnswerCall = () => {
    if (!activeCall) return;
    setActiveCall((prev: any) => ({ ...prev, callStatus: 'Connected' }));
    showToast('success', `Call connected with ${activeCall.callerName}. Duration timer active.`);
  };

  // 3. REJECT CALL (From Receiver End)
  const handleRejectCall = async () => {
    await handleDisconnectSession('Rejected');
  };

  // 4. END CALL (From Caller or Receiver)
  const handleEndCall = async () => {
    await handleDisconnectSession('Disconnected');
  };

  // Helper: Terminate Call & Trigger Parent Disconnect Alert Workflow
  const handleDisconnectSession = async (status: 'Disconnected' | 'Rejected') => {
    if (!activeCall) return;

    try {
      const res = await api.disconnectCall({
        eventId: activeCall.eventId,
        callerNumber: activeCall.callerNumber,
        callerName: activeCall.callerName,
        callerClassification: activeCall.callerClassification,
        receiverId: activeCall.receiverId,
        receiverNumber: activeCall.receiverNumber,
        receiverName: activeCall.receiverName,
        receiverType: activeCall.receiverType,
        duration: callTimer,
        callStatus: status,
      });

      // Update active session with final delivery state
      setActiveCall((prev: any) => ({
        ...prev,
        callStatus: status,
        duration: callTimer,
        emailStatus: res.emailStatus,
        smsStatus: res.smsStatus,
        parentNotified: res.parentNotified,
        decision: res.decision,
        details: res.details,
        parentRecipient: res.parentRecipient,
        messageId: res.messageId,
      }));

      // Immediately refresh call logs and stats from Excel
      const [logsData, statsData] = await Promise.all([api.getCallLogs(), api.getStats()]);
      setCallLogs(logsData);
      setOverviewStats(statsData);

      if (res.parentNotified) {
        showToast(
          'success',
          'Spam call disconnected. Parent guardian notified via Email & SMS!'
        );
      } else if (res.emailStatus === 'FAILED') {
        showToast('error', 'Spam call disconnected, but guardian email delivery failed.');
      } else {
        showToast('info', `Call ${status.toLowerCase()}. Logged to Excel CallLogs sheet.`);
      }
    } catch (err: any) {
      console.error('[App] Disconnect call error:', err);
      showToast('error', err.message || 'Error disconnecting call');
    }
  };

  return (
    <div className="app-container">
      {/* Top Application Bar */}
      <Header
        smtpStatus={smtpStatus}
        onRefreshAll={handleRefresh}
        isRefreshing={isRefreshing}
        callLogs={callLogs}
        onNavigateToLogs={() => setActiveTab('logs')}
      />

      {/* Main Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        logsCount={callLogs.length}
        subscribersCount={subscribers.filter((s) => s.subscriber_type === 'CHILD').length}
        activeCallStatus={activeCall?.callStatus}
      />

      {/* Dynamic Tab Workspace */}
      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewTab
            stats={overviewStats}
            onNavigateToSimulator={() => setActiveTab('spam-caller')}
            onNavigateToLogs={() => setActiveTab('logs')}
          />
        )}

        {activeTab === 'spam-caller' && (
          <SpamCallerTab
            subscribers={subscribers}
            spamNumbers={spamNumbers}
            activeCall={activeCall}
            callTimer={callTimer}
            onInitiateCall={handleInitiateCall}
            onEndCall={handleEndCall}
            onSwitchToReceiver={() => setActiveTab('receiver-end')}
            onRefreshData={handleRefresh}
            showToast={showToast}
          />
        )}

        {activeTab === 'receiver-end' && (
          <ReceiverEndTab
            subscribers={subscribers}
            activeCall={activeCall}
            callTimer={callTimer}
            onAnswerCall={handleAnswerCall}
            onRejectCall={handleRejectCall}
            onEndCall={handleEndCall}
            onSwitchToDialer={() => setActiveTab('spam-caller')}
            showToast={showToast}
          />
        )}

        {activeTab === 'logs' && (
          <CallLogsTab
            logs={callLogs}
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
            showToast={showToast}
          />
        )}

        {activeTab === 'subscribers' && (
          <SubscribersTab
            subscribers={subscribers}
            mappings={mappings}
            onRefresh={handleRefresh}
            showToast={showToast}
          />
        )}

        {activeTab === 'email-studio' && (
          <EmailStudioTab
            initialTemplate={emailTemplate}
            onTemplateUpdated={(newTmpl) => setEmailTemplate(newTmpl)}
            showToast={showToast}
          />
        )}
      </main>

      {/* Toast Alert Feedback */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
