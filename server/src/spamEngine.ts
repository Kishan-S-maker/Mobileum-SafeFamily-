import { v4 as uuidv4 } from 'uuid';
import { excelService } from './excelService.js';
import { emailService } from './emailService.js';
import { smsService } from './smsService.js';
import {
  Subscriber,
  CallLog,
  SimulationStep,
  SimulationResult,
  DecisionCode,
  EmailDeliveryStatus,
  SmsDeliveryStatus,
  CallStatus,
} from './types.js';

export interface IncomingCallPayload {
  callerNumber: string;
  callerName?: string;
  isSpamOverride?: boolean; // Can override or let DB decide
  spamCategory?: string;
  riskScore?: number;
  receiverNumber: string;
  callStatus?: CallStatus;
  duration?: number;
}

export class SpamCallProcessingEngine {
  /**
   * Main entrypoint for processing any incoming telecom call event.
   * Usable by both the Web Simulator and future live Telecom Firewall Webhooks.
   */
  async processIncomingCall(payload: IncomingCallPayload): Promise<SimulationResult> {
    const timestamp = new Date().toISOString();
    const eventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const steps: SimulationStep[] = [];

    // --- STEP 1: Incoming Call Received ---
    const rawCallerNumber = (payload.callerNumber || '').trim();
    const rawReceiverNumber = (payload.receiverNumber || '').trim();

    steps.push({
      stepIndex: 1,
      title: 'Incoming Call Intercepted',
      status: 'INFO',
      description: `Telecom signaling intercepted incoming call: ${rawCallerNumber} -> ${rawReceiverNumber}`,
      data: {
        callerNumber: rawCallerNumber,
        receiverNumber: rawReceiverNumber,
        timestamp,
        eventId,
      },
    });

    // --- STEP 2: Spam Classification Checked ---
    const spamRecords = await excelService.getSpamNumbers();
    const cleanCaller = rawCallerNumber.replace(/[^0-9]/g, '');

    const matchingSpam = spamRecords.find(
      (s) => s.phone_number.replace(/[^0-9]/g, '') === cleanCaller
    );

    let isSpam = false;
    let callerName = payload.callerName || 'Unknown Caller';
    let spamCategory = payload.spamCategory || 'General Caller';
    let riskScore = payload.riskScore || 0;

    if (payload.isSpamOverride !== undefined) {
      isSpam = payload.isSpamOverride;
      if (matchingSpam) {
        callerName = payload.callerName || matchingSpam.caller_name;
        spamCategory = payload.spamCategory || matchingSpam.category;
        riskScore = payload.riskScore !== undefined ? payload.riskScore : matchingSpam.risk_score;
      } else {
        riskScore = isSpam ? 85 : 5;
        spamCategory = isSpam ? 'Suspicious Robocall' : 'Verified Caller';
      }
    } else if (matchingSpam) {
      isSpam = matchingSpam.is_spam;
      callerName = matchingSpam.caller_name;
      spamCategory = matchingSpam.category;
      riskScore = matchingSpam.risk_score;
    } else {
      // Unknown number: default to legitimate unless specified
      isSpam = false;
      callerName = 'Unknown Caller';
      spamCategory = 'Unregistered Caller';
      riskScore = 15;
    }

    const callerClassification: 'SPAM' | 'LEGITIMATE' = isSpam ? 'SPAM' : 'LEGITIMATE';

    steps.push({
      stepIndex: 2,
      title: 'Spam Classification Evaluated',
      status: isSpam ? 'WARNING' : 'SUCCESS',
      description: isSpam
        ? `CLASSIFIED AS SPAM (${spamCategory}, Risk Score: ${riskScore}/100)`
        : `CLASSIFIED AS LEGITIMATE (${callerName || 'Safe caller'}, Risk: ${riskScore}/100)`,
      data: {
        callerName,
        classification: callerClassification,
        category: spamCategory,
        riskScore,
      },
    });

    // --- STEP 3: Receiver Identified ---
    const receiverSub = await excelService.getSubscriberByPhone(rawReceiverNumber);

    if (!receiverSub) {
      const errorMsg = `Receiver phone number ${rawReceiverNumber} is not registered in telecom subscriber directory.`;
      steps.push({
        stepIndex: 3,
        title: 'Receiver Lookup Failed',
        status: 'FAILED',
        description: errorMsg,
      });

      const failedLog: CallLog = {
        event_id: eventId,
        timestamp,
        caller_number: rawCallerNumber,
        caller_classification: callerClassification,
        caller_name: callerName,
        receiver_name: 'Unregistered Number',
        receiver_number: rawReceiverNumber,
        receiver_type: 'CHILD',
        parent_recipient: 'None',
        decision: 'NO ALERT — UNREGISTERED RECEIVER',
        email_status: 'SKIPPED',
        sms_status: 'SKIPPED',
        details: errorMsg,
      };
      await excelService.addCallLog(failedLog);

      return {
        success: false,
        event_id: eventId,
        timestamp,
        caller: {
          number: rawCallerNumber,
          name: callerName,
          is_spam: isSpam,
          category: spamCategory,
          risk_score: riskScore,
        },
        receiver: {
          id: 'UNKNOWN',
          name: 'Unregistered Subscriber',
          type: 'CHILD',
          phone: rawReceiverNumber,
          email: '',
          email_alerts_enabled: false,
        },
        linked_parents: [],
        decision: 'NO ALERT — UNREGISTERED RECEIVER',
        decision_code: 'NO_ALERT_LEGITIMATE_CALL',
        email_status: 'SKIPPED',
        sms_status: 'SKIPPED',
        steps,
      };
    }

    steps.push({
      stepIndex: 3,
      title: 'Receiver Identified',
      status: 'SUCCESS',
      description: `Matched subscriber: ${receiverSub.name} (${receiverSub.subscriber_id}), Type: ${receiverSub.subscriber_type}`,
      data: {
        id: receiverSub.subscriber_id,
        name: receiverSub.name,
        type: receiverSub.subscriber_type,
        isActive: receiverSub.is_active,
      },
    });

    // --- STEP 4: Parent-Child Relationship Checked ---
    const allMappings = await excelService.getParentChildMappings();
    const allSubs = await excelService.getSubscribers();

    const linkedMappings = allMappings.filter(
      (m) => m.child_id.toLowerCase() === receiverSub.subscriber_id.toLowerCase()
    );

    const linkedParents: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      relationship: string;
      email_alerts_enabled: boolean;
    }> = [];

