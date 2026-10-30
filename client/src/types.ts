export type SubscriberType = 'CHILD' | 'PARENT';

export interface Subscriber {
  subscriber_id: string;
  name: string;
  subscriber_type: SubscriberType;
  phone_number: string;
  email: string;
  email_alerts_enabled: boolean;
  sms_alerts_enabled: boolean;
  is_active: boolean;
  subscription_status?: 'Active' | 'Inactive';
  created_at: string;
}

export interface ParentChildMapping {
  mapping_id: string;
  parent_id: string;
  child_id: string;
  relationship_type: string;
  can_receive_alerts: boolean;
  created_at: string;
}

export interface SpamNumber {
  spam_id: string;
  phone_number: string;
  caller_name: string;
  category: string;
  risk_score: number;
  reputation_status: string;
  is_spam: boolean;
  notes: string;
}

export type DecisionCode =
  | 'PARENT_ALERT_SENT'
  | 'NO_ALERT_LEGITIMATE_CALL'
  | 'NO_ALERT_RECEIVER_IS_A_PARENT'
  | 'NO_ALERT_NO_PARENT_MAPPING'
  | 'NO_ALERT_INACTIVE_SUBSCRIPTION'
  | 'EMAIL_FAILED_RETRY_AVAILABLE'
  | 'EMAIL_NOT_CONFIGURED';

export type EmailDeliveryStatus =
  | 'ACCEPTED_BY_SMTP'
  | 'SKIPPED'
  | 'FAILED'
  | 'NOT_CONFIGURED'
  | 'RETRIED';

export type SmsDeliveryStatus =
  | 'DELIVERED'
  | 'SKIPPED'
  | 'FAILED'
  | 'NOT_CONFIGURED';

export type CallStatus =
  | 'Calling'
  | 'Ringing'
  | 'Connected'
  | 'Disconnected'
  | 'Rejected';

export interface CallLog {
  event_id: string;
  timestamp: string;
  caller_number: string;
  caller_classification: 'SPAM' | 'LEGITIMATE';
  caller_name: string;
  receiver_name: string;
  receiver_number: string;
  receiver_type: SubscriberType;
  parent_recipient: string;
  decision: string;
  email_status: EmailDeliveryStatus;
  sms_status?: SmsDeliveryStatus;
  call_status?: CallStatus;
  duration?: number;
  details: string;
  error_message?: string;
}

export interface ActiveCallSession {
  sessionId: string;
  callerNumber: string;
  callerName: string;
  isSpam: boolean;
  category: string;
  riskScore: number;
  receiverNumber: string;
  receiverName: string;
  receiverType: SubscriberType;
  receiverId?: string;
  isReceiverChildActive: boolean;
  status: CallStatus;
  startTime: string;
  duration: number;
  emailStatus?: EmailDeliveryStatus;
  smsStatus?: SmsDeliveryStatus;
  parentRecipient?: string;
  parentNotifiedMessage?: string;
  disconnectNotice?: string;
}

export interface EmailTemplate {
  template_id: string;
  template_name: string;
  subject: string;
  body_html: string;
  body_text: string;
  updated_at: string;
  is_active: boolean;
}

export interface SimulationStep {
  stepIndex: number;
  title: string;
  status: 'SUCCESS' | 'WARNING' | 'SKIPPED' | 'FAILED' | 'INFO';
  description: string;
  data?: Record<string, any>;
}

export interface SimulationResult {
  success: boolean;
  event_id: string;
  timestamp: string;
  caller: {
    number: string;
    name: string;
    is_spam: boolean;
    category: string;
    risk_score: number;
    riskScore?: number;
  };
  receiver: {
    id: string;
    name: string;
    type: SubscriberType;
    phone: string;
    email: string;
    email_alerts_enabled: boolean;
  };
  linked_parents: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    relationship: string;
    email_alerts_enabled: boolean;
  }>;
  decision: string;
  decision_code: DecisionCode;
  email_status: EmailDeliveryStatus;
  email_details?: {
    recipients: string[];
    subject: string;
    messageId?: string;
    error?: string;
    preview_url?: string;
  };
  sms_status?: SmsDeliveryStatus;
  sms_details?: {
    recipients: string[];
    message: string;
    messageId?: string;
    carrierDeliveryId?: string;
    error?: string;
  };
  steps: SimulationStep[];
}

export interface OverviewStats {
  registeredChildren: number;
  registeredParents: number;
  spamCallsSimulated: number;
  parentAlertsTriggered: number;
  emailsAcceptedBySmtp: number;
  failedNotifications: number;
  unconfiguredNotifications: number;
  totalSubscribers: number;
  recentLogs: CallLog[];
  categoryDistribution: { category: string; count: number }[];
}

export interface SmtpStatusResponse {
  success: boolean;
  status: {
    configured: boolean;
    host: string;
    port: number;
    user: string;
    from: string;
  };
  connection: {
    ok: boolean;
    message: string;
  };
}
