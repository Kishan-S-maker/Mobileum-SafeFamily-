import { Router, Request, Response } from 'express';
import { excelService } from '../excelService.js';
import { emailService } from '../emailService.js';
import { smsService } from '../smsService.js';
import { spamEngine } from '../spamEngine.js';
import {
  Subscriber,
  ParentChildMapping,
  SpamNumber,
  CallLog,
  CallStatus,
  EmailDeliveryStatus,
  SmsDeliveryStatus,
} from '../types.js';

export const apiRouter = Router();

// --- SUBSCRIBERS ---
apiRouter.get('/subscribers', async (_req: Request, res: Response) => {
  try {
    const subscribers = await excelService.getSubscribers();
    const mappings = await excelService.getParentChildMappings();
    return res.json({ success: true, subscribers, mappings });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/subscribers', async (req: Request, res: Response) => {
  try {
    const sub: Subscriber = req.body;
    if (!sub.subscriber_id || !sub.name || !sub.phone_number || !sub.subscriber_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subscriber_id, name, phone_number, subscriber_type',
      });
    }

    const result = await excelService.saveSubscriber(sub);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Subscriber saved successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.put('/subscribers/:id', async (req: Request, res: Response) => {
  try {
    const sub: Subscriber = { ...req.body, subscriber_id: req.params.id };
    const result = await excelService.saveSubscriber(sub);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Subscriber updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/subscribers/:id', async (req: Request, res: Response) => {
  try {
    const result = await excelService.deleteSubscriber(req.params.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Subscriber deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/subscribers/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }
    const result = await excelService.bulkDeleteSubscribers(ids);
    return res.json({ ...result, message: `Deleted ${result.deletedCount} subscribers` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.put('/subscribers/:childId/guardians', async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const { guardians } = req.body;
    if (!Array.isArray(guardians)) {
      return res.status(400).json({ success: false, error: 'guardians array is required' });
    }
    const result = await excelService.updateChildGuardians(childId, guardians);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Guardians updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/register-child-family', async (req: Request, res: Response) => {
  try {
    const result = await excelService.registerChildWithFamily(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ message: 'Child and family successfully registered', ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PARENT CHILD MAPPINGS ---
apiRouter.get('/mappings', async (_req: Request, res: Response) => {
  try {
    const mappings = await excelService.getParentChildMappings();
    return res.json({ success: true, mappings });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/mappings', async (req: Request, res: Response) => {
  try {
    const { parent_id, child_id, relationship_type, can_receive_alerts } = req.body;
    if (!parent_id || !child_id) {
      return res.status(400).json({ success: false, error: 'parent_id and child_id are required' });
    }

    const mappingId = `MAP-${Date.now().toString(36).toUpperCase()}`;
    const newMapping: ParentChildMapping = {
      mapping_id: mappingId,
      parent_id,
      child_id,
      relationship_type: relationship_type || 'Guardian',
      can_receive_alerts: can_receive_alerts !== undefined ? Boolean(can_receive_alerts) : true,
      created_at: new Date().toISOString(),
    };

    const result = await excelService.addParentChildMapping(newMapping);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, mapping: newMapping });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/mappings/:id', async (req: Request, res: Response) => {
  try {
    const result = await excelService.deleteParentChildMapping(req.params.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Mapping deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- SPAM NUMBERS ---
apiRouter.get('/spam-numbers', async (_req: Request, res: Response) => {
  try {
    const numbers = await excelService.getSpamNumbers();
    return res.json({ success: true, numbers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/spam-numbers', async (req: Request, res: Response) => {
  try {
    const { phone_number, caller_name, category, risk_score, reputation_status, is_spam, notes } =
      req.body;
    if (!phone_number || !caller_name) {
      return res.status(400).json({ success: false, error: 'phone_number and caller_name are required' });
    }

    const spamId = `SPAM-${Date.now().toString(36).toUpperCase()}`;
    const newSpam: SpamNumber = {
      spam_id: spamId,
      phone_number,
      caller_name,
      category: category || 'Custom Entry',
      risk_score: risk_score !== undefined ? parseInt(risk_score, 10) : 85,
      reputation_status: reputation_status || (is_spam ? 'SUSPECTED SPAM' : 'LEGITIMATE'),
      is_spam: is_spam !== undefined ? Boolean(is_spam) : true,
      notes: notes || 'Manually added to blacklist',
    };

    const result = await excelService.addSpamNumber(newSpam);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, entry: newSpam });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.put('/spam-numbers/:id', async (req: Request, res: Response) => {
  try {
    const result = await excelService.updateSpamNumber(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Spam number entry updated' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/spam-numbers/:id', async (req: Request, res: Response) => {
  try {
    const result = await excelService.deleteSpamNumber(req.params.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Spam number entry deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- CALL GENERATION & INTERACTIVE CALLS ---
apiRouter.post('/calls/initiate', async (req: Request, res: Response) => {
  try {
    const { callerNumber, callerName, receiverNumber, receiverId } = req.body;
    if (!callerNumber || !receiverNumber) {
      return res.status(400).json({ success: false, error: 'Caller number and receiver number are required.' });
    }

    const cleanCaller = callerNumber.replace(/[^0-9]/g, '');

    // Look up spam database
    const spamRecords = await excelService.getSpamNumbers();
    const matchedSpam = spamRecords.find(
      (s) => s.phone_number.replace(/[^0-9]/g, '') === cleanCaller
    );

    let isSpam = false;
    let resolvedCallerName = callerName || 'Unknown Caller';
    let spamCategory = 'Standard Line';
    let riskScore = 12;
    let reputationStatus = 'LEGITIMATE';

    if (matchedSpam) {
      isSpam = matchedSpam.is_spam;
      resolvedCallerName = callerName || matchedSpam.caller_name;
      spamCategory = matchedSpam.category;
      riskScore = matchedSpam.risk_score;
      reputationStatus = matchedSpam.reputation_status;
    }

    // Look up receiver subscriber (prioritize unique receiverId)
    let receiverSub: Subscriber | undefined;
    if (receiverId) {
      receiverSub = await excelService.getSubscriberById(receiverId);
    }
    if (!receiverSub) {
      receiverSub = await excelService.getSubscriberByPhone(receiverNumber);
    }

    const receiverName = receiverSub ? receiverSub.name : 'Unregistered Recipient';
    const receiverType = receiverSub ? receiverSub.subscriber_type : 'UNREGISTERED';
    const receiverSubscriptionStatus = receiverSub
      ? (receiverSub.subscription_status || (receiverSub.is_active ? 'Active' : 'Inactive'))
      : 'Inactive';

    const eventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return res.json({
      success: true,
      session: {
        eventId,
        callerNumber,
        callerName: resolvedCallerName,
        callerClassification: isSpam ? 'SPAM' : 'LEGITIMATE',
        riskScore,
        category: spamCategory,
        reputationStatus,
        receiverId: receiverSub ? receiverSub.subscriber_id : receiverId,
        receiverNumber,
        receiverName,
        receiverType,
        receiverSubscriptionStatus,
        callStatus: 'Ringing' as CallStatus,
        startTime: new Date().toISOString(),
        duration: 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/calls/disconnect', async (req: Request, res: Response) => {
  try {
    const {
      eventId,
      callerNumber,
      callerName,
      callerClassification,
      receiverId,
      receiverNumber,
      receiverName,
      receiverType,
      duration,
      callStatus,
    } = req.body;

    if (!callerNumber || !receiverNumber) {
      return res.status(400).json({ success: false, error: 'Caller and receiver numbers are required.' });
    }

    const timestamp = new Date().toISOString();
    const finalEventId = eventId || `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalCallStatus: CallStatus = callStatus === 'Rejected' ? 'Rejected' : 'Disconnected';
    const finalDuration = duration !== undefined ? Number(duration) : 0;
    const isSpam = (callerClassification || '').toUpperCase() === 'SPAM';

    // Look up receiver subscriber (prioritize unique receiverId)
    let receiverSub: Subscriber | undefined;
    if (receiverId) {
      receiverSub = await excelService.getSubscriberById(receiverId);
    }
    if (!receiverSub) {
      receiverSub = await excelService.getSubscriberByPhone(receiverNumber);
    }
    const isReceiverChild = receiverSub ? receiverSub.subscriber_type === 'CHILD' : receiverType === 'CHILD';
    const isSubscriptionActive = receiverSub ? receiverSub.is_active && receiverSub.subscription_status !== 'Inactive' : false;

    let parentNotified = false;
    let emailStatus: EmailDeliveryStatus = 'SKIPPED';
    let smsStatus: SmsDeliveryStatus = 'SKIPPED';
    let decision = '';
    let details = '';
    let parentRecipient = 'N/A';
    let emailMessageId: string | undefined;

    // Check critical conditions:
    // If receiver is registered as CHILD with Active subscription AND caller is SPAM
    if (isReceiverChild && isSubscriptionActive && isSpam) {
      // Find linked parents
      const allSubs = await excelService.getSubscribers();
      const mappings = await excelService.getParentChildMappings();
      const childMappings = mappings.filter(
        (m) => m.child_id.toLowerCase() === receiverSub!.subscriber_id.toLowerCase() && m.can_receive_alerts
      );

      const parentSubs = childMappings
        .map((m) => allSubs.find((s) => s.subscriber_id.toLowerCase() === m.parent_id.toLowerCase()))
        .filter((s): s is Subscriber => Boolean(s && s.is_active));

      const parentEmails = parentSubs
        .filter((p) => p.email_alerts_enabled && p.email && p.email.includes('@'))
        .map((p) => p.email);

      const parentPhones = parentSubs
        .filter((p) => p.sms_alerts_enabled && p.phone_number)
        .map((p) => p.phone_number);

      parentRecipient = parentSubs
        .map((p) => `${p.name} (${p.email || p.phone_number})`)
        .join(', ') || 'No Guardian Mapped';

      if (parentEmails.length > 0) {
        const template = await excelService.getEmailTemplate();
        const parentNames = parentSubs.map((p) => p.name).join(' & ');

        const emailResult = await emailService.sendAlertEmail(parentEmails, template, {
          parent_name: parentNames,
          child_name: receiverSub!.name,
          caller_number: callerNumber,
          child_phone: receiverSub!.phone_number,
          spam_classification: `${callerName || 'Spam Call'} (Threat Intercepted)`,
          event_time: new Date().toLocaleString(),
        });

        if (emailResult.notConfigured) {
          emailStatus = 'NOT_CONFIGURED';
        } else if (emailResult.success) {
          emailStatus = 'ACCEPTED_BY_SMTP';
        } else {
          emailStatus = 'FAILED';
        }
        emailMessageId = emailResult.messageId;
        parentNotified = emailResult.success;

        if (parentPhones.length > 0) {
          const smsResult = await smsService.sendAlertSms(parentPhones, {
            parent_name: parentNames,
            child_name: receiverSub!.name,
            caller_number: callerNumber,
            child_phone: receiverSub!.phone_number,
            spam_classification: callerName || 'Spam Call',
            event_time: new Date().toLocaleString(),
          });
          smsStatus = smsResult.status;
        }

        decision = 'PARENT ALERTS SENT (SMS + EMAIL)';
        details = `Spam call disconnected. Guardian safety notification dispatched to ${parentEmails.join(', ')} (Status: ${emailStatus})`;
      } else {
        decision = 'PARENT ALERT SKIPPED (NO VALID GUARDIAN EMAIL)';
        details = `Child has no linked parents with active email addresses enabled for alerts.`;
        emailStatus = 'FAILED';
      }
    } else if (isReceiverChild && !isSubscriptionActive && isSpam) {
      decision = 'PARENT ALERT SKIPPED (INACTIVE SUBSCRIPTION)';
      details = 'Child subscription is Inactive. Safety alert bypassed.';
      emailStatus = 'SKIPPED';
      smsStatus = 'SKIPPED';
    } else if (!isSpam) {
      decision = 'CALL ALLOWED (VERIFIED LEGITIMATE CALLER)';
      details = 'Call from legitimate contact was completed and disconnected normally.';
      emailStatus = 'SKIPPED';
      smsStatus = 'SKIPPED';
      parentRecipient = 'N/A (Legitimate Call)';
    } else if ((receiverSub && receiverSub.subscriber_type === 'PARENT') || receiverType === 'PARENT') {
      decision = 'CALL ALLOWED (ADULT SUBSCRIBER - NO GUARDIAN ALERT NEEDED)';
      details = 'Incoming call to adult/parent subscriber. Safety alert bypassed.';
      emailStatus = 'SKIPPED';
      smsStatus = 'SKIPPED';
      parentRecipient = 'N/A (Adult Subscriber)';
    } else {
      decision = 'CALL ALLOWED (UNREGISTERED RECEIVER)';
      details = 'Receiver number is not registered in SafeFamily directory.';
      emailStatus = 'SKIPPED';
      smsStatus = 'SKIPPED';
      parentRecipient = 'N/A (Unregistered)';
    }

    // Record complete call in Excel CallLogs sheet
    const callLog: CallLog = {
      event_id: finalEventId,
      timestamp,
      caller_number: callerNumber,
      caller_classification: isSpam ? 'SPAM' : 'LEGITIMATE',
      caller_name: callerName || (isSpam ? 'Unknown Spam' : 'Legitimate Contact'),
      receiver_name: (receiverSub ? receiverSub.name : receiverName) || 'Unregistered User',
      receiver_number: receiverNumber,
      receiver_type: (receiverSub ? receiverSub.subscriber_type : (receiverType || 'UNREGISTERED')) as any,
      parent_recipient: parentRecipient,
      decision,
      email_status: emailStatus,
      sms_status: smsStatus,
      details,
      call_status: finalCallStatus,
      duration: finalDuration,
    };

    await excelService.addCallLog(callLog);

    return res.json({
      success: true,
      eventId: finalEventId,
      callStatus: finalCallStatus,
      duration: finalDuration,
      emailStatus,
      smsStatus,
      parentNotified,
      decision,
      details,
      parentRecipient,
      messageId: emailMessageId,
    });
  } catch (err: any) {
    console.error('[API] /calls/disconnect error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- SIMULATE CALL (Core Engine) ---
apiRouter.post('/simulate-call', async (req: Request, res: Response) => {
  try {
    const { callerNumber, callerName, isSpamOverride, spamCategory, riskScore, receiverNumber } =
      req.body;

    if (!callerNumber || !receiverNumber) {
      return res.status(400).json({
        success: false,
        error: 'Both callerNumber and receiverNumber are required for simulation.',
      });
    }

    const result = await spamEngine.processIncomingCall({
      callerNumber,
      callerName,
      isSpamOverride,
      spamCategory,
      riskScore,
      receiverNumber,
    });

    return res.json({ success: true, result });
  } catch (err: any) {
    console.error('[API] /simulate-call error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- CALL LOGS ---
apiRouter.get('/call-logs', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const classification = req.query.classification as string | undefined;
    const receiverType = req.query.receiverType as string | undefined;
    const emailStatus = req.query.emailStatus as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const logs = await excelService.getCallLogs({
      search,
      classification,
      receiverType,
      emailStatus,
      limit,
    });

    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/call-logs', async (_req: Request, res: Response) => {
  try {
    const result = await excelService.clearAllCallLogs();
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'All call logs cleared successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/call-logs/:eventId', async (req: Request, res: Response) => {
  try {
    const log = await excelService.getCallLogById(req.params.eventId);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Event log not found' });
    }
    return res.json({ success: true, log });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/call-logs/:eventId', async (req: Request, res: Response) => {
  try {
    const result = await excelService.deleteCallLog(req.params.eventId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, message: 'Call log deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/call-logs/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { eventIds } = req.body;
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ success: false, error: 'eventIds array is required' });
    }
    const result = await excelService.bulkDeleteCallLogs(eventIds);
    return res.json({ ...result, message: `Deleted ${result.deletedCount} call logs` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// CSV Export
apiRouter.get('/export-logs', async (_req: Request, res: Response) => {
  try {
    const csvData = await excelService.exportLogsToCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="call_logs_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.send(csvData);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- EMAIL TEMPLATE ---
apiRouter.get('/email-template', async (_req: Request, res: Response) => {
  try {
    const template = await excelService.getEmailTemplate();
    return res.json({ success: true, template });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.put('/email-template', async (req: Request, res: Response) => {
  try {
    const { subject, body_html, body_text } = req.body;
    if (!subject || !body_html) {
      return res.status(400).json({ success: false, error: 'Subject and body_html are required' });
    }

    const result = await excelService.saveEmailTemplate({
      subject,
      body_html,
      body_text: body_text || body_html.replace(/<[^>]*>?/gm, ''),
    });

    return res.json({ success: true, template: result.template });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/email-template/reset', async (_req: Request, res: Response) => {
  try {
    const result = await excelService.resetEmailTemplate();
    return res.json({ success: true, template: result.template });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- TEST EMAIL ---
apiRouter.post('/send-test-email', async (req: Request, res: Response) => {
  try {
    const { targetEmail } = req.body;
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Target email is required' });
    }

    const template = await excelService.getEmailTemplate();
    const result = await emailService.sendTestEmail(targetEmail, template);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- RETRY NOTIFICATION ---
apiRouter.post('/retry-notification', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId is required' });
    }

    const result = await spamEngine.retryNotification(eventId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- OVERVIEW STATS ---
apiRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await excelService.getOverviewStats();
    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- SMTP / SYSTEM STATUS ---
apiRouter.get('/smtp-status', async (_req: Request, res: Response) => {
  try {
    const status = emailService.getSmtpStatus();
    const verify = await emailService.verifyConnection();
    return res.json({
      success: true,
      status,
      connection: verify,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
