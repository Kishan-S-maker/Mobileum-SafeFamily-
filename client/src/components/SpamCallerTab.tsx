import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Clock,
  Sparkles,
  Search,
  Check,
  X,
  User,
  Hash,
} from 'lucide-react';
import { Subscriber, SpamNumber, CallStatus } from '../types.js';
import { api } from '../api/client.js';

interface SpamCallerTabProps {
  subscribers: Subscriber[];
  spamNumbers: SpamNumber[];
  activeCall: any | null;
  callTimer: number;
  onInitiateCall: (callerNumber: string, callerName: string, receiverNumber: string, receiverId?: string) => Promise<void>;
  onEndCall: () => Promise<void>;
  onSwitchToReceiver: () => void;
  onRefreshData: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const SpamCallerTab: React.FC<SpamCallerTabProps> = ({
  subscribers,
  spamNumbers,
  activeCall,
  callTimer,
  onInitiateCall,
  onEndCall,
  onSwitchToReceiver,
  onRefreshData,
  showToast,
}) => {
  // Dialer input state
  const [dialerNumber, setDialerNumber] = useState<string>('+1-800-555-0191');
  const [callerName, setCallerName] = useState<string>('IRS Tax Audit Threats');
  const [selectedReceiverId, setSelectedReceiverId] = useState<string>('');

  // Spam Directory Filter & Modal state
  const [spamFilter, setSpamFilter] = useState<'ALL' | 'SPAM' | 'LEGITIMATE'>('ALL');
  const [spamSearch, setSpamSearch] = useState<string>('');
  const [isEditingSpam, setIsEditingSpam] = useState<boolean>(false);
  const [isNewSpam, setIsNewSpam] = useState<boolean>(false);
  const [editingSpamData, setEditingSpamData] = useState<Partial<SpamNumber>>({
    phone_number: '',
    caller_name: '',
    category: 'General Spam',
    risk_score: 85,
    reputation_status: 'SUSPECTED SPAM',
    is_spam: true,
    notes: '',
  });

  // Set default receiver line on load (first active child)
  useEffect(() => {
    if (subscribers.length > 0) {
      const exists = subscribers.some((s) => s.subscriber_id === selectedReceiverId);
      if (!selectedReceiverId || !exists) {
        const defaultChild = subscribers.find((s) => s.subscriber_type === 'CHILD' && s.is_active);
        if (defaultChild) {
          setSelectedReceiverId(defaultChild.subscriber_id);
        } else {
          setSelectedReceiverId(subscribers[0].subscriber_id);
        }
      }
    }
  }, [subscribers, selectedReceiverId]);

  // Sync dialer number when activeCall changes
  useEffect(() => {
    if (activeCall) {
      setDialerNumber(activeCall.callerNumber);
      setCallerName(activeCall.callerName);
      if (activeCall.receiverId) {
        setSelectedReceiverId(activeCall.receiverId);
      } else {
        const match = subscribers.find(
          (s) => s.phone_number.replace(/[^0-9]/g, '') === activeCall.receiverNumber?.replace(/[^0-9]/g, '')
        );
        if (match) {
          setSelectedReceiverId(match.subscriber_id);
        }
      }
    }
  }, [activeCall, subscribers]);

  // Automatic reset after a call is finished or declined
  useEffect(() => {
    if (activeCall && (activeCall.callStatus === 'Disconnected' || activeCall.callStatus === 'Rejected')) {
      const timer = setTimeout(() => {
        setDialerNumber('');
        setCallerName('');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [activeCall?.callStatus]);

  // Derived caller reputation from typed dialer number
  const cleanDialer = dialerNumber.replace(/[^0-9]/g, '');
  const matchedEntry = spamNumbers.find(
    (s) => s.phone_number.replace(/[^0-9]/g, '') === cleanDialer
  );

  const isDetectedSpam = matchedEntry ? matchedEntry.is_spam : dialerNumber.startsWith('+1-800') || dialerNumber.startsWith('+1-888');
  const detectedRisk = matchedEntry ? matchedEntry.risk_score : isDetectedSpam ? 88 : 10;
  const detectedCategory = matchedEntry ? matchedEntry.category : isDetectedSpam ? 'Robocall Telemarketer' : 'Standard Line';
  const detectedReputation = matchedEntry ? matchedEntry.reputation_status : isDetectedSpam ? 'SUSPECTED SPAM' : 'LEGITIMATE';

  // Selected receiver subscriber details (uniquely resolved by subscriber_id)
  const matchedReceiver =
    subscribers.find((s) => s.subscriber_id === selectedReceiverId) ||
    subscribers[0];
  const selectedReceiverNumber = matchedReceiver ? matchedReceiver.phone_number : '';

  // Keypad click handler
  const handleKeypadPress = (val: string) => {
    setDialerNumber((prev) => prev + val);
  };

  const handleBackspace = () => {
    setDialerNumber((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
  };

  const handleClear = () => {
    setDialerNumber('');
  };

  // Dial preset selector
  const handleSelectPreset = (spam: SpamNumber) => {
    setDialerNumber(spam.phone_number);
    setCallerName(spam.caller_name);
  };

  // Initiate call
  const handleCallSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dialerNumber.trim()) {
      showToast('error', 'Please enter a caller phone number on the dial pad.');
      return;
    }
    if (!selectedReceiverNumber.trim()) {
      showToast('error', 'Please select or enter a recipient subscriber line.');
      return;
    }

    try {
      await onInitiateCall(
        dialerNumber.trim(),
        callerName || (matchedEntry ? matchedEntry.caller_name : 'Unknown Caller'),
        selectedReceiverNumber.trim(),
        selectedReceiverId
      );
    } catch (err: any) {
      showToast('error', err.message || 'Call initiation failed');
    }
  };

  // Duration formatter (MM:SS)
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save spam entry (Add or Edit)
  const handleSaveSpam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpamData.phone_number || !editingSpamData.caller_name) {
      showToast('error', 'Phone number and caller name are required.');
      return;
    }

    try {
      if (isNewSpam) {
        await api.addSpamNumber(editingSpamData);
        showToast('success', `Added ${editingSpamData.phone_number} to Excel database.`);
      } else if (editingSpamData.spam_id) {
        await api.updateSpamNumber(editingSpamData.spam_id, editingSpamData);
        showToast('success', `Updated ${editingSpamData.phone_number} in Excel database.`);
      }
      setIsEditingSpam(false);
      onRefreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save spam number');
    }
  };

  // Delete spam entry
  const handleDeleteSpam = async (entry: SpamNumber) => {
    const confirmMsg = `Are you sure you want to delete ${entry.caller_name} (${entry.phone_number}) from the reputation database?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteSpamNumber(entry.spam_id);
      showToast('success', `Deleted ${entry.phone_number} from Excel database.`);
      onRefreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete spam number');
    }
  };

  // Open add modal
  const handleOpenAddSpam = (asSpam: boolean) => {
    setEditingSpamData({
      phone_number: '+1-',
      caller_name: '',
      category: asSpam ? 'IRS Impersonator' : 'Family / Verified Line',
      risk_score: asSpam ? 88 : 5,
      reputation_status: asSpam ? 'SUSPECTED SPAM' : 'LEGITIMATE',
      is_spam: asSpam,
      notes: asSpam ? 'Reported nuisance caller' : 'Verified safe caller',
    });
    setIsNewSpam(true);
    setIsEditingSpam(true);
  };

  // Open edit modal
  const handleOpenEditSpam = (entry: SpamNumber) => {
    setEditingSpamData({ ...entry });
    setIsNewSpam(false);
    setIsEditingSpam(true);
  };

  // Filtered spam records
  const filteredSpam = spamNumbers.filter((s) => {
    if (spamFilter === 'SPAM' && !s.is_spam) return false;
    if (spamFilter === 'LEGITIMATE' && s.is_spam) return false;
    if (spamSearch) {
      const q = spamSearch.toLowerCase();
      const match =
        s.phone_number.toLowerCase().includes(q) ||
        s.caller_name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.spam_id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const isCallActive = activeCall && ['Calling', 'Ringing', 'Connected'].includes(activeCall.callStatus);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Main 2-Column Interface: Smartphone Dialer + Caller Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '24px', alignItems: 'start' }}>
        {/* LEFT COLUMN: SMARTPHONE DEVICE DIALER INTERFACE */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
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
              <span style={{ color: '#ef4444', fontWeight: 700 }}>Spam Origin Line</span>
              <span>100% 🔋</span>
            </div>

            {/* Phone Screen Body */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 18px 16px',
                justifyContent: 'space-between',
                overflowY: 'auto',
              }}
            >
              {/* Receiver Line Selection inside Phone Header */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <select
                  value={selectedReceiverId}
                  disabled={isCallActive}
                  onChange={(e) => setSelectedReceiverId(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '12px',
                    outline: 'none',
                    width: '100%',
                  }}
                >
                  <optgroup label="Protected Minor Lines (Child)" style={{ background: '#0f172a', color: '#38bdf8' }}>
                    {subscribers
                      .filter((s) => s.subscriber_type === 'CHILD')
                      .map((sub) => (
                        <option key={sub.subscriber_id} value={sub.subscriber_id} style={{ color: '#ffffff' }}>
                          👶 {sub.name} ({sub.phone_number}) — Child
                        </option>
                      ))}
                  </optgroup>
                  {subscribers.filter((s) => s.subscriber_type === 'PARENT').length > 0 && (
                    <optgroup label="Authorized Guardians & Parents" style={{ background: '#0f172a', color: '#c084fc' }}>
                      {subscribers
                        .filter((s) => s.subscriber_type === 'PARENT')
                        .map((sub) => (
                          <option key={sub.subscriber_id} value={sub.subscriber_id} style={{ color: '#ffffff' }}>
                            🛡️ {sub.name} ({sub.phone_number}) — Guardian
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Dialed Number & Caller Name Display */}
              <div
                style={{
                  textAlign: 'center',
                  padding: '8px 0 2px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={callerName}
                  disabled={isCallActive}
                  onChange={(e) => setCallerName(e.target.value)}
                  placeholder="Caller Name (e.g. IRS Scam)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'center',
                    outline: 'none',
                    width: '100%',
                    marginBottom: '4px',
                  }}
                />

                <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="text"
                    value={dialerNumber}
                    disabled={isCallActive}
                    onChange={(e) => setDialerNumber(e.target.value)}
                    placeholder="Enter Number"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '24px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      textAlign: 'center',
                      outline: 'none',
                      width: '100%',
                      letterSpacing: '1px',
                    }}
                  />
                  {dialerNumber && !isCallActive && (
                    <button
                      onClick={handleBackspace}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#94a3b8',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                      title="Backspace"
                    >
                      ⌫
                    </button>
                  )}
                </div>
              </div>

              {/* Keypad Grid (0–9, *, #) with circular smartphone keys */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  justifyItems: 'center',
                  padding: '4px 8px',
                }}
              >
                {[
                  { num: '1', sub: ' ' },
                  { num: '2', sub: 'ABC' },
                  { num: '3', sub: 'DEF' },
                  { num: '4', sub: 'GHI' },
                  { num: '5', sub: 'JKL' },
                  { num: '6', sub: 'MNO' },
                  { num: '7', sub: 'PQRS' },
                  { num: '8', sub: 'TUV' },
                  { num: '9', sub: 'WXYZ' },
                  { num: '*', sub: ' ' },
                  { num: '0', sub: '+' },
                  { num: '#', sub: ' ' },
                ].map((k) => (
                  <button
                    key={k.num}
                    type="button"
                    disabled={isCallActive}
                    onClick={() => handleKeypadPress(k.num)}
                    style={{
                      width: '62px',
                      height: '62px',
                      borderRadius: '50%',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isCallActive ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                      color: '#ffffff',
                    }}
                    onMouseDown={(e) => {
                      if (!isCallActive) (e.currentTarget.style.background = '#334155');
                    }}
                    onMouseUp={(e) => {
                      if (!isCallActive) (e.currentTarget.style.background = '#1e293b');
                    }}
                  >
                    <span style={{ fontSize: '20px', fontWeight: 700, lineHeight: '1.1' }}>
                      {k.num}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>
                      {k.sub || ' '}
                    </span>
                  </button>
                ))}
              </div>

              {/* Circular Call Action Button */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '6px 0 6px' }}>
                {!isCallActive ? (
                  <button
                    onClick={() => handleCallSubmit()}
                    style={{
                      width: '66px',
                      height: '66px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(34, 197, 94, 0.45)',
                      transition: 'transform 0.15s ease',
                    }}
                    title="Initiate Call"
                  >
                    <PhoneCall size={28} />
                  </button>
                ) : (
                  <button
                    onClick={onEndCall}
                    style={{
                      width: '66px',
                      height: '66px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(239, 68, 68, 0.45)',
                    }}
                    title="End Call"
                  >
                    <PhoneOff size={28} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CALLER REPUTATION, DETECTION & SESSION STATUS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Real-Time Detection Card */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isDetectedSpam ? '#fee2e2' : '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDetectedSpam ? '#dc2626' : '#16a34a',
                  }}
                >
                  {isDetectedSpam ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    Caller Classification & Threat Analysis
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Matched against SpamNumbers workbook sheet
                  </span>
                </div>
              </div>

              <span
                className={`chip ${isDetectedSpam ? 'chip-spam' : 'chip-legit'}`}
                style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 800 }}
              >
                {isDetectedSpam ? '🚨 SPAM' : '✅ LEGITIMATE'}
              </span>
            </div>

            {/* Analysis Grid */}
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
                  Caller Phone Number
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--primary-950)', marginTop: '2px' }}>
                  {dialerNumber || 'None'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Caller Name / Label
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-950)', marginTop: '2px' }}>
                  {callerName || (matchedEntry ? matchedEntry.caller_name : 'Unknown Caller')}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Threat Classification
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: isDetectedSpam ? '#dc2626' : '#15803d', marginTop: '2px' }}>
                  {isDetectedSpam ? 'SPAM (Threat Intercepted)' : 'LEGITIMATE (Safe Caller)'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Threat Category
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {detectedCategory}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Reputation Status
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: isDetectedSpam ? '#b91c1c' : '#15803d', marginTop: '2px' }}>
                  {detectedReputation}
                </div>
              </div>
            </div>

            {/* Live Call Session Box */}
            <div
              style={{
                marginTop: '18px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background:
                        activeCall?.callStatus === 'Connected'
                          ? '#22c55e'
                          : activeCall?.callStatus === 'Ringing' || activeCall?.callStatus === 'Calling'
                          ? '#f59e0b'
                          : '#94a3b8',
                      display: 'inline-block',
                      animation: isCallActive ? 'pulse-status 1.2s infinite' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>
                    Call Status: {activeCall?.callStatus || 'Idle / Ready'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Target: <strong>{activeCall ? activeCall.receiverName : matchedReceiver?.name || 'Receiver'}</strong> ({activeCall ? activeCall.receiverNumber : selectedReceiverNumber}) [{(activeCall?.receiverType || matchedReceiver?.subscriber_type) === 'CHILD' ? 'Child' : 'Guardian'}]
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Call Duration</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    {formatTimer(callTimer)}
                  </div>
                </div>

                {isCallActive ? (
                  <button
                    onClick={onSwitchToReceiver}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    Open Receiver End ➔
                  </button>
                ) : (
                  <button
                    onClick={() => handleCallSubmit()}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    Start Call
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SPAM NUMBERS REPUTATION DIRECTORY (CRUD) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Reputation Database (Spam & Legitimate Numbers)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Manage numbers stored in the Excel SpamNumbers sheet.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleOpenAddSpam(true)}
                  className="btn btn-outline-danger"
                  style={{ padding: '6px 12px', fontSize: '12.5px' }}
                >
                  <Plus size={14} /> Add Spam Number
                </button>
                <button
                  onClick={() => handleOpenAddSpam(false)}
                  className="btn btn-outline-success"
                  style={{ padding: '6px 12px', fontSize: '12.5px' }}
                >
                  <Plus size={14} /> Add Legitimate Number
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search reputation directory..."
                  className="form-input"
                  value={spamSearch}
                  onChange={(e) => setSpamSearch(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '12.5px' }}
                />
              </div>

              <select
                className="form-select"
                value={spamFilter}
                onChange={(e) => setSpamFilter(e.target.value as any)}
                style={{ width: 'auto', fontSize: '12.5px' }}
              >
                <option value="ALL">All Entries ({spamNumbers.length})</option>
                <option value="SPAM">Spam Only ({spamNumbers.filter((s) => s.is_spam).length})</option>
                <option value="LEGITIMATE">Legitimate Only ({spamNumbers.filter((s) => !s.is_spam).length})</option>
              </select>
            </div>

            {/* Table */}
            <div className="table-container" style={{ border: '1px solid var(--surface-border)', borderRadius: '10px', maxHeight: '340px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phone Number</th>
                    <th>Caller Name</th>
                    <th>Category</th>
                    <th>Classification</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpam.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No matching reputation records found.
                      </td>
                    </tr>
                  ) : (
                    filteredSpam.map((sp) => (
                      <tr key={sp.spam_id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px' }}>
                          {sp.phone_number}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '12.5px' }}>{sp.caller_name}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sp.category}</td>
                        <td>
                          <span className={`chip ${sp.is_spam ? 'chip-spam' : 'chip-legit'}`} style={{ fontSize: '10.5px' }}>
                            {sp.is_spam ? 'SPAM' : 'LEGIT'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleSelectPreset(sp)}
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              title="Load into dialer"
                            >
                              Dial
                            </button>
                            <button
                              onClick={() => handleOpenEditSpam(sp)}
                              className="btn btn-secondary"
                              style={{ padding: '3px 7px', fontSize: '11px' }}
                              title="Edit classification"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteSpam(sp)}
                              className="btn btn-outline-danger"
                              style={{ padding: '3px 7px', fontSize: '11px' }}
                              title="Delete number"
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
        </div>
      </div>

      {/* Edit / Add Spam Modal */}
      {isEditingSpam && (
        <div className="modal-overlay" onClick={() => setIsEditingSpam(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {isNewSpam ? 'Add Number to Reputation Database' : `Edit Entry: ${editingSpamData.phone_number}`}
              </h3>
              <button className="close-btn" onClick={() => setIsEditingSpam(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSpam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingSpamData.phone_number}
                    onChange={(e) => setEditingSpamData({ ...editingSpamData, phone_number: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Classification:</label>
                  <select
                    className="form-select"
                    value={editingSpamData.is_spam ? 'SPAM' : 'LEGITIMATE'}
                    onChange={(e) => {
                      const isSpam = e.target.value === 'SPAM';
                      setEditingSpamData({
                        ...editingSpamData,
                        is_spam: isSpam,
                        risk_score: isSpam ? 85 : 5,
                        reputation_status: isSpam ? 'SUSPECTED SPAM' : 'LEGITIMATE',
                      });
                    }}
                  >
                    <option value="SPAM">SPAM (Threat / Robocall)</option>
                    <option value="LEGITIMATE">LEGITIMATE (Verified / Safe)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Caller Name / Company:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. IRS Tax Audit Threats"
                  value={editingSpamData.caller_name}
                  onChange={(e) => setEditingSpamData({ ...editingSpamData, caller_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Threat Category:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tech Support Scam"
                  value={editingSpamData.category}
                  onChange={(e) => setEditingSpamData({ ...editingSpamData, category: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reputation Status Label:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CRITICAL THREAT or LEGITIMATE"
                  value={editingSpamData.reputation_status}
                  onChange={(e) => setEditingSpamData({ ...editingSpamData, reputation_status: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes:</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editingSpamData.notes}
                  onChange={(e) => setEditingSpamData({ ...editingSpamData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditingSpam(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save to Excel Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
