import {
  Subscriber,
  ParentChildMapping,
  SpamNumber,
  CallLog,
  EmailTemplate,
  SimulationResult,
  OverviewStats,
  SmtpStatusResponse,
} from '../types.js';

const API_ORIGIN = (import.meta as any).env?.VITE_API_URL || '';
const BASE_URL = API_ORIGIN ? `${String(API_ORIGIN).replace(/\/+$/, '')}/api` : '/api';

export const api = {
  // Subscribers
  async getSubscribers(): Promise<{ subscribers: Subscriber[]; mappings: ParentChildMapping[] }> {
    const res = await fetch(`${BASE_URL}/subscribers`);
    if (!res.ok) throw new Error('Failed to fetch subscribers');
    const data = await res.json();
    return { subscribers: data.subscribers || [], mappings: data.mappings || [] };
  },

  async saveSubscriber(sub: Subscriber): Promise<void> {
    const res = await fetch(`${BASE_URL}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save subscriber');
    }
  },

  async updateSubscriber(id: string, sub: Partial<Subscriber>): Promise<void> {
    const res = await fetch(`${BASE_URL}/subscribers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update subscriber');
    }
  },

  async deleteSubscriber(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/subscribers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete subscriber');
    }
  },

  async bulkDeleteSubscribers(ids: string[]): Promise<void> {
    const res = await fetch(`${BASE_URL}/subscribers/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete selected subscribers');
    }
  },

  async updateChildGuardians(
    childId: string,
    guardians: Array<{
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email?: string;
      relationship?: string;
    }>
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/subscribers/${encodeURIComponent(childId)}/guardians`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guardians }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update guardians');
    }
  },

  async registerChildWithFamily(data: {
    child: {
      name: string;
      phone_number: string;
      email?: string;
      subscriber_id?: string;
      subscription_status?: 'Active' | 'Inactive';
    };
    guardians?: Array<{
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email?: string;
      relationship?: string;
    }>;
    parent?: {
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email: string;
      relationship?: string;
    };
    extraAdult?: {
      subscriber_id?: string;
      name: string;
      phone_number: string;
      email?: string;
      relationship?: string;
    };
  }): Promise<{ success: boolean; child_id?: string; parent_id?: string; extra_adult_id?: string; message?: string }> {
    const res = await fetch(`${BASE_URL}/register-child-family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    if (!res.ok || !resData.success) {
      throw new Error(resData.error || 'Failed to register child and family');
    }
    return resData;
  },

  // Mappings
  async addMapping(mapping: {
    parent_id: string;
    child_id: string;
    relationship_type: string;
    can_receive_alerts: boolean;
  }): Promise<void> {
    const res = await fetch(`${BASE_URL}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add mapping');
    }
  },

  async deleteMapping(mappingId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/mappings/${encodeURIComponent(mappingId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete mapping');
    }
  },

  // Spam Numbers
  async getSpamNumbers(): Promise<SpamNumber[]> {
    const res = await fetch(`${BASE_URL}/spam-numbers`);
    if (!res.ok) throw new Error('Failed to fetch spam numbers');
    const data = await res.json();
    return data.numbers || [];
  },

  async addSpamNumber(entry: Partial<SpamNumber>): Promise<void> {
    const res = await fetch(`${BASE_URL}/spam-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add spam number');
    }
  },

  async updateSpamNumber(id: string, entry: Partial<SpamNumber>): Promise<void> {
    const res = await fetch(`${BASE_URL}/spam-numbers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update spam number');
    }
  },

  async deleteSpamNumber(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/spam-numbers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete spam number');
    }
  },

  // Interactive Dialer & Session Calls
  async initiateCall(payload: {
    callerNumber: string;
    callerName?: string;
    receiverNumber: string;
    receiverId?: string;
  }): Promise<{ success: boolean; session: any }> {
    const res = await fetch(`${BASE_URL}/calls/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to initiate call');
    }
    return data;
  },

  async disconnectCall(payload: {
    eventId?: string;
    callerNumber: string;
    callerName?: string;
    callerClassification?: string;
    receiverId?: string;
    receiverNumber: string;
    receiverName?: string;
    receiverType?: string;
    duration: number;
    callStatus: 'Disconnected' | 'Rejected';
  }): Promise<{
    success: boolean;
    eventId: string;
    callStatus: string;
    duration: number;
    emailStatus: string;
    smsStatus: string;
    parentNotified: boolean;
    decision: string;
    details: string;
    parentRecipient: string;
    messageId?: string;
  }> {
    const res = await fetch(`${BASE_URL}/calls/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to disconnect call');
    }
    return data;
  },

  // Simulate Call
  async simulateCall(payload: {
    callerNumber: string;
    callerName?: string;
    isSpamOverride?: boolean;
    spamCategory?: string;
    riskScore?: number;
    receiverNumber: string;
  }): Promise<SimulationResult> {
    const res = await fetch(`${BASE_URL}/simulate-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Simulation failed');
    }
    return data.result;
  },

  // Call Logs
  async getCallLogs(filters?: {
    search?: string;
    classification?: string;
    receiverType?: string;
    emailStatus?: string;
    limit?: number;
  }): Promise<CallLog[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.classification) params.set('classification', filters.classification);
    if (filters?.receiverType) params.set('receiverType', filters.receiverType);
    if (filters?.emailStatus) params.set('emailStatus', filters.emailStatus);
    if (filters?.limit) params.set('limit', String(filters.limit));

    const res = await fetch(`${BASE_URL}/call-logs?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch call logs');
    const data = await res.json();
    return data.logs || [];
  },

  async getCallLogById(eventId: string): Promise<CallLog> {
    const res = await fetch(`${BASE_URL}/call-logs/${encodeURIComponent(eventId)}`);
    if (!res.ok) throw new Error('Failed to fetch call log');
    const data = await res.json();
    return data.log;
  },

  async deleteCallLog(eventId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/call-logs/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete call log');
    }
  },

  async bulkDeleteCallLogs(eventIds: string[]): Promise<void> {
    const res = await fetch(`${BASE_URL}/call-logs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete selected call logs');
    }
  },

  async clearAllCallLogs(): Promise<void> {
    const res = await fetch(`${BASE_URL}/call-logs`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to clear call logs');
    }
  },

  async retryNotification(eventId: string): Promise<{
    success: boolean;
    message: string;
    email_status: string;
  }> {
    const res = await fetch(`${BASE_URL}/retry-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    const data = await res.json();
    return data;
  },

  // Email Template
  async getEmailTemplate(): Promise<EmailTemplate> {
    const res = await fetch(`${BASE_URL}/email-template`);
    if (!res.ok) throw new Error('Failed to fetch email template');
    const data = await res.json();
    return data.template;
  },

  async saveEmailTemplate(tmpl: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const res = await fetch(`${BASE_URL}/email-template`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tmpl),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save template');
    }
    return data.template;
  },

  async resetEmailTemplate(): Promise<EmailTemplate> {
    const res = await fetch(`${BASE_URL}/email-template/reset`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset template');
    }
    return data.template;
  },

  async sendTestEmail(targetEmail: string): Promise<{
    success: boolean;
    notConfigured?: boolean;
    error?: string;
    messageId?: string;
  }> {
    const res = await fetch(`${BASE_URL}/send-test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail }),
    });
    const data = await res.json();
    return data;
  },

  // Stats & Status
  async getStats(): Promise<OverviewStats> {
    const res = await fetch(`${BASE_URL}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    return data.stats;
  },

  async getSmtpStatus(): Promise<SmtpStatusResponse> {
    const res = await fetch(`${BASE_URL}/smtp-status`);
    if (!res.ok) throw new Error('Failed to fetch SMTP status');
    return await res.json();
  },

  getExportLogsUrl(): string {
    return `${BASE_URL}/export-logs`;
  },
};