    for (const map of linkedMappings) {
      const parent = allSubs.find(
        (s) => s.subscriber_id.toLowerCase() === map.parent_id.toLowerCase()
      );
      if (parent && parent.is_active) {
        linkedParents.push({
          id: parent.subscriber_id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone_number,
          relationship: map.relationship_type,
          email_alerts_enabled: parent.email_alerts_enabled && map.can_receive_alerts,
        });
      }
    }

    if (receiverSub.subscriber_type === 'CHILD') {
      if (linkedParents.length > 0) {
        steps.push({
          stepIndex: 4,
          title: 'Parent-Child Mapping Verified',
          status: 'SUCCESS',
          description: `Found ${linkedParents.length} active guardian(s): ${linkedParents.map((p) => `${p.name} (${p.relationship})`).join(', ')}`,
          data: { linkedParents },
        });
      } else {
        steps.push({
          stepIndex: 4,
          title: 'Parent-Child Mapping Checked',
          status: 'WARNING',
          description: `Child subscriber ${receiverSub.name} has NO registered active parent mappings in database.`,
        });
      }
    } else {
      steps.push({
        stepIndex: 4,
        title: 'Subscriber Type Evaluated',
        status: 'INFO',
        description: `Subscriber ${receiverSub.name} is an adult PARENT line. Child safety routing bypassed.`,
      });
    }

    // --- STEP 5: Alert Decision Made ---
    let decision = '';
    let decisionCode: DecisionCode = 'NO_ALERT_LEGITIMATE_CALL';
    let shouldSendEmail = false;
    let decisionReason = '';

