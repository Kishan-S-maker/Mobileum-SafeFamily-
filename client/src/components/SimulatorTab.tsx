import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Wifi,
  Signal,
  Battery,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Mail,
  Mic,
  Volume2,
  Grid,
  Radio,
  Plus,
  Shield,
  Send,
} from 'lucide-react';
import {
  Subscriber,
  SpamNumber,
  SimulationResult,
  SimulationStep,
  DecisionCode,
} from '../types.js';
import { api } from '../api/client.js';

interface SimulatorTabProps {
  subscribers: Subscriber[];
  spamNumbers: SpamNumber[];
  onSimulationComplete: (res: SimulationResult) => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  onRefreshData?: () => void;
}

export const SimulatorTab: React.FC<SimulatorTabProps> = ({
  subscribers,
  spamNumbers,
  onSimulationComplete,
  showToast,
  onRefreshData,
}) => {
  // Simulator form state
  const [selectedCallerId, setSelectedCallerId] = useState<string>('');
  const [selectedReceiverId, setSelectedReceiverId] = useState<string>('');
  const [isCustomCaller, setIsCustomCaller] = useState<boolean>(false);
  const [customCallerNumber, setCustomCallerNumber] = useState<string>('+1-800-777-9911');
  const [customCallerName, setCustomCallerName] = useState<string>('Pre-approved Loan Scam');
  const [customIsSpam, setCustomIsSpam] = useState<boolean>(true);
  const [customCategory, setCustomCategory] = useState<string>('Robocall Scam');
  const [customRiskScore, setCustomRiskScore] = useState<number>(90);

  // Quick Add Modal state
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState<boolean>(false);
  const [quickAddType, setQuickAddType] = useState<'SPAM' | 'CHILD' | 'ADULT'>('SPAM');
  const [quickAddName, setQuickAddName] = useState<string>('');
  const [quickAddPhone, setQuickAddPhone] = useState<string>('+1-555-');
  const [quickAddEmail, setQuickAddEmail] = useState<string>('');
  const [quickAddCategory, setQuickAddCategory] = useState<string>('Phishing Scam');
  const [quickAddRisk, setQuickAddRisk] = useState<number>(85);
  const [isSubmittingQuickAdd, setIsSubmittingQuickAdd] = useState<boolean>(false);

  // Phone Call Visual Interaction State
  // 'idle' | 'calling' | 'incoming' | 'active' | 'declined'
  const [phoneCallState, setPhoneCallState] = useState<'idle' | 'calling' | 'incoming' | 'active' | 'declined'>('incoming');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);

  // Engine Execution State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Initialize selections once data loads
  useEffect(() => {
    if (spamNumbers.length > 0 && !selectedCallerId) {
      const defaultSpam = spamNumbers.find((s) => s.is_spam) || spamNumbers[0];
      setSelectedCallerId(defaultSpam.spam_id);
    }
  }, [spamNumbers, selectedCallerId]);

  useEffect(() => {
    if (subscribers.length > 0 && !selectedReceiverId) {
      const defaultChild = subscribers.find((s) => s.subscriber_type === 'CHILD') || subscribers[0];
      setSelectedReceiverId(defaultChild.subscriber_id);
    }
  }, [subscribers, selectedReceiverId]);

  // Handle call timer for answered state
  useEffect(() => {
    let interval: any = null;
    if (phoneCallState === 'active') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phoneCallState]);

  // Derived current caller
  const currentSpamEntry = spamNumbers.find((s) => s.spam_id === selectedCallerId);
  const displayCallerNumber = isCustomCaller
    ? customCallerNumber
    : currentSpamEntry?.phone_number || '+1-800-555-0191';
  const displayCallerName = isCustomCaller
    ? customCallerName
    : currentSpamEntry?.caller_name || 'IRS Tax Audit Threats';
  const displayIsSpam = isCustomCaller
    ? customIsSpam
    : currentSpamEntry ? currentSpamEntry.is_spam : true;
  const displayCategory = isCustomCaller
    ? customCategory
    : currentSpamEntry?.category || 'Robocall Scam';
  const displayRiskScore = isCustomCaller
    ? customRiskScore
    : currentSpamEntry?.risk_score || 95;

  // Derived current receiver
  const currentReceiver = subscribers.find((s) => s.subscriber_id === selectedReceiverId);
  const displayReceiverName = currentReceiver?.name || 'Leo Miller';
  const displayReceiverNumber = currentReceiver?.phone_number || '+1-555-0101';
  const displayReceiverType = currentReceiver?.subscriber_type || 'CHILD';
  const isReceiverChild = displayReceiverType === 'CHILD';

  // Format call duration
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Run the full simulation through backend
  const handleSimulateCall = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    setActiveStepIndex(1);
    setPhoneCallState('incoming');

    try {
      // Animate steps visually
      const stepInterval = setInterval(() => {
        setActiveStepIndex((prev) => {
          if (prev < 6) return prev + 1;
          clearInterval(stepInterval);
          return prev;
        });
      }, 200);

      const payload = {
        callerNumber: displayCallerNumber,
        callerName: displayCallerName,
        isSpamOverride: displayIsSpam,
        spamCategory: displayCategory,
        riskScore: displayRiskScore,
        receiverNumber: displayReceiverNumber,
      };

      const result = await api.simulateCall(payload);
      if (result) {
        setSimulationResult(result);
        setActiveStepIndex(6);
        onSimulationComplete(result);

        if (result.decision_code === 'PARENT_ALERT_SENT') {
          showToast(
            'success',
            `🚨 Alert Dispatched! Real-time SMS & Email alerts sent to guardian for minor ${result.receiver.name}.`
          );
        } else if (result.decision_code === 'NO_ALERT_RECEIVER_IS_A_PARENT') {
          showToast(
            'info',
            `🛡️ Policy Bypass: Receiver is an Adult (18+). No guardian alerts initiated.`
          );
        } else if (result.decision_code === 'NO_ALERT_LEGITIMATE_CALL') {
          showToast(
            'info',
            `✅ Safe Call: Legitimate caller verified. No alerts dispatched.`
          );
        } else {
          showToast('warning', `Simulation result: ${result.decision}`);
        }
      }
    } catch (err: any) {
      console.error('[Simulator] Simulation error:', err);
      showToast('error', err.message || 'Simulation network error');
    } finally {
      setIsSimulating(false);
    }
  };

  // Preset Handlers for 1-Click Demos
  const applyPreset = (presetKey: string) => {
    setIsCustomCaller(false);
    setPhoneCallState('incoming');

    if (presetKey === 'child1-spam') {
      // Spam to Child 1 (Leo Miller)
      const spam = spamNumbers.find((s) => s.is_spam) || spamNumbers[0];
      const child = subscribers.find((s) => s.subscriber_type === 'CHILD') || subscribers[0];
      if (spam) setSelectedCallerId(spam.spam_id);
      if (child) setSelectedReceiverId(child.subscriber_id);
      showToast('info', 'Preset Loaded: Spam Robocall ➔ Minor Child (Leo Miller <18)');
    } else if (presetKey === 'child2-spam') {
      // Spam to Child 2 (Emma Watson / Lucas)
      const spam = spamNumbers.find((s) => s.is_spam && s.category.includes('Tech')) || spamNumbers[0];
      const children = subscribers.filter((s) => s.subscriber_type === 'CHILD');
      const child2 = children[1] || children[0];
      if (spam) setSelectedCallerId(spam.spam_id);
      if (child2) setSelectedReceiverId(child2.subscriber_id);
      showToast('info', `Preset Loaded: Tech Scam ➔ Minor Child (${child2?.name || 'Child 2'} <18)`);
    } else if (presetKey === 'parent-spam') {
      // Spam to Adult (Sarah Miller)
      const spam = spamNumbers.find((s) => s.is_spam) || spamNumbers[0];
      const parent = subscribers.find((s) => s.subscriber_type === 'PARENT') || subscribers[0];
      if (spam) setSelectedCallerId(spam.spam_id);
      if (parent) setSelectedReceiverId(parent.subscriber_id);
      showToast('info', 'Preset Loaded: Spam Caller ➔ Adult Subscriber (Sarah Miller 18+) [Alert Bypass Rule]');
    } else if (presetKey === 'child-legit') {
      // Legitimate School to Child
      const legit = spamNumbers.find((s) => !s.is_spam) || spamNumbers[0];
      const child = subscribers.find((s) => s.subscriber_type === 'CHILD') || subscribers[0];
      if (legit) setSelectedCallerId(legit.spam_id);
      if (child) setSelectedReceiverId(child.subscriber_id);
      showToast('info', 'Preset Loaded: Verified School ➔ Minor Child (Legitimate Safe Call)');
    } else if (presetKey === 'child-unmapped') {
      // Unmapped Child
      const spam = spamNumbers.find((s) => s.is_spam) || spamNumbers[0];
      const unmapped = subscribers.find((s) => s.name.includes('Tommy') || s.subscriber_id === 'SUB-107');
      if (spam) setSelectedCallerId(spam.spam_id);
      if (unmapped) setSelectedReceiverId(unmapped.subscriber_id);
      showToast('warning', 'Preset Loaded: Spam Caller ➔ Unmapped Child (Audit Mode)');
    }
  };

  const handleReset = () => {
    setSimulationResult(null);
    setActiveStepIndex(0);
    setPhoneCallState('incoming');
    setCallDuration(0);
    showToast('info', 'Simulator reset to initial state.');
  };

  // Submit quick add data directly to Excel
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim() || !quickAddPhone.trim()) {
      showToast('error', 'Name and phone number are required.');
      return;
    }

    setIsSubmittingQuickAdd(true);
    try {
      if (quickAddType === 'SPAM') {
        const spamId = `SPAM-${Date.now().toString(36).toUpperCase()}`;
        const newSpam: SpamNumber = {
          spam_id: spamId,
          phone_number: quickAddPhone,
          caller_name: quickAddName,
          category: quickAddCategory,
          risk_score: quickAddRisk,
          reputation_status: 'SUSPECTED SPAM',
          is_spam: true,
          notes: 'Added via Call Simulator Quick-Add',
        };
        await api.addSpamNumber(newSpam);
        showToast('success', `Created spam number ${quickAddName} in Excel database.`);
        setSelectedCallerId(spamId);
      } else {
        const subId = `SUB-${Math.floor(200 + Math.random() * 800)}`;
        const newSub: Subscriber = {
          subscriber_id: subId,
          name: quickAddName,
          subscriber_type: quickAddType === 'CHILD' ? 'CHILD' : 'PARENT',
          phone_number: quickAddPhone,
          email: quickAddEmail || `${quickAddName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          email_alerts_enabled: true,
          sms_alerts_enabled: true,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        await api.saveSubscriber(newSub);
        showToast('success', `Created subscriber ${quickAddName} in Excel database.`);
        setSelectedReceiverId(subId);
      }

      setIsQuickAddModalOpen(false);
      setQuickAddName('');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save record to Excel');
    } finally {
      setIsSubmittingQuickAdd(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ================= 1. SCENARIO PRESETS BAR ================= */}
      <div
        className="card"
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          overflowX: 'auto',
          background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)',
          borderLeft: '4px solid var(--primary-600)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <Radio size={16} color="var(--primary-600)" />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
            }}
          >
            Demo Scenarios:
          </span>
        </div>
        <button
          onClick={() => applyPreset('child1-spam')}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          🚨 Spam ➔ Child 1 ({subscribers.find((s) => s.subscriber_type === 'CHILD')?.name || 'Child 1'}) [Live Alert]
        </button>
        <button
          onClick={() => applyPreset('child2-spam')}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          🚨 Tech Scam ➔ Child 2 ({subscribers.filter((s) => s.subscriber_type === 'CHILD')[1]?.name || 'Child 2'})
        </button>
        <button
          onClick={() => applyPreset('parent-spam')}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          🛡️ Spam ➔ Adult Line ({subscribers.find((s) => s.subscriber_type === 'PARENT')?.name || 'Adult Line'}) [No Alert]
        </button>
        <button
          onClick={() => applyPreset('child-legit')}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          🏫 Verified School ➔ Child (Legitimate)
        </button>
        <button
          onClick={() => applyPreset('child-unmapped')}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          ⚠️ Spam ➔ Unmapped Child (Audit Mode)
        </button>
      </div>

      {/* ================= 2. TWO-PHONE LIVE SIMULATION ARENA ================= */}
      <div className="two-phone-arena">
        {/* ================= PHONE 1: SPAM CALLER (OUTGOING DEVICE) ================= */}
        <div className="phone-mockup-wrapper">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Device Identification Header */}
            <div className="phone-device-badge caller">
              <Phone size={13} />
              <span>Caller Phone (Originating Line)</span>
            </div>

            <div className="phone-device-compact">
              {/* Dynamic Island */}
              <div className="phone-island">
                <div className="phone-island-camera" />
                <div className="phone-island-speaker" />
                <div style={{ width: '8px', height: '8px' }} />
              </div>

              {/* Caller Screen */}
              <div className="phone-screen-compact">
                {/* Status Bar */}
                <div>
                  <div className="phone-carrier-bar">
                    <span>9:41 AM</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Signal size={12} />
                      <Wifi size={12} />
                      <Battery size={13} />
                    </div>
                  </div>

                  <div className="phone-receiver-pill">
                    <span>Outgoing Line: <strong>{displayCallerNumber}</strong></span>
                  </div>
                </div>

                {/* Dialing Center Display */}
                <div className="phone-caller-info">
                  {/* Avatar / Outgoing Waves */}
                  <div className="phone-avatar-outer" style={{ width: '80px', height: '80px', marginBottom: '12px' }}>
                    <div
                      className={`phone-avatar-circle ${displayIsSpam ? 'spam' : 'safe'}`}
                      style={{ width: '68px', height: '68px', fontSize: '24px' }}
                    >
                      {displayIsSpam ? (
                        <ShieldAlert size={32} color="#ffffff" />
                      ) : (
                        <ShieldCheck size={32} color="#ffffff" />
                      )}
                    </div>
                  </div>

                  {/* Outgoing Call Label */}
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Calling Target Line
                  </div>
                  <h3 className="phone-caller-name" style={{ fontSize: '17px', margin: '2px 0' }}>
                    {displayReceiverName}
                  </h3>
                  <div className="phone-caller-number" style={{ fontSize: '13px', marginBottom: '8px' }}>
                    {displayReceiverNumber} ({isReceiverChild ? 'Child <18' : 'Adult 18+'})
                  </div>

                  {/* Caller Identity Badge */}
                  {displayIsSpam ? (
                    <span className="badge-threat spam" style={{ fontSize: '10px', padding: '3px 8px' }}>
                      <ShieldAlert size={10} /> SPAM ROBOCALL ({displayRiskScore}%)
                    </span>
                  ) : (
                    <span className="badge-threat safe" style={{ fontSize: '10px', padding: '3px 8px' }}>
                      <ShieldCheck size={10} /> VERIFIED CALLER
                    </span>
                  )}

                  {/* Audio Equalizer animation while calling */}
                  <div className="sound-waves">
                    <div className={`sound-wave-bar ${displayIsSpam ? '' : 'safe'}`} />
                    <div className={`sound-wave-bar ${displayIsSpam ? '' : 'safe'}`} />
                    <div className={`sound-wave-bar ${displayIsSpam ? '' : 'safe'}`} />
                    <div className={`sound-wave-bar ${displayIsSpam ? '' : 'safe'}`} />
                    <div className={`sound-wave-bar ${displayIsSpam ? '' : 'safe'}`} />
                    <div className={`sound-wave-bar ${displayIsSpam ? '' : 'safe'}`} />
                  </div>

                  <div className="phone-call-status" style={{ fontSize: '12px' }}>
                    {phoneCallState === 'incoming' && 'Dialing Target Subscriber...'}
                    {phoneCallState === 'active' && `Call Connected • ${formatTime(callDuration)}`}
                    {phoneCallState === 'declined' && 'Line Busy / Declined'}
                  </div>
                </div>

                {/* Keypad & Outgoing Controls */}
                <div>
                  <div className="caller-action-grid">
                    <button
                      className="caller-circle-btn"
                      onClick={() => setIsMuted(!isMuted)}
                      title="Mute microphone"
                      style={{ background: isMuted ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)' }}
                    >
                      <Mic size={18} color={isMuted ? '#f87171' : '#cbd5e1'} />
                    </button>
                    <button className="caller-circle-btn" title="Keypad">
                      <Grid size={18} />
                    </button>
                    <button
                      className="caller-circle-btn"
                      onClick={() => setIsSpeaker(!isSpeaker)}
                      title="Speakerphone"
                      style={{ background: isSpeaker ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)' }}
                    >
                      <Volume2 size={18} color={isSpeaker ? '#60a5fa' : '#cbd5e1'} />
                    </button>
                  </div>

                  {/* Red Hang Up / Cancel Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <button
                      className="phone-action-btn"
                      onClick={() => {
                        setPhoneCallState('declined');
                        showToast('info', 'Call terminated by originating caller.');
                      }}
                      title="End Outgoing Call"
                    >
                      <div className="phone-btn-circle decline" style={{ width: '52px', height: '52px' }}>
                        <PhoneOff size={22} color="#ffffff" />
                      </div>
                      <span className="phone-btn-label">End Call</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= CENTER: TELECOM INTERCEPT GATEWAY & FIREWALL ================= */}
        <div className="telecom-gateway-bridge">
          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} color="var(--primary-600)" />
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary-950)' }}>
                  Mobileum Telecom Shield Gateway
                </span>
              </div>
              <span className="telecom-pill" style={{ fontSize: '10px' }}>
                SS7 / SIP Signaling Tap
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Live carrier signaling interception, subscriber age classification & multi-channel policy routing.
            </p>

            {/* Visual Animated Intercept Pulse Beam */}
            <div className="bridge-pulse-line" />
          </div>

          {/* 6-Step Evaluation Pipeline */}
          <div className="pipeline-steps" style={{ margin: '8px 0' }}>
            {/* Step 1 */}
            <div className={`step-item ${activeStepIndex >= 1 ? 'step-INFO' : ''}`} style={{ padding: '8px 10px' }}>
              <div className="step-index-badge" style={{ width: '22px', height: '22px', fontSize: '11px' }}>1</div>
              <div className="step-content">
                <div className="step-title" style={{ fontSize: '12.5px' }}>
                  <span>1. Intercept Call Signal</span>
                  {activeStepIndex >= 1 && <CheckCircle2 size={14} color="#16a34a" />}
                </div>
                <div className="step-description" style={{ fontSize: '11px' }}>
                  {activeStepIndex >= 1
                    ? `Captured carrier signaling: ${displayCallerNumber} ➔ ${displayReceiverNumber}`
                    : 'Awaiting call trigger...'}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`step-item ${
                activeStepIndex >= 2
                  ? displayIsSpam ? 'step-WARNING' : 'step-SUCCESS'
                  : ''
              }`}
              style={{ padding: '8px 10px' }}
            >
              <div className="step-index-badge" style={{ width: '22px', height: '22px', fontSize: '11px' }}>2</div>
              <div className="step-content">
                <div className="step-title" style={{ fontSize: '12.5px' }}>
                  <span>2. Check Spam Registry</span>
                  {activeStepIndex >= 2 && (displayIsSpam ? <ShieldAlert size={14} color="#dc2626" /> : <ShieldCheck size={14} color="#16a34a" />)}
                </div>
                <div className="step-description" style={{ fontSize: '11px' }}>
                  {activeStepIndex >= 2
                    ? (displayIsSpam
                        ? `Classified as SPAM (${displayCategory}, Risk: ${displayRiskScore}/100)`
                        : `Verified as SAFE legitimate caller (${displayCallerName})`)
                    : 'Querying SpamNumbers database...'}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`step-item ${activeStepIndex >= 3 ? 'step-SUCCESS' : ''}`} style={{ padding: '8px 10px' }}>
              <div className="step-index-badge" style={{ width: '22px', height: '22px', fontSize: '11px' }}>3</div>
              <div className="step-content">
                <div className="step-title" style={{ fontSize: '12.5px' }}>
                  <span>3. Receiver Age Classification</span>
                  {activeStepIndex >= 3 && <CheckCircle2 size={14} color="#16a34a" />}
                </div>
                <div className="step-description" style={{ fontSize: '11px' }}>
                  {activeStepIndex >= 3
                    ? (isReceiverChild
                        ? `Subscriber ${displayReceiverName} is a PROTECTED MINOR (Child <18)`
                        : `Subscriber ${displayReceiverName} is an ADULT (18+) — Child safety alert bypassed`)
                    : 'Evaluating subscriber age group...'}
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className={`step-item ${activeStepIndex >= 4 ? 'step-INFO' : ''}`} style={{ padding: '8px 10px' }}>
              <div className="step-index-badge" style={{ width: '22px', height: '22px', fontSize: '11px' }}>4</div>
              <div className="step-content">
                <div className="step-title" style={{ fontSize: '12.5px' }}>
                  <span>4. Verify Guardian Linkage</span>
                  {activeStepIndex >= 4 && <CheckCircle2 size={14} color="#16a34a" />}
                </div>
                <div className="step-description" style={{ fontSize: '11px' }}>
                  {activeStepIndex >= 4
                    ? (isReceiverChild
                        ? 'Identified authorized guardian(s) linked to this minor SIM'
                        : 'Adult line: Guardian linkage verification not required')
                    : 'Querying ParentChildMapping relationships...'}
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className={`step-item ${activeStepIndex >= 5 ? 'step-WARNING' : ''}`} style={{ padding: '8px 10px' }}>
              <div className="step-index-badge" style={{ width: '22px', height: '22px', fontSize: '11px' }}>5</div>
              <div className="step-content">
                <div className="step-title" style={{ fontSize: '12.5px' }}>
                  <span>5. Telecom Policy Decision</span>
                  {activeStepIndex >= 5 && <CheckCircle2 size={14} color="#16a34a" />}
                </div>
                <div className="step-description" style={{ fontSize: '11px' }}>
                  {activeStepIndex >= 5
                    ? (displayIsSpam && isReceiverChild
                        ? 'CRITICAL ALERT TRIGGERED: Minor child receiving spam call'
                        : displayIsSpam && !isReceiverChild
                        ? 'NO ALERT TRIGGERED: Receiver is an adult (18+)'
                        : 'NO ALERT TRIGGERED: Legitimate call verified safe')
                    : 'Applying child safety matrix...'}
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className={`step-item ${activeStepIndex >= 6 ? 'step-SUCCESS' : ''}`} style={{ padding: '8px 10px' }}>
              <div className="step-index-badge" style={{ width: '22px', height: '22px', fontSize: '11px' }}>6</div>
              <div className="step-content">
                <div className="step-title" style={{ fontSize: '12.5px' }}>
                  <span>6. Real-Time Alert Dispatch</span>
                  {activeStepIndex >= 6 && <CheckCircle2 size={14} color="#16a34a" />}
                </div>
                <div className="step-description" style={{ fontSize: '11px' }}>
                  {activeStepIndex >= 6
                    ? (displayIsSpam && isReceiverChild
                        ? 'Dispatched live Email via Gmail SMTP & Carrier SMS to Guardian'
                        : 'Alerts skipped according to policy rules')
                    : 'Awaiting policy decision...'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleSimulateCall}
              disabled={isSimulating}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isSimulating ? (
                <>
                  <div className="spin" style={{ width: '16px', height: '16px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  Intercepting & Evaluating Call...
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> Intercept & Evaluate Call Signal
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '7px 12px', fontSize: '12px' }}
            >
              <RotateCcw size={13} /> Reset Simulation State
            </button>
          </div>
        </div>

        {/* ================= PHONE 2: TARGET RECEIVER DEVICE ================= */}
        <div className="phone-mockup-wrapper">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Device Identification Header */}
            <div className={`phone-device-badge ${isReceiverChild ? 'receiver-child' : 'receiver-adult'}`}>
              <User size={13} />
              <span>
                {isReceiverChild ? 'Protected Minor Line (<18)' : 'Adult Subscriber Line (18+)'}
              </span>
            </div>

            <div className="phone-device-compact">
              {/* Dynamic Island */}
              <div className="phone-island">
                <div className="phone-island-camera" />
                <div className="phone-island-speaker" />
                <div style={{ width: '8px', height: '8px' }} />
              </div>

              {/* Receiver Screen */}
              <div className="phone-screen-compact">
                {/* Status Bar */}
                <div>
                  <div className="phone-carrier-bar">
                    <span>9:41 AM</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Signal size={12} />
                      <Wifi size={12} />
                      <Battery size={13} />
                    </div>
                  </div>

                  <div className="phone-receiver-pill">
                    <User size={11} />
                    <span>
                      Receiving Line: <strong>{displayReceiverName}</strong> ({isReceiverChild ? 'Child <18' : 'Adult 18+'})
                    </span>
                  </div>
                </div>

                {/* Incoming Caller Profile */}
                <div className="phone-caller-info">
                  {/* Pulsing Avatar Ring */}
                  <div className="phone-avatar-outer" style={{ width: '88px', height: '88px', marginBottom: '12px' }}>
                    {phoneCallState === 'incoming' && (
                      <div className={`phone-avatar-ring ${displayIsSpam ? '' : 'safe'}`} />
                    )}
                    <div
                      className={`phone-avatar-circle ${displayIsSpam ? 'spam' : 'safe'}`}
                      style={{ width: '72px', height: '72px', fontSize: '26px' }}
                    >
                      {displayIsSpam ? (
                        <ShieldAlert size={36} color="#ffffff" />
                      ) : (
                        <ShieldCheck size={36} color="#ffffff" />
                      )}
                    </div>
                  </div>

                  {/* Caller Identification */}
                  <h3 className="phone-caller-name" style={{ fontSize: '18px', margin: '2px 0' }}>
                    {displayCallerName}
                  </h3>
                  <div className="phone-caller-number" style={{ fontSize: '13px', marginBottom: '8px' }}>
                    {displayCallerNumber}
                  </div>

                  {/* Threat Warning Banner */}
                  {displayIsSpam ? (
                    <span className="badge-threat spam" style={{ fontSize: '11px', padding: '4px 10px' }}>
                      <ShieldAlert size={12} /> SPAM WARNING: {displayCategory}
                    </span>
                  ) : (
                    <span className="badge-threat safe" style={{ fontSize: '11px', padding: '4px 10px' }}>
                      <ShieldCheck size={12} /> VERIFIED SAFE CALLER
                    </span>
                  )}

                  {/* Call Status Text */}
                  <div className="phone-call-status" style={{ fontSize: '12px' }}>
                    {phoneCallState === 'incoming' && 'Incoming Carrier Call...'}
                    {phoneCallState === 'active' && `Call Connected • ${formatTime(callDuration)}`}
                    {phoneCallState === 'declined' && 'Call Declined'}
                  </div>
                </div>

                {/* Bottom Call Action Buttons */}
                <div className="phone-actions">
                  {phoneCallState === 'incoming' ? (
                    <>
                      <button
                        className="phone-action-btn"
                        onClick={() => {
                          setPhoneCallState('declined');
                          showToast('info', 'Call declined by subscriber device.');
                        }}
                        title="Decline Call"
                      >
                        <div className="phone-btn-circle decline" style={{ width: '56px', height: '56px' }}>
                          <PhoneOff size={24} color="#ffffff" />
                        </div>
                        <span className="phone-btn-label">Decline</span>
                      </button>

                      <button
                        className="phone-action-btn"
                        onClick={() => {
                          setPhoneCallState('active');
                          showToast('info', `Call answered on ${displayReceiverName}'s phone.`);
                        }}
                        title="Answer Call"
                      >
                        <div className="phone-btn-circle answer" style={{ width: '56px', height: '56px' }}>
                          <PhoneCall size={24} color="#ffffff" />
                        </div>
                        <span className="phone-btn-label">Answer</span>
                      </button>
                    </>
                  ) : (
                    <button
                      className="phone-action-btn"
                      onClick={() => {
                        setPhoneCallState('incoming');
                      }}
                      title="Reset to Incoming State"
                    >
                      <div className="phone-btn-circle decline" style={{ width: '56px', height: '56px' }}>
                        <PhoneOff size={24} color="#ffffff" />
                      </div>
                      <span className="phone-btn-label">Hang Up / Reset</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. LIVE GUARDIAN ALERT CENTER ================= */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} color="var(--primary-600)" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-950)', margin: 0 }}>
              Live Guardian Multi-Channel Alert Center
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time SMS & Email dispatches triggered for protected minor lines
          </span>
        </div>

        {/* Display Alert Cards or Informational Policy Notice */}
        {isReceiverChild && displayIsSpam ? (
          <div className="guardian-alert-arena">
            {/* Card 1: Live Carrier SMS Push Notification Mockup */}
            <div className="sms-notification-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={16} color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                      Messages • SafeFamily Alert Gateway
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                      Just now • High Priority Security SMS
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '3px 8px', borderRadius: '12px' }}>
                  CARRIER SMS DELIVERED
                </span>
              </div>

              <div style={{ fontSize: '12.5px', lineHeight: '1.5', color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <strong>[SafeFamily Alert] URGENT:</strong> Suspected <strong>{displayCategory}</strong> call from <strong>{displayCallerNumber}</strong> intercepted on child <strong>{displayReceiverName}</strong>'s line ({displayReceiverNumber}). Advised action: Instruct child NOT to answer or return call.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                <span>To Guardian: <strong>Sarah Miller (+1-555-0100)</strong></span>
                <span>Carrier Tracking ID: <code>SMS-CARRIER-2026-LIVE</code></span>
              </div>
            </div>

            {/* Card 2: Live Nodemailer Gmail Transmission Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #bfdbfe',
                borderRadius: '18px',
                padding: '18px 20px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, width: '5px', height: '100%', background: '#2563eb' }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={16} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-950)' }}>
                        Guardian Safety Alert Email
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Live Transmission via Gmail SMTP (Port 587)
                      </div>
                    </div>
                  </div>
                  <span
                    className={`chip ${
                      simulationResult?.email_status === 'ACCEPTED_BY_SMTP'
                        ? 'chip-email-accepted'
                        : 'chip-email-notconfig'
                    }`}
                  >
                    {simulationResult?.email_status || 'ACCEPTED_BY_SMTP'}
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', color: 'var(--text-main)', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Subject: </span>
                    <strong>🚨 [URGENT] Spam Call Intercepted on {displayReceiverName}'s Phone Line</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Recipient: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#1e40af' }}>
                      kishansukumar2004@gmail.com
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Delivery: <strong>Instant Gmail Notification</strong></span>
                <span>Audit: Persisted in <code>child_spam_alert_demo_data.xlsx</code></span>
              </div>
            </div>
          </div>
        ) : !isReceiverChild ? (
          /* Adult Line Policy Notice */
          <div
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#5b21b6' }}>
                CHILD SAFETY POLICY SAFEGUARD: NO ALERTS SENT
              </div>
              <div style={{ fontSize: '12.5px', color: '#6d28d9', marginTop: '2px', lineHeight: '1.4' }}>
                Receiver <strong>{displayReceiverName}</strong> is registered as an <strong>Adult Subscriber (18+)</strong>. Telecom child safety policies strictly initiate emergency guardian SMS and email alerts for protected minor child lines. Call recorded in network audit logs without dispatching notifications.
              </div>
            </div>
          </div>
        ) : (
          /* Legitimate Safe Caller Notice */
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534' }}>
                SAFE CALL VERIFIED: NO ALERTS REQUIRED
              </div>
              <div style={{ fontSize: '12.5px', color: '#15803d', marginTop: '2px', lineHeight: '1.4' }}>
                Incoming caller <strong>{displayCallerName}</strong> is classified as a verified legitimate caller (Risk score: {displayRiskScore}/100). The call passes all telecom security checks without triggering guardian safety dispatches.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= 4. TELECOM CONTROLLER & DATA MANAGER ================= */}
      <div className="card sim-controls-card">
        <div className="card-header">
          <div className="card-title-group">
            <Sparkles size={20} color="var(--primary-600)" />
            <div>
              <h3 className="card-title">Telecom Intercept Controller & Line Configurator</h3>
              <p className="card-subtitle">
                Select numbers from Excel workbook or create new custom numbers on the fly
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setQuickAddType('SPAM');
                setQuickAddName('');
                setQuickAddPhone('+1-800-');
                setIsQuickAddModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <Plus size={14} /> Add Spam Number
            </button>
            <button
              onClick={() => {
                setQuickAddType('CHILD');
                setQuickAddName('');
                setQuickAddPhone('+1-555-');
                setIsQuickAddModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <Plus size={14} /> Add Child / Adult
            </button>
          </div>
        </div>

        {/* Selectors Grid */}
        <div className="selector-grid">
          {/* Caller Selector */}
          <div className="form-group">
            <label className="form-label">
              <span>Originating Caller Line:</span>
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: '11px', textDecoration: 'underline', color: 'var(--primary-600)' }}
                onClick={() => setIsCustomCaller(!isCustomCaller)}
              >
                {isCustomCaller ? 'Choose from Excel list' : 'Enter custom caller number'}
              </button>
            </label>

            {!isCustomCaller ? (
              <select
                className="form-select"
                value={selectedCallerId}
                onChange={(e) => setSelectedCallerId(e.target.value)}
              >
                <optgroup label="🚨 Known Spam / Threat Callers">
                  {spamNumbers
                    .filter((s) => s.is_spam)
                    .map((s) => (
                      <option key={s.spam_id} value={s.spam_id}>
                        {s.caller_name} — {s.phone_number} ({s.category})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="✅ Legitimate Callers">
                  {spamNumbers
                    .filter((s) => !s.is_spam)
                    .map((s) => (
                      <option key={s.spam_id} value={s.spam_id}>
                        {s.caller_name} — {s.phone_number} ({s.category})
                      </option>
                    ))}
                </optgroup>
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Caller Phone Number (e.g. +1-800-555-9999)"
                  value={customCallerNumber}
                  onChange={(e) => setCustomCallerNumber(e.target.value)}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Caller Name / ID"
                  value={customCallerName}
                  onChange={(e) => setCustomCallerName(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={customIsSpam}
                      onChange={(e) => setCustomIsSpam(e.target.checked)}
                    />
                    Classify as Spam Threat
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Threat Category"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Receiver Selector */}
          <div className="form-group">
            <label className="form-label">
              <span>Target Subscriber Receiving Line:</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isReceiverChild ? '👶 Child Line (<18)' : '👤 Adult Line (18+)'}
              </span>
            </label>

            <select
              className="form-select"
              value={selectedReceiverId}
              onChange={(e) => setSelectedReceiverId(e.target.value)}
            >
              <optgroup label="👶 Protected Children (Under 18)">
                {subscribers
                  .filter((s) => s.subscriber_type === 'CHILD')
                  .map((s) => (
                    <option key={s.subscriber_id} value={s.subscriber_id}>
                      {s.name} ({s.phone_number}) — Protected Minor Line
                    </option>
                  ))}
              </optgroup>
              <optgroup label="👤 Adult Subscribers / Guardians (18+)">
                {subscribers
                  .filter((s) => s.subscriber_type === 'PARENT')
                  .map((s) => (
                    <option key={s.subscriber_id} value={s.subscriber_id}>
                      {s.name} ({s.phone_number}) — Adult Line (Alert Bypass)
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* ================= 5. QUICK ADD NUMBER MODAL ================= */}
      {isQuickAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsQuickAddModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {quickAddType === 'SPAM'
                  ? 'Add New Spam Number to Excel'
                  : quickAddType === 'CHILD'
                  ? 'Add Protected Child Subscriber (<18)'
                  : 'Add Adult Subscriber (18+)'}
              </h3>
              <button className="close-btn" onClick={() => setIsQuickAddModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Classification Type:</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('SPAM')}
                    className={`btn ${quickAddType === 'SPAM' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                  >
                    🚨 Spam Caller
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('CHILD')}
                    className={`btn ${quickAddType === 'CHILD' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                  >
                    👶 Child (&lt;18)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddType('ADULT')}
                    className={`btn ${quickAddType === 'ADULT' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                  >
                    👤 Adult (18+)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Display Name / Identity:</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder={quickAddType === 'SPAM' ? 'e.g. Utility Bill Collector Scam' : 'e.g. Jack Smith'}
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number:</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="+1-555-0199"
                  value={quickAddPhone}
                  onChange={(e) => setQuickAddPhone(e.target.value)}
                />
              </div>

              {quickAddType === 'SPAM' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Spam Threat Category:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Lottery Scam, Robocall"
                      value={quickAddCategory}
                      onChange={(e) => setQuickAddCategory(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Risk Threat Score (0 - 100): {quickAddRisk}%</label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={quickAddRisk}
                      onChange={(e) => setQuickAddRisk(parseInt(e.target.value, 10))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Email Address (Optional):</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="subscriber@example.com"
                    value={quickAddEmail}
                    onChange={(e) => setQuickAddEmail(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsQuickAddModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingQuickAdd} className="btn btn-primary">
                  {isSubmittingQuickAdd ? 'Saving to Excel...' : 'Save to Excel Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
