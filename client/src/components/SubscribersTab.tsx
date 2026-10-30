import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  Baby,
  Plus,
  X,
  Check,
  Search,
  AlertCircle,
  Phone,
  Mail,
  CheckCircle2,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { Subscriber, ParentChildMapping } from '../types.js';
import { api } from '../api/client.js';

interface SubscribersTabProps {
  subscribers: Subscriber[];
  mappings: ParentChildMapping[];
  onRefresh: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

interface GuardianFormItem {
  subscriber_id?: string;
  name: string;
  phone_number: string;
  email: string;
  relationship: string;
}

export const SubscribersTab: React.FC<SubscribersTabProps> = ({
  subscribers,
  mappings,
  onRefresh,
  showToast,
}) => {
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [guardianFilter, setGuardianFilter] = useState<'ALL' | 'WITH_GUARDIAN' | 'NO_GUARDIAN'>('ALL');

  // Multi-select bulk delete state
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Auto-generate helper
  const generateNewId = () => `SUB-${Math.floor(100 + Math.random() * 900)}`;

  // --- ADD SUBSCRIPTION MODAL STATE ---
  const [isAddSubscriptionOpen, setIsAddSubscriptionOpen] = useState<boolean>(false);
  const [childForm, setChildForm] = useState({
    subscriberId: generateNewId(),
    name: '',
    phone: '+1-555-0',
    email: '',
    subscriptionStatus: 'Active' as 'Active' | 'Inactive',
  });
  const [guardiansList, setGuardiansList] = useState<GuardianFormItem[]>([
    {
      name: '',
      phone_number: '+1-555-0',
      email: '',
      relationship: 'Mother',
    },
  ]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // --- VIEW & EDIT PARENTS/GUARDIANS MODAL STATE ---
  const [selectedChildForGuardians, setSelectedChildForGuardians] = useState<Subscriber | null>(null);
  const [isEditGuardiansMode, setIsEditGuardiansMode] = useState<boolean>(false);
  const [editingGuardiansList, setEditingGuardiansList] = useState<GuardianFormItem[]>([]);
  const [isSavingGuardians, setIsSavingGuardians] = useState<boolean>(false);

  // --- EDIT CHILD MODAL STATE ---
  const [isEditingChild, setIsEditingChild] = useState<boolean>(false);
  const [editingChildData, setEditingChildData] = useState<Subscriber | null>(null);

  // Child-Centric data: filter children only
  const childSubscribers = subscribers.filter((s) => s.subscriber_type === 'CHILD');

  // Helper to find parent mappings for a child
  function getParentsForChild(childId: string) {
    const childMaps = mappings.filter((m) => (m.child_id || '').toLowerCase() === childId.toLowerCase());
    return childMaps.map((m) => {
      const parent = subscribers.find((s) => (s.subscriber_id || '').toLowerCase() === (m.parent_id || '').toLowerCase());
      return {
        mappingId: m.mapping_id,
        parentId: m.parent_id,
        parentName: parent?.name || m.parent_id,
        parentPhone: parent?.phone_number || '',
        relationship: m.relationship_type || 'Parent / Guardian',
        canReceiveAlerts: m.can_receive_alerts !== false,
        email: parent?.email || '',
      };
    });
  }

  // Filter children based on search and dropdown filters
  const filteredChildren = childSubscribers.filter((child) => {
    const isActive = child.subscription_status === 'Active' || (child.subscription_status === undefined && child.is_active);
    const linkedParents = getParentsForChild(child.subscriber_id);

    // Search query matching
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const parentNames = linkedParents.map((p) => p.parentName.toLowerCase()).join(' ');
      const parentEmails = linkedParents.map((p) => p.email.toLowerCase()).join(' ');
      const match =
        (child.name || '').toLowerCase().includes(q) ||
        (child.phone_number || '').toLowerCase().includes(q) ||
        (child.email || '').toLowerCase().includes(q) ||
        (child.subscriber_id || '').toLowerCase().includes(q) ||
        parentNames.includes(q) ||
        parentEmails.includes(q);
      if (!match) return false;
    }

    // Status filter
    if (statusFilter === 'ACTIVE' && !isActive) return false;
    if (statusFilter === 'INACTIVE' && isActive) return false;

    // Guardian filter
    if (guardianFilter === 'WITH_GUARDIAN' && linkedParents.length === 0) return false;
    if (guardianFilter === 'NO_GUARDIAN' && linkedParents.length > 0) return false;

    return true;
  });

  // --- ADD SUBSCRIPTION HANDLERS ---
  const handleOpenAddSubscription = () => {
    setChildForm({
      subscriberId: generateNewId(),
      name: '',
      phone: '+1-555-0',
      email: '',
      subscriptionStatus: 'Active',
    });
    setGuardiansList([
      {
        name: '',
        phone_number: '+1-555-0',
        email: '',
        relationship: 'Mother',
      },
    ]);
    setIsAddSubscriptionOpen(true);
  };

  const handleAddGuardianRow = () => {
    setGuardiansList((prev) => [
      ...prev,
      {
        name: '',
        phone_number: '+1-555-0',
        email: '',
        relationship: prev.length === 1 ? 'Father' : 'Legal Guardian',
      },
    ]);
  };

  const handleRemoveGuardianRow = (idx: number) => {
    setGuardiansList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGuardianFieldChange = (idx: number, field: keyof GuardianFormItem, val: string) => {
    setGuardiansList((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, [field]: val } : g))
    );
  };

