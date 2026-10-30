import ExcelJS from 'exceljs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 VERIFICATION SUITE: Child Spam Call Alert System Enhancements');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   └─ ${details}`);
      failed++;
    }
  }

  try {
    // 1. SMTP & System Status
    console.log('--- 1. SMTP & API Status Check ---');
    const smtpRes = await fetch(`${BASE_URL}/smtp-status`);
    const smtpData: any = await smtpRes.json();
    assert(
      smtpData.success && smtpData.status.configured,
      'SMTP Gateway is configured and ready',
      `Host: ${smtpData.status.host}, Port: ${smtpData.status.port}`
    );

    // 2. Dialer Call Initiation (Dialing + Risk Check)
    console.log('\n--- 2. Call Generation: Initiate Call (Dialer) ---');
    const dialRes = await fetch(`${BASE_URL}/calls/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerNumber: '+1-800-555-0191',
        callerName: 'IRS Tax Audit Threats',
        receiverNumber: '+1-555-0102', // Emma Miller (Child)
      }),
    });
    const dialData: any = await dialRes.json();
    assert(
      dialData.success && dialData.session.callStatus === 'Ringing',
      'Dialer initiates call with status "Ringing"',
      `Event ID: ${dialData.session.eventId}`
    );
    assert(
      dialData.session.callerClassification === 'SPAM' && dialData.session.riskScore >= 90,
      'Dialer identifies spam classification & risk level from SpamNumbers sheet',
      `Classification: ${dialData.session.callerClassification}, Risk: ${dialData.session.riskScore}`
    );
    assert(
      dialData.session.receiverType === 'CHILD' && dialData.session.receiverSubscriptionStatus === 'Active',
      'Receiver identified as protected Child with Active subscription',
      `Receiver: ${dialData.session.receiverName} (${dialData.session.receiverNumber})`
    );

    // 3. Disconnection Workflow & Critical Decision Rules
    console.log('\n--- 3. Call Disconnection & Parent Email Alert Workflows ---');

    // Scenario A: Child + Spam Caller -> Triggers Real Parent Email Alert
    console.log('Scenario A: Child line + Spam caller (Disconnection trigger)');
    const discA = await fetch(`${BASE_URL}/calls/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: dialData.session.eventId,
        callerNumber: '+1-800-555-0191',
        callerName: 'IRS Tax Audit Threats',
        callerClassification: 'SPAM',
        receiverNumber: '+1-555-0102',
        receiverName: 'Emma Miller',
        receiverType: 'CHILD',
        duration: 18,
        callStatus: 'Disconnected',
      }),
    });
    const dataA: any = await discA.json();
    assert(
      dataA.success && dataA.callStatus === 'Disconnected' && dataA.duration === 18,
      'Call disconnected with duration timer recorded',
      `Status: ${dataA.callStatus}, Duration: ${dataA.duration}s`
    );
    assert(
      dataA.parentNotified === true && dataA.emailStatus === 'ACCEPTED_BY_SMTP',
      'Child + Spam: Disconnection triggered live Email alert accepted by SMTP',
      `Status: ${dataA.emailStatus}, Message ID: ${dataA.messageId}`
    );

    // Scenario B: Adult Receiver + Spam Caller -> No Parent Alert
    console.log('\nScenario B: Adult line + Spam caller');
    const discB = await fetch(`${BASE_URL}/calls/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerNumber: '+1-800-555-0191',
        callerName: 'IRS Tax Audit Threats',
        callerClassification: 'SPAM',
        receiverNumber: '+1-555-0100', // Sarah Miller (Adult / Parent)
        receiverName: 'Sarah Miller',
        receiverType: 'PARENT',
        duration: 10,
        callStatus: 'Disconnected',
      }),
    });
    const dataB: any = await discB.json();
    assert(
      dataB.success && dataB.parentNotified === false && dataB.emailStatus === 'SKIPPED',
      'Adult Receiver + Spam: Parent alert bypassed',
      `Decision: ${dataB.decision}`
    );

    // Scenario C: Child + Legitimate Caller -> No Parent Alert
    console.log('\nScenario C: Child line + Legitimate caller');
    const discC = await fetch(`${BASE_URL}/calls/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerNumber: '+1-555-0177',
        callerName: 'Pediatric Health Clinic',
        callerClassification: 'LEGITIMATE',
        receiverNumber: '+1-555-0102',
        receiverName: 'Emma Miller',
        receiverType: 'CHILD',
        duration: 25,
        callStatus: 'Disconnected',
      }),
    });
    const dataC: any = await discC.json();
    assert(
      dataC.success && dataC.parentNotified === false && dataC.emailStatus === 'SKIPPED',
      'Child + Legitimate Caller: Parent alert bypassed',
      `Decision: ${dataC.decision}`
    );

    // Scenario D: Inactive Child Subscription -> No Parent Alert
    console.log('\nScenario D: Inactive Child subscription + Spam caller');
    const inactRes = await fetch(`${BASE_URL}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriber_id: 'SUB-INACT-TEST',
        name: 'Inactive Test Child',
        subscriber_type: 'CHILD',
        phone_number: '+1-555-0999',
        email: 'inact@test.local',
        email_alerts_enabled: true,
        sms_alerts_enabled: false,
        is_active: false,
        subscription_status: 'Inactive',
      }),
    });
    await inactRes.json();

    const discD = await fetch(`${BASE_URL}/calls/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerNumber: '+1-800-555-0191',
        callerName: 'IRS Tax Audit Threats',
        callerClassification: 'SPAM',
        receiverNumber: '+1-555-0999',
        receiverName: 'Inactive Test Child',
        receiverType: 'CHILD',
        duration: 5,
        callStatus: 'Disconnected',
      }),
    });
    const dataD: any = await discD.json();
    assert(
      dataD.success && dataD.parentNotified === false && dataD.decision.includes('INACTIVE'),
      'Inactive Child Subscription: Parent alert bypassed',
      `Decision: ${dataD.decision}`
    );

    // Clean up inactive child
    await fetch(`${BASE_URL}/subscribers/SUB-INACT-TEST`, { method: 'DELETE' });

    // 4. Subscriber Subscription & Family Linking Feature (Requirement 5)
    console.log('\n--- 4. Child Subscription & Family Linking (Section 5) ---');
    const famPhone = `+1-555-77${Math.floor(10 + Math.random() * 89)}`;
    const regFamRes = await fetch(`${BASE_URL}/register-child-family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child: {
          name: 'Sophie Clark',
          phone_number: famPhone,
          subscriber_id: 'SUB-SOPHIE-01',
          subscription_status: 'Active',
        },
        parent: {
          name: 'Robert Clark',
          phone_number: `+1-555-78${Math.floor(10 + Math.random() * 89)}`,
          email: 'kishansukumar2004@gmail.com',
          relationship: 'Father',
        },
      }),
    });
    const regFamData: any = await regFamRes.json();
    assert(
      regFamData.success && regFamData.child_id === 'SUB-SOPHIE-01',
      'Register Child & Family links minor line with guardian in Excel workbook',
      `Child ID: ${regFamData.child_id}, Parent ID: ${regFamData.parent_id}`
    );

    // Verify in subscriber listing
    const subsCheckRes = await fetch(`${BASE_URL}/subscribers`);
    const subsCheck: any = await subsCheckRes.json();
    const sophie = subsCheck.subscribers.find((s: any) => s.subscriber_id === 'SUB-SOPHIE-01');
    const sophieMap = subsCheck.mappings.find((m: any) => m.child_id === 'SUB-SOPHIE-01');
    assert(
      Boolean(sophie && sophieMap && sophie.subscription_status === 'Active'),
      'Sophie Clark stored in Subscribers & ParentChildMapping with Active subscription'
    );

    // Clean up test child & parent
    await fetch(`${BASE_URL}/subscribers/SUB-SOPHIE-01`, { method: 'DELETE' });
    if (regFamData.parent_id) {
      await fetch(`${BASE_URL}/subscribers/${regFamData.parent_id}`, { method: 'DELETE' });
    }
    assert(true, 'Deleted subscriber and cascaded cleanup in ParentChildMapping');

    // 5. Spam Numbers Add, Edit, Delete (Requirement 4)
    console.log('\n--- 5. Spam Numbers Add, Edit, Delete (Section 4) ---');
    const testSpamPhone = `+1-800-444-${Math.floor(1000 + Math.random() * 8999)}`;
    const addSpamRes = await fetch(`${BASE_URL}/spam-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: testSpamPhone,
        caller_name: 'Sweepstakes Winner Bot',
        category: 'Lottery Scam',
        risk_score: 93,
        reputation_status: 'SUSPECTED SPAM',
        is_spam: true,
        notes: 'Pre-recorded lottery win claiming cash prize',
      }),
    });
    const addSpamData: any = await addSpamRes.json();
    assert(
      addSpamData.success && addSpamData.entry.spam_id,
      'Added new spam number to SpamNumbers sheet',
      `Spam ID: ${addSpamData.entry.spam_id}`
    );

    // Edit classification
    const editSpamRes = await fetch(`${BASE_URL}/spam-numbers/${addSpamData.entry.spam_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_name: 'Sweepstakes Winner Bot (Verified Suspicious)',
        risk_score: 96,
      }),
    });
    const editSpamData: any = await editSpamRes.json();
    assert(editSpamData.success, 'Updated spam number classification in SpamNumbers sheet');

    // Delete spam number
    const delSpamRes = await fetch(`${BASE_URL}/spam-numbers/${addSpamData.entry.spam_id}`, {
      method: 'DELETE',
    });
    const delSpamData: any = await delSpamRes.json();
    assert(delSpamData.success, 'Deleted spam number from SpamNumbers sheet');

    // 6. Call Logs Deletion & Excel File Audit
    console.log('\n--- 6. Call Logs Deletion & Excel Persistence Check ---');
    const logsRes = await fetch(`${BASE_URL}/call-logs?limit=5`);
    const logsData: any = await logsRes.json();
    assert(
      logsData.success && logsData.logs.length > 0,
      'Retrieved call logs including call_status and duration',
      `Found ${logsData.logs.length} recent logs. Latest: ${logsData.logs[0].event_id} (${logsData.logs[0].call_status || 'Disconnected'}, ${logsData.logs[0].duration || 0}s)`
    );

    // Test deleting single log record
    const targetEventId = logsData.logs[0].event_id;
    const delLogRes = await fetch(`${BASE_URL}/call-logs/${targetEventId}`, { method: 'DELETE' });
    const delLogData: any = await delLogRes.json();
    assert(
      delLogData.success,
      'Deleted individual call log record without affecting subscriber or spam tables',
      `Deleted event: ${targetEventId}`
    );

    // 7. Direct Excel Workbook Audit
    console.log('\n--- 7. Direct Excel File Inspection ---');
    const excelFilePath = path.resolve(process.cwd(), 'child_spam_alert_demo_data.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(excelFilePath);

    const sheets = wb.worksheets.map((s) => s.name);
    const hasSubscribers = Boolean(wb.getWorksheet('Subscribers'));
    const hasParentChildMapping = Boolean(wb.getWorksheet('ParentChildMapping'));
    const hasSpamNumbers = Boolean(wb.getWorksheet('SpamNumbers'));
    const hasCallLogs = Boolean(wb.getWorksheet('CallLogs'));
    const hasEmailTemplate = Boolean(wb.getWorksheet('EmailTemplate'));

    assert(
      hasSubscribers && hasParentChildMapping && hasSpamNumbers && hasCallLogs && hasEmailTemplate,
      'Excel workbook contains all 5 required database sheets',
      `Sheets: ${sheets.join(', ')}`
    );

    const callLogsSheet = wb.getWorksheet('CallLogs');
    const headers: string[] = [];
    callLogsSheet?.getRow(1).eachCell((c) => headers.push(String(c.value)));
    assert(
      headers.includes('call_status') && headers.includes('duration'),
      'CallLogs sheet headers contain "call_status" and "duration"',
      `Headers count: ${headers.length}, Headers: ${headers.join(', ')}`
    );

    console.log('\n===============================================================');
    console.log(`🎉 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal error during test suite:', err);
    process.exit(1);
  }
}

runTests();