    if (!isSpam) {
      decision = 'NO ALERT — LEGITIMATE CALL';
      decisionCode = 'NO_ALERT_LEGITIMATE_CALL';
      decisionReason = 'Call verified as safe / legitimate. Guardian alert not required.';
      shouldSendEmail = false;
    } else if (receiverSub.subscriber_type === 'PARENT') {
      decision = 'NO ALERT — RECEIVER IS A PARENT';
      decisionCode = 'NO_ALERT_RECEIVER_IS_A_PARENT';
      decisionReason = 'Receiver is an adult parent line. Child spam alerts apply strictly to minor subscriber lines.';
      shouldSendEmail = false;
    } else if (receiverSub.subscriber_type === 'CHILD' && !receiverSub.is_active) {
      decision = 'NO ALERT — INACTIVE SUBSCRIPTION';
      decisionCode = 'NO_ALERT_INACTIVE_SUBSCRIPTION';
      decisionReason = `Minor subscriber ${receiverSub.name} has an INACTIVE subscription status. Parent safety alerts bypassed.`;
      shouldSendEmail = false;
    } else if (linkedParents.length === 0) {
      decision = 'NO ALERT — NO PARENT MAPPING';
      decisionCode = 'NO_ALERT_NO_PARENT_MAPPING';
      decisionReason = `Minor subscriber ${receiverSub.name} received spam, but no parent/guardian mapping exists in database. Event logged for audit.`;
      shouldSendEmail = false;
    } else {
      // Child received spam call, has active subscription, and has linked parents!
      shouldSendEmail = true;
      decisionReason = `Child received high-risk spam call. Dispatched emergency alert to ${linkedParents.length} authorized guardian(s).`;
    }

    steps.push({
      stepIndex: 5,
      title: 'Alert Decision Resolved',
      status: shouldSendEmail ? 'WARNING' : 'INFO',
      description: shouldSendEmail
        ? `ALERT TRIGGERED: Minor subscriber ${receiverSub.name} targeted by spam call.`
        : `NO ALERT TRIGGERED: ${decisionReason}`,
      data: { decision, shouldSendEmail, reason: decisionReason },
    });

    // --- STEP 6: Multi-Channel Alert Dispatch (Email & Carrier SMS) ---
    let emailStatus: EmailDeliveryStatus = 'SKIPPED';
    let emailDetails: SimulationResult['email_details'] = undefined;
    let smsStatus: SmsDeliveryStatus = 'SKIPPED';
    let smsDetails: SimulationResult['sms_details'] = undefined;