  const handleSubmitAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childForm.name.trim() || !childForm.phone.trim()) {
      showToast('error', 'Child full name and phone number are required.');
      return;
    }

    // Validate guardians if entered
    for (let i = 0; i < guardiansList.length; i++) {
      const g = guardiansList[i];
      if (g.name.trim() || g.email.trim()) {
        if (!g.name.trim() || !g.phone_number.trim() || !g.email.trim()) {
          showToast('error', `Please fill in all details (name, phone, email) for Guardian #${i + 1}.`);
          return;
        }
        if (!g.email.includes('@') || !g.email.includes('.')) {
          showToast('error', `Please enter a valid email address for Guardian #${i + 1}.`);
          return;
        }
      }
    }

    const validGuardians = guardiansList.filter((g) => g.name.trim() && g.email.trim());

    setIsSaving(true);
    try {
      await api.registerChildWithFamily({
        child: {
          subscriber_id: childForm.subscriberId.trim(),
          name: childForm.name.trim(),
          phone_number: childForm.phone.trim(),
          email: childForm.email.trim() || undefined,
          subscription_status: childForm.subscriptionStatus,
        },
        guardians: validGuardians.length > 0 ? validGuardians : undefined,
      });

      showToast('success', `Successfully registered child ${childForm.name} with ${validGuardians.length} guardian(s).`);
      setIsAddSubscriptionOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save subscription');
    } finally {
      setIsSaving(false);
    }
  };

  // --- VIEW / EDIT GUARDIANS POPUP HANDLERS ---
  const handleOpenViewGuardians = (child: Subscriber) => {
    setSelectedChildForGuardians(child);
    const parents = getParentsForChild(child.subscriber_id);
    const initialList: GuardianFormItem[] = parents.map((p) => ({
      subscriber_id: p.parentId,
      name: p.parentName,
      phone_number: p.parentPhone,
      email: p.email || '',
      relationship: p.relationship || 'Parent',
    }));
    setEditingGuardiansList(initialList);
    setIsEditGuardiansMode(false);
  };

  const handleAddGuardianToEdit = () => {
    setEditingGuardiansList((prev) => [
      ...prev,
      {
        name: '',
        phone_number: '+1-555-0',
        email: '',
        relationship: 'Legal Guardian',
      },
    ]);
  };

  const handleRemoveGuardianFromEdit = (idx: number) => {
    setEditingGuardiansList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEditGuardianFieldChange = (idx: number, field: keyof GuardianFormItem, val: string) => {
    setEditingGuardiansList((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, [field]: val } : g))
    );
  };

  const handleSaveGuardiansChanges = async () => {
    if (!selectedChildForGuardians) return;

    for (let i = 0; i < editingGuardiansList.length; i++) {
      const g = editingGuardiansList[i];
      if (!g.name.trim() || !g.phone_number.trim() || !g.email.trim()) {
        showToast('error', `Name, phone number, and email are required for Guardian #${i + 1}.`);
        return;
      }
      if (!g.email.includes('@') || !g.email.includes('.')) {
        showToast('error', `Please provide a valid email address for Guardian #${i + 1}.`);
        return;
      }
    }

    setIsSavingGuardians(true);
    try {
      await api.updateChildGuardians(selectedChildForGuardians.subscriber_id, editingGuardiansList);
      showToast('success', `Updated guardians for ${selectedChildForGuardians.name} in Excel workbook.`);
      setIsEditGuardiansMode(false);
      setSelectedChildForGuardians(null);
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update guardians');
    } finally {
      setIsSavingGuardians(false);
    }
  };

  // --- EDIT CHILD MODAL HANDLERS ---
  const handleOpenEditChild = (child: Subscriber) => {
    setEditingChildData({ ...child });
    setIsEditingChild(true);
  };

  const handleSaveChildChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChildData) return;

    try {
      await api.updateSubscriber(editingChildData.subscriber_id, {
        name: editingChildData.name,
        phone_number: editingChildData.phone_number,
        email: editingChildData.email,
        subscription_status: editingChildData.subscription_status,
        is_active: editingChildData.subscription_status === 'Active',
      });
      showToast('success', `Updated subscriber ${editingChildData.name} in Excel.`);
      setIsEditingChild(false);
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update child subscriber');
    }
  };

  // --- DELETE SUBSCRIBER HANDLERS ---
  const handleDeleteChild = async (child: Subscriber) => {
    if (!window.confirm(`Delete subscriber ${child.name} (${child.phone_number}) and clean up all guardian mappings?`)) {
      return;
    }
    try {
      await api.deleteSubscriber(child.subscriber_id);
      showToast('success', `Deleted subscriber ${child.name} from Excel workbook.`);
      setSelectedChildIds((prev) => prev.filter((id) => id !== child.subscriber_id));
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete subscriber');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedChildIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedChildIds.length} selected subscriber(s)?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.bulkDeleteSubscribers(selectedChildIds);
      showToast('success', `Successfully deleted ${selectedChildIds.length} subscriber(s) from Excel.`);
      setSelectedChildIds([]);
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete selected subscribers');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--primary-950)' }}>
                Protected Minor Subscribers ({childSubscribers.length})
              </h2>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Showing {filteredChildren.length} of {childSubscribers.length} registered child lines linked with authorized parents and guardians.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {selectedChildIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="btn btn-outline-danger"
                style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px' }}
                title="Delete selected subscribers"
              >
                <Trash2 size={15} /> Delete Selected ({selectedChildIds.length})
              </button>
            )}

            <button
              onClick={handleOpenAddSubscription}
              className="btn btn-primary"
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px' }}
            >
              <UserPlus size={16} /> Add Subscription
            </button>

            <button
              onClick={onRefresh}
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '9px 12px' }}
              title="Refresh from Excel"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by child name, phone, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '13px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ fontSize: '12.5px', width: 'auto' }}
            >
              <option value="ALL">All Status ({childSubscribers.length})</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <select
              className="form-select"
              value={guardianFilter}
              onChange={(e) => setGuardianFilter(e.target.value as any)}
              style={{ fontSize: '12.5px', width: 'auto' }}
            >
              <option value="ALL">All Guardian Links</option>
              <option value="WITH_GUARDIAN">With Guardians Linked</option>
              <option value="NO_GUARDIAN">Without Guardians</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Subscribers Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', overflowX: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredChildren.length > 0 && selectedChildIds.length === filteredChildren.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChildIds(filteredChildren.map((c) => c.subscriber_id));
                      } else {
                        setSelectedChildIds([]);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Select all subscribers"
                  />
                </th>
                <th style={{ width: '12%' }}>Subscriber ID</th>
                <th style={{ width: '18%' }}>Child Subscriber</th>
                <th style={{ width: '15%' }}>Phone Number</th>
                <th style={{ width: '16%' }}>Email Address</th>
                <th style={{ width: '11%' }}>Subscription</th>
                <th style={{ width: '18%' }}>Parent / Guardian</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChildren.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Baby size={32} color="#94a3b8" />
                      <div style={{ fontWeight: 600 }}>No matching child subscribers found</div>
                      <div style={{ fontSize: '12px' }}>
                        Click "+ Add Subscription" to register a child and assign parents/guardians.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChildren.map((child) => {
                  const linkedParents = getParentsForChild(child.subscriber_id);
                  const isActive =
                    child.subscription_status === 'Active' ||
                    (child.subscription_status === undefined && child.is_active);

                  return (
                    <tr
                      key={child.subscriber_id}
                      style={{
                        background: selectedChildIds.includes(child.subscriber_id)
                          ? 'rgba(59, 130, 246, 0.05)'
                          : undefined,
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedChildIds.includes(child.subscriber_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChildIds((prev) => [...prev, child.subscriber_id]);
                            } else {
                              setSelectedChildIds((prev) => prev.filter((id) => id !== child.subscriber_id));
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Subscriber ID */}
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--primary-900)' }}>
                        {child.subscriber_id}
                      </td>

                      {/* Child Name (NO "Protected minor line" quote) */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: '#e0f2fe',
                              color: '#0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Baby size={15} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-950)' }}>
                            {child.name}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                        {child.phone_number}
                      </td>

                      {/* Email */}
                      <td style={{ fontSize: '12px', color: child.email ? 'var(--text-main)' : 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={child.email || 'None'}>
                        {child.email || '—'}
                      </td>

                      {/* Subscription Status */}
                      <td>
                        <span
                          className="chip"
                          style={{
                            background: isActive ? '#dcfce7' : '#fee2e2',
                            color: isActive ? '#15803d' : '#b91c1c',
                            fontWeight: 700,
                            fontSize: '11px',
                          }}
                        >
                          {isActive ? '● Active' : '○ Inactive'}
                        </span>
                      </td>

                      {/* Parent / Guardian Column (Clean button, no cluttered raw details) */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenViewGuardians(child)}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              background: linkedParents.length > 0 ? '#eff6ff' : '#fff1f2',
                              borderColor: linkedParents.length > 0 ? '#bfdbfe' : '#fecdd3',
                              color: linkedParents.length > 0 ? '#1d4ed8' : '#e11d48',
                            }}
                            title="View or edit parent and guardian details"
                          >
                            <Shield size={13} />
                            <span>View Parents/Guardians</span>
                            <span
                              style={{
                                background: linkedParents.length > 0 ? '#2563eb' : '#e11d48',
                                color: '#ffffff',
                                borderRadius: '10px',
                                padding: '1px 6px',
                                fontSize: '10px',
                                fontWeight: 800,
                                marginLeft: '2px',
                              }}
                            >
                              {linkedParents.length}
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleOpenEditChild(child)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Edit child subscriber"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteChild(child)}
                            className="btn btn-outline-danger"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Delete subscriber"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD SUBSCRIPTION (CHILD + DYNAMIC GUARDIANS)                     */}
      {/* ========================================================================= */}
      {isAddSubscriptionOpen && (
        <div className="modal-overlay" onClick={() => setIsAddSubscriptionOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0 }}>Add Subscription</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Register a child subscriber line and configure parents or guardians.
                  </div>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsAddSubscriptionOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* CHILD DETAILS SECTION */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Baby size={16} color="#0284c7" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-950)' }}>
                    Child Details
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Child Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Leo Miller"
                      value={childForm.name}
                      onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+1-555-0104"
                      value={childForm.phone}
                      onChange={(e) => setChildForm({ ...childForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Child Email ID</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. leo.miller@safefamily.net"
                      value={childForm.email}
                      onChange={(e) => setChildForm({ ...childForm, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subscription Status</label>
                    <select
                      className="form-select"
                      value={childForm.subscriptionStatus}
                      onChange={(e) => setChildForm({ ...childForm, subscriptionStatus: e.target.value as any })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GUARDIANS / PARENTS SECTION */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="#15803d" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                      Parents & Guardians ({guardiansList.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddGuardianRow}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Add Guardian or Parent
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {guardiansList.map((guardian, index) => (
                    <div
                      key={index}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #86efac',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                          Guardian / Parent #{index + 1}
                        </span>
                        {guardiansList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGuardianRow(index)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                            title="Remove this guardian"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Full Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Sarah Miller"
                            value={guardian.name}
                            onChange={(e) => handleGuardianFieldChange(index, 'name', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Phone Number *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="+1-555-0100"
                            value={guardian.phone_number}
                            onChange={(e) => handleGuardianFieldChange(index, 'phone_number', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Email Address (for Spam Alerts) *</label>
                          <input
                            type="email"
                            className="form-input"
                            placeholder="e.g. sarah.miller@example.com"
                            value={guardian.email}
                            onChange={(e) => handleGuardianFieldChange(index, 'email', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Relationship</label>
                          <select
                            className="form-select"
                            value={guardian.relationship}
                            onChange={(e) => handleGuardianFieldChange(index, 'relationship', e.target.value)}
                          >
                            <option value="Mother">Mother</option>
                            <option value="Father">Father</option>
                            <option value="Legal Guardian">Legal Guardian</option>
                            <option value="Grandparent">Grandparent</option>
                            <option value="Other Adult">Other Adult</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddSubscriptionOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW & EDIT PARENTS/GUARDIANS POP-UP                             */}
      {/* ========================================================================= */}
      {selectedChildForGuardians && (
        <div className="modal-overlay" onClick={() => setSelectedChildForGuardians(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0 }}>
                    Guardians for {selectedChildForGuardians.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Line: <strong>{selectedChildForGuardians.phone_number}</strong> • ID: {selectedChildForGuardians.subscriber_id}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isEditGuardiansMode ? (
                  <button
                    type="button"
                    onClick={() => setIsEditGuardiansMode(true)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit2 size={13} /> Edit Details
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddGuardianToEdit}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Add Guardian
                  </button>
                )}

                <button className="close-btn" onClick={() => setSelectedChildForGuardians(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* GUARDIANS CONTENT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              {!isEditGuardiansMode ? (
                // VIEW MODE
                editingGuardiansList.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '10px',
                      color: '#be123c',
                    }}
                  >
                    <AlertCircle size={24} style={{ marginBottom: '6px' }} />
                    <div style={{ fontWeight: 700 }}>No guardians linked to this child line yet.</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Click "Edit Details" above to add an authorized parent or guardian.
                    </div>
                  </div>
                ) : (
                  editingGuardiansList.map((g, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary-950)' }}>
                            {g.name}
                          </span>
                          <span
                            className="chip"
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 8px',
                            }}
                          >
                            {g.relationship || 'Guardian'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} /> {g.phone_number}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb' }}>
                            <Mail size={12} /> {g.email || 'No email configured'}
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          color: '#15803d',
                          fontWeight: 700,
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        🔔 Alert Recipient
                      </span>
                    </div>
                  ))
                )
              ) : (
                // EDIT MODE
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editingGuardiansList.map((g, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                          Guardian #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuardianFromEdit(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Remove guardian"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Full Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={g.name}
                            onChange={(e) => handleEditGuardianFieldChange(idx, 'name', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Phone Number *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={g.phone_number}
                            onChange={(e) => handleEditGuardianFieldChange(idx, 'phone_number', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Email Address *</label>
                          <input
                            type="email"
                            className="form-input"
                            value={g.email}
                            onChange={(e) => handleEditGuardianFieldChange(idx, 'email', e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11px' }}>Relationship</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Mother, Father, Legal Guardian"
                            value={g.relationship}
                            onChange={(e) => handleEditGuardianFieldChange(idx, 'relationship', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FOOTER BUTTONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                {isEditGuardiansMode ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditGuardiansMode(false)}
                      disabled={isSavingGuardians}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveGuardiansChanges}
                      disabled={isSavingGuardians}
                    >
                      {isSavingGuardians ? 'Saving Changes...' : 'Save Guardian Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedChildForGuardians(null)}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT CHILD SUBSCRIBER INFO                                       */}
      {/* ========================================================================= */}
      {isEditingChild && editingChildData && (
        <div className="modal-overlay" onClick={() => setIsEditingChild(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Child Subscriber</h3>
              <button className="close-btn" onClick={() => setIsEditingChild(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveChildChanges} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Subscriber ID (Read-only)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingChildData.subscriber_id}
                  disabled
                  style={{ background: '#f1f5f9' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingChildData.name}
                  onChange={(e) => setEditingChildData({ ...editingChildData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingChildData.phone_number}
                  onChange={(e) => setEditingChildData({ ...editingChildData, phone_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={editingChildData.email || ''}
                  onChange={(e) => setEditingChildData({ ...editingChildData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subscription Status</label>
                <select
                  className="form-select"
                  value={editingChildData.subscription_status || (editingChildData.is_active ? 'Active' : 'Inactive')}
                  onChange={(e) =>
                    setEditingChildData({
                      ...editingChildData,
                      subscription_status: e.target.value as any,
                      is_active: e.target.value === 'Active',
                    })
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditingChild(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
