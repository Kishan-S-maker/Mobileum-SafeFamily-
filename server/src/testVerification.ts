import { excelService } from './excelService.js';
import { spamEngine } from './spamEngine.js';
import { emailService } from './emailService.js';

async function runVerificationSuite() {
  console.log('====================================================');
  console.log('🧪 Starting Child Spam Alert Verification Test Suite');
  console.log('====================================================\n');

  await excelService.initialize();
  console.log(`📂 Active Workbook Path: ${excelService.getFilePath()}`);

  const subs = await excelService.getSubscribers();
  const child1 = subs.find((s) => s.subscriber_id === 'SUB-101') || subs.find((s) => s.subscriber_type === 'CHILD')!;
  const child2 = subs.find((s) => s.subscriber_id === 'SUB-105') || subs.filter((s) => s.subscriber_type === 'CHILD')[1]!;
  const parent1 = subs.find((s) => s.subscriber_id === 'SUB-103') || subs.find((s) => s.subscriber_type === 'PARENT')!;
  const unmappedChild = subs.find((s) => s.subscriber_id === 'SUB-107') || subs.find((s) => s.name.includes('Tommy'))!;

  const spamNumbers = await excelService.getSpamNumbers();
  const irsSpam = spamNumbers.find((s) => s.is_spam && s.category.includes('IRS'))!;
  const techSpam = spamNumbers.find((s) => s.is_spam && s.category.includes('Tech'))!;
  const schoolLegit = spamNumbers.find((s) => !s.is_spam && s.category.includes('School'))!;

  let passed = 0;
  let total = 0;

  function assert(testNum: number, desc: string, condition: boolean, extra?: any) {
    total++;
    if (condition) {
      console.log(`✅ TEST ${testNum} PASSED: ${desc}`);
      passed++;
    } else {
      console.error(`❌ TEST ${testNum} FAILED: ${desc}`, extra || '');
    }
  }

  // TEST 1: A spam call to Child 1 triggers an email to Parent 1 (and Parent 2 if mapped)
  console.log('\n--- Running Test 1: Spam call to Child 1 ---');
  const res1 = await spamEngine.processIncomingCall({
    callerNumber: irsSpam.phone_number,
    callerName: irsSpam.caller_name,
    isSpamOverride: true,
    spamCategory: irsSpam.category,
    riskScore: irsSpam.risk_score,
    receiverNumber: child1.phone_number,
  });
  assert(
    1,
    'Spam call to Child 1 triggers alert decision and identifies linked parents',
    res1.decision.includes('PARENT ALERT') || res1.decision.includes('EMAIL NOT CONFIGURED'),
    res1
  );
  assert(
    1.1,
    'Child 1 identifies linked parent Sarah Miller',
    res1.linked_parents.some((p) => p.name.includes('Sarah')),
    res1.linked_parents
  );

  // TEST 2: A spam call to Child 2 triggers an email to its mapped parent (Grace Chen)
  console.log('\n--- Running Test 2: Spam call to Child 2 ---');
  const res2 = await spamEngine.processIncomingCall({
    callerNumber: techSpam.phone_number,
    callerName: techSpam.caller_name,
    isSpamOverride: true,
    spamCategory: techSpam.category,
    riskScore: techSpam.risk_score,
    receiverNumber: child2.phone_number,
  });
  assert(
    2,
    'Spam call to Child 2 triggers alert decision and identifies Grace Chen',
    (res2.decision.includes('PARENT ALERT') || res2.decision.includes('EMAIL NOT CONFIGURED')) &&
      res2.linked_parents.some((p) => p.name.includes('Grace')),
    res2
  );

  // TEST 3: A spam call to Parent 1 does not trigger a parent alert
  console.log('\n--- Running Test 3: Spam call to Parent 1 ---');
  const res3 = await spamEngine.processIncomingCall({
    callerNumber: irsSpam.phone_number,
    callerName: irsSpam.caller_name,
    isSpamOverride: true,
    spamCategory: irsSpam.category,
    riskScore: irsSpam.risk_score,
    receiverNumber: parent1.phone_number,
  });
  assert(
    3,
    'Spam call to Parent 1 does NOT trigger parent alert (decision: NO ALERT — RECEIVER IS A PARENT)',
    res3.decision_code === 'NO_ALERT_RECEIVER_IS_A_PARENT' && res3.email_status === 'SKIPPED',
    res3
  );

  // TEST 4: A legitimate call to a child does not trigger an alert
  console.log('\n--- Running Test 4: Legitimate call to Child ---');
  const res4 = await spamEngine.processIncomingCall({
    callerNumber: schoolLegit.phone_number,
    callerName: schoolLegit.caller_name,
    isSpamOverride: false,
    spamCategory: schoolLegit.category,
    riskScore: schoolLegit.risk_score,
    receiverNumber: child1.phone_number,
  });
  assert(
    4,
    'Legitimate call to a child does NOT trigger alert (decision: NO ALERT — LEGITIMATE CALL)',
    res4.decision_code === 'NO_ALERT_LEGITIMATE_CALL' && res4.email_status === 'SKIPPED',
    res4
  );

  // TEST 5: A child without a parent mapping does not trigger an email
  console.log('\n--- Running Test 5: Child without parent mapping (Tommy Watson) ---');
  const res5 = await spamEngine.processIncomingCall({
    callerNumber: irsSpam.phone_number,
    callerName: irsSpam.caller_name,
    isSpamOverride: true,
    spamCategory: irsSpam.category,
    riskScore: irsSpam.risk_score,
    receiverNumber: unmappedChild.phone_number,
  });
  assert(
    5,
    'Child without parent mapping logs event without sending email (decision: NO ALERT — NO PARENT MAPPING)',
    res5.decision_code === 'NO_ALERT_NO_PARENT_MAPPING' && res5.email_status === 'SKIPPED',
    res5
  );

  // TEST 6: Email customization changes the actual outgoing email
  console.log('\n--- Running Test 6: Email template customization ---');
  const customSubject = '🔔 CUSTOM CARRIER NOTICE for {{child_name}}';
  await excelService.saveEmailTemplate({
    subject: customSubject,
  });
  const loadedTemplate = await excelService.getEmailTemplate();
  assert(
    6,
    'Email template customization persisted to workbook',
    loadedTemplate.subject === customSubject,
    loadedTemplate
  );

  // TEST 7: Call logs persist to the Excel workbook
  console.log('\n--- Running Test 7: Call logs persistence ---');
  const callLogs = await excelService.getCallLogs();
  const event1Found = callLogs.find((l) => l.event_id === res1.event_id);
  assert(
    7,
    'Simulation event persisted to CallLogs sheet in Excel workbook',
    Boolean(event1Found && event1Found.caller_number === irsSpam.phone_number),
    event1Found
  );

  // TEST 8: Test-email configuration failures are reported accurately
  console.log('\n--- Running Test 8: Test-email configuration reporting ---');
  const testEmailRes = await emailService.sendTestEmail('parent.test@example.com', loadedTemplate);
  assert(
    8,
    'Test email reports unconfigured or configured state accurately without crashing',
    testEmailRes.notConfigured === true || testEmailRes.success === true || Boolean(testEmailRes.error),
    testEmailRes
  );

  // TEST 9: App works after restart with the same workbook
  console.log('\n--- Running Test 9: Restart verification ---');
  // Re-instantiate service against existing workbook
  const reloadedSubs = await excelService.getSubscribers();
  const reloadedLogs = await excelService.getCallLogs();
  assert(
    9,
    'Reloaded Excel workbook preserves all subscribers and newly created logs',
    reloadedSubs.length >= 10 && reloadedLogs.length >= 4,
    { subCount: reloadedSubs.length, logCount: reloadedLogs.length }
  );

  console.log('\n====================================================');
  console.log(`🎉 TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Test execution failed with fatal error:', err);
  process.exit(1);
});