    if (!shouldSendEmail) {
      emailStatus = 'SKIPPED';
      smsStatus = 'SKIPPED';
      steps.push({
        stepIndex: 6,
        title: 'Alert Notifications Skipped',
        status: 'INFO',
        description: `SMS & Email alerts skipped. Reason: ${decisionReason}`,
      });
    } else {
      // 1. Dispatch Real-Time Carrier SMS to Guardian(s)
      const recipientPhones = linkedParents
        .map((p) => p.phone)
        .filter((phone) => Boolean(phone));

      if (recipientPhones.length > 0) {
        const smsResult = await smsService.sendAlertSms(recipientPhones, {
          parent_name: linkedParents.map((p) => p.name).join(' & '),
          child_name: receiverSub.name,
          caller_number: rawCallerNumber,
          child_phone: receiverSub.phone_number,
          spam_classification: `${spamCategory} (${callerName})`,
          event_time: new Date().toLocaleString(),
        });

        smsStatus = smsResult.status;
        smsDetails = {
          recipients: recipientPhones,
          message: smsResult.message,
          messageId: smsResult.messageId,
          carrierDeliveryId: smsResult.carrierDeliveryId,
          error: smsResult.error,
        };
      } else {
        smsStatus = 'SKIPPED';
      }

      // 2. Dispatch Real-Time Email Alert to Guardian(s)
      const eligibleParents = linkedParents.filter((p) => p.email_alerts_enabled && p.email);
      const recipientEmails = eligibleParents.map((p) => p.email);

      if (eligibleParents.length === 0) {
        emailStatus = 'SKIPPED';
        decision = 'PARENT SMS DELIVERED (EMAIL DISABLED)';
        decisionCode = 'PARENT_ALERT_SENT';
        steps.push({
          stepIndex: 6,
          title: 'Alert Dispatched via SMS (Email Disabled)',
          status: 'WARNING',
          description: `Carrier SMS delivered to ${recipientPhones.join(', ')}. Email alerts disabled by guardians.`,
        });
      } else {
        const template = await excelService.getEmailTemplate();
        const emailResult = await emailService.sendAlertEmail(recipientEmails, template, {
          parent_name: eligibleParents.map((p) => p.name).join(' & '),
          child_name: receiverSub.name,
          caller_number: rawCallerNumber,
          child_phone: receiverSub.phone_number,
          event_time: new Date().toLocaleString(),
          spam_classification: `${spamCategory} (${callerName})`,
        });

        if (emailResult.notConfigured) {
          emailStatus = 'NOT_CONFIGURED';
          decision = 'ALERT SENT (SMS DELIVERED, SMTP UNCONFIGURED)';
          decisionCode = 'EMAIL_NOT_CONFIGURED';
          emailDetails = {
            recipients: recipientEmails,
            subject: emailResult.subject,
            error: 'SMTP credentials not configured in environment (.env).',
          };
          steps.push({
            stepIndex: 6,
            title: 'Alert Dispatched (Carrier SMS Live, SMTP Unconfigured)',
            status: 'WARNING',
            description: `Carrier SMS alert delivered to ${recipientPhones.join(', ')}. SMTP not configured; simulated email ready.`,
            data: { email: emailDetails, sms: smsDetails },
          });
        } else if (emailResult.success) {
          emailStatus = 'ACCEPTED_BY_SMTP';
          decision = 'PARENT ALERTS SENT (SMS + EMAIL)';
          decisionCode = 'PARENT_ALERT_SENT';
          emailDetails = {
            recipients: recipientEmails,
            subject: emailResult.subject,
            messageId: emailResult.messageId,
          };
          steps.push({
            stepIndex: 6,
            title: 'Real-Time Guardian Alerts Dispatched (SMS + Email)',
            status: 'SUCCESS',
            description: `Multi-channel safety dispatch successful: Live Email accepted by Gmail SMTP [ID: ${emailResult.messageId || 'OK'}] to ${recipientEmails.join(', ')} & Carrier SMS dispatched to ${recipientPhones.join(', ')} [Carrier ID: ${smsDetails?.carrierDeliveryId || 'OK'}].`,
            data: { email: emailDetails, sms: smsDetails },
          });
        } else {
          emailStatus = 'FAILED';
          decision = 'SMS DELIVERED — EMAIL RETRY AVAILABLE';
          decisionCode = 'EMAIL_FAILED_RETRY_AVAILABLE';
          emailDetails = {
            recipients: recipientEmails,
            subject: emailResult.subject,
            error: emailResult.error,
          };
          steps.push({
            stepIndex: 6,
            title: 'Guardian Alerts (SMS Delivered, Email Failed)',
            status: 'WARNING',
            description: `Carrier SMS delivered to ${recipientPhones.join(', ')}, but SMTP delivery failed: ${emailResult.error || 'Connection error'}. Email retry available from Call Logs.`,
            data: { email: emailDetails, sms: smsDetails },
          });
        }
      }
    }

    // Persist new CallLog to Excel workbook
    const parentRecipientStr =
      linkedParents.length > 0
        ? linkedParents.map((p) => `${p.name} (${p.email || 'No email'}) [${p.phone || 'No phone'}]`).join(', ')
        : 'None';

    const logEntry: CallLog = {
      event_id: eventId,
      timestamp,
      caller_number: rawCallerNumber,
      caller_classification: callerClassification,
      caller_name: callerName,
      receiver_name: receiverSub.name,
      receiver_number: rawReceiverNumber,
      receiver_type: receiverSub.subscriber_type,
      parent_recipient: parentRecipientStr,
      decision,
      email_status: emailStatus,
      sms_status: smsStatus,
      call_status: payload.callStatus || 'Disconnected',
      duration: payload.duration !== undefined ? payload.duration : 0,
      details: decisionReason,
      error_message: emailDetails?.error || smsDetails?.error,
    };

    await excelService.addCallLog(logEntry);

    return {
      success: true,
      event_id: eventId,
      timestamp,
      caller: {
        number: rawCallerNumber,
        name: callerName,
        is_spam: isSpam,
        category: spamCategory,
        risk_score: riskScore,
      },
      receiver: {
        id: receiverSub.subscriber_id,
        name: receiverSub.name,
        type: receiverSub.subscriber_type,
        phone: receiverSub.phone_number,
        email: receiverSub.email,
        email_alerts_enabled: receiverSub.email_alerts_enabled,
      },
      linked_parents: linkedParents,
      decision,
      decision_code: decisionCode,
      email_status: emailStatus,
      email_details: emailDetails,
      sms_status: smsStatus,
      sms_details: smsDetails,
      steps,
    };
  }

  // Retry sending an email alert for a previous call log event
  async retryNotification(eventId: string): Promise<{
    success: boolean;
    message: string;
    email_status: EmailDeliveryStatus;
  }> {
    const log = await excelService.getCallLogById(eventId);
    if (!log) {
      return { success: false, message: `Event ID ${eventId} not found`, email_status: 'FAILED' };
    }

    if (log.caller_classification !== 'SPAM' || log.receiver_type !== 'CHILD') {
      return {
        success: false,
        message: 'This event was not an alertable child spam call.',
        email_status: log.email_status,
      };
    }

    const receiverSub = await excelService.getSubscriberByPhone(log.receiver_number);
    if (!receiverSub) {
      return { success: false, message: 'Receiver subscriber no longer exists', email_status: 'FAILED' };
    }

    const allMappings = await excelService.getParentChildMappings();
    const allSubs = await excelService.getSubscribers();
    const parentMappings = allMappings.filter(
      (m) => m.child_id.toLowerCase() === receiverSub.subscriber_id.toLowerCase()
    );

    const eligibleParents = allSubs.filter(
      (s) =>
        s.subscriber_type === 'PARENT' &&
        s.is_active &&
        s.email &&
        s.email_alerts_enabled &&
        parentMappings.some(
          (m) => m.parent_id.toLowerCase() === s.subscriber_id.toLowerCase() && m.can_receive_alerts
        )
    );

    if (eligibleParents.length === 0) {
      return {
        success: false,
        message: 'No eligible parents with active email addresses found.',
        email_status: 'SKIPPED',
      };
    }

    const template = await excelService.getEmailTemplate();
    const recipientEmails = eligibleParents.map((p) => p.email);

    const sendRes = await emailService.sendAlertEmail(recipientEmails, template, {
      parent_name: eligibleParents.map((p) => p.name).join(' & '),
      child_name: receiverSub.name,
      caller_number: log.caller_number,
      child_phone: receiverSub.phone_number,
      event_time: log.timestamp,
      spam_classification: `${log.caller_classification} (${log.caller_name})`,
    });

    if (sendRes.success) {
      await excelService.updateCallLog(eventId, {
        decision: 'PARENT ALERT SENT (RETRIED)',
        email_status: 'ACCEPTED_BY_SMTP',
        details: `${log.details} [Retried successfully at ${new Date().toISOString()}]`,
        error_message: undefined,
      });
      return {
        success: true,
        message: `Retry succeeded: Alert accepted by SMTP server for ${recipientEmails.join(', ')}`,
        email_status: 'ACCEPTED_BY_SMTP',
      };
    } else if (sendRes.notConfigured) {
      return {
        success: false,
        message: 'Cannot retry: SMTP credentials are not configured in .env',
        email_status: 'NOT_CONFIGURED',
      };
    } else {
      await excelService.updateCallLog(eventId, {
        decision: 'EMAIL FAILED — RETRY AVAILABLE',
        email_status: 'FAILED',
        error_message: sendRes.error,
      });
      return {
        success: false,
        message: `Retry failed: ${sendRes.error}`,
        email_status: 'FAILED',
      };
    }
  }
}

export const spamEngine = new SpamCallProcessingEngine();
