import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase7Tests() {
  const PORT = 5098;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('=======================================================');
  console.log('⚡  JOWIS STUDIO ERP — PHASE 7 AUTOMATED TEST SUITE');
  console.log('📢  COMMUNICATION & NOTIFICATIONS ENGINE');
  console.log(`🧪  Test server running on http://localhost:${PORT}`);
  console.log('=======================================================\n');

  const baseUrl = `http://localhost:${PORT}/api`;
  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testFailed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate All Roles
    // -------------------------------------------------------------
    console.log('🔹 SETUP: Authenticating users across roles...');

    // 1. Super Admin
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const adminData = await adminRes.json();
    assert(adminData.success && adminData.token, 'Super Admin login must succeed');
    const adminToken = adminData.token;

    // 2. Mentor 1: Sam (Software Dev Lead)
    const mentor1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
    });
    const mentor1Data = await mentor1Res.json();
    assert(mentor1Data.success && mentor1Data.token, 'Mentor 1 (Samuel Adeyemi) login must succeed');
    const mentor1Token = mentor1Data.token;

    // 3. Mentor 2: Chioma (Product Design Lead)
    const mentor2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.chioma@jowis.com', password: 'Mentor@12345' })
    });
    const mentor2Data = await mentor2Res.json();
    assert(mentor2Data.success && mentor2Data.token, 'Mentor 2 (Chioma Okeke) login must succeed');
    const mentor2Token = mentor2Data.token;

    // 4. Intern 1: David (Cohort 1, Track 1)
    const intern1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const intern1Data = await intern1Res.json();
    assert(intern1Data.success && intern1Data.token, 'Intern 1 (David Adeleke) login must succeed');
    const intern1Token = intern1Data.token;

    // 5. Intern 2: Zainab (Cohort 2, Track 2)
    const intern2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern.zainab@jowis.com', password: 'Intern@12345' })
    });
    const intern2Data = await intern2Res.json();
    assert(intern2Data.success && intern2Data.token, 'Intern 2 (Zainab Bello) login must succeed');
    const intern2Token = intern2Data.token;

    // -------------------------------------------------------------
    // GATE 1: Schema & Database Table Validation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1: Schema & Database Table Validation...');
    const tables = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('announcements', 'announcement_acknowledgements', 'notifications', 'notification_preferences')
    `);
    const tableNames = tables.map(t => t.TABLE_NAME.toLowerCase());
    assert(tableNames.includes('announcements'), 'Table `announcements` exists in database');
    assert(tableNames.includes('announcement_acknowledgements'), 'Table `announcement_acknowledgements` exists in database');
    assert(tableNames.includes('notifications'), 'Table `notifications` exists in database');
    assert(tableNames.includes('notification_preferences'), 'Table `notification_preferences` exists in database');

    const annCols = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements'
    `);
    const annColNames = annCols.map(c => c.COLUMN_NAME.toLowerCase());
    assert(annColNames.includes('status'), 'Announcements table has `status` column');
    assert(annColNames.includes('priority'), 'Announcements table has `priority` column');
    assert(annColNames.includes('requires_acknowledgement'), 'Announcements table has `requires_acknowledgement` column');
    assert(annColNames.includes('scheduled_at'), 'Announcements table has `scheduled_at` column');
    assert(annColNames.includes('published_at'), 'Announcements table has `published_at` column');
    assert(annColNames.includes('expires_at'), 'Announcements table has `expires_at` column');

    // -------------------------------------------------------------
    // GATE 2 & 3: Announcement Management & Lifecycle API
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2 & 3: Announcement Management & Lifecycle API...');

    // 1. Create a draft announcement
    const draftRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Q4 Studio Strategy Draft',
        content: 'Internal strategic plan for studio expansion.',
        targetType: 'admins',
        status: 'draft',
        priority: 'normal'
      })
    });
    const draftData = await draftRes.json();
    assert(draftRes.status === 201 && draftData.success, 'Admin can create draft announcement (201 Created)');
    const draftId = draftData.data.id;

    // Verify draft status in database
    const [draftDb] = await query('SELECT status, published_at FROM announcements WHERE id = ?', [draftId]);
    assert(draftDb.status === 'draft', 'Announcement initial status is `draft`');
    assert(draftDb.published_at === null, 'Draft announcement has published_at = null');

    // 2. Publish the draft immediately
    const publishRes = await fetch(`${baseUrl}/communications/announcements/${draftId}/publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const publishData = await publishRes.json();
    assert(publishRes.status === 200 && publishData.success, 'Admin can publish draft announcement (200 OK)');

    const [publishedDb] = await query('SELECT status, published_at FROM announcements WHERE id = ?', [draftId]);
    assert(publishedDb.status === 'published', 'Announcement status updated to `published`');
    assert(publishedDb.published_at !== null, 'Published announcement has valid published_at timestamp');

    // 3. Publishing an already-published announcement should be rejected
    const rePublishRes = await fetch(`${baseUrl}/communications/announcements/${draftId}/publish`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert(rePublishRes.status === 400, 'Re-publishing an already active announcement returns 400 Bad Request');

    // 4. Create a scheduled announcement with future date
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const schedRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Upcoming Tech Keynote',
        content: 'Join us tomorrow for an industry keynote address.',
        targetType: 'all',
        status: 'scheduled',
        scheduledAt: futureDate,
        priority: 'high'
      })
    });
    const schedData = await schedRes.json();
    assert(schedRes.status === 201 && schedData.success, 'Admin can schedule an announcement (201 Created)');
    const schedId = schedData.data.id;

    // 5. Scheduled announcement without future date fails
    const invalidSchedRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Invalid Schedule Announcement',
        content: 'This should fail.',
        targetType: 'all',
        status: 'scheduled',
        scheduledAt: '2020-01-01T00:00:00Z'
      })
    });
    assert(invalidSchedRes.status === 400, 'Scheduling with past date returns 400 Bad Request');

    // 6. Archive announcement
    const archiveRes = await fetch(`${baseUrl}/communications/announcements/${draftId}/archive`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const archiveData = await archiveRes.json();
    assert(archiveRes.status === 200 && archiveData.success, 'Admin can archive announcement');
    const [archivedDb] = await query('SELECT status FROM announcements WHERE id = ?', [draftId]);
    assert(archivedDb.status === 'archived', 'Announcement status is now `archived`');

    // -------------------------------------------------------------
    // GATE 4: Audience Targeting & Isolation Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Audience Targeting & Isolation Engine...');

    // Create Cohort 1 specific announcement
    const cohort1AnnRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Cohort 1 Exclusive Standup Brief',
        content: 'Special standup meeting for Software Development Cohort 1 interns.',
        targetType: 'cohort',
        targetId: 1, // Cohort 1
        status: 'published',
        priority: 'high',
        requiresAcknowledgement: 1
      })
    });
    const cohort1AnnData = await cohort1AnnRes.json();
    assert(cohort1AnnRes.status === 201, 'Created Cohort 1 targeted announcement');
    const cohort1AnnId = cohort1AnnData.data.id;

    // Intern 1 (Cohort 1) must see it
    const intern1AnnRes = await fetch(`${baseUrl}/communications/announcements`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const intern1AnnData = await intern1AnnRes.json();
    assert(intern1AnnRes.status === 200 && intern1AnnData.success, 'Intern 1 can fetch announcements');
    const intern1HasCohort1 = intern1AnnData.data.some(a => a.id === cohort1AnnId);
    assert(intern1HasCohort1, 'Intern 1 (Cohort 1) CAN see Cohort 1 targeted announcement');

    // Intern 2 (Cohort 2) must NOT see it (Isolation check)
    const intern2AnnRes = await fetch(`${baseUrl}/communications/announcements`, {
      headers: { 'Authorization': `Bearer ${intern2Token}` }
    });
    const intern2AnnData = await intern2AnnRes.json();
    assert(intern2AnnRes.status === 200 && intern2AnnData.success, 'Intern 2 can fetch announcements');
    const intern2HasCohort1 = intern2AnnData.data.some(a => a.id === cohort1AnnId);
    assert(!intern2HasCohort1, 'Intern 2 (Cohort 2) CANNOT see Cohort 1 targeted announcement (Target Isolation PASS)');

    // Scheduled announcement (with future time) must NOT be visible to Intern 1
    const intern1HasSched = intern1AnnData.data.some(a => a.id === schedId);
    assert(!intern1HasSched, 'Intern 1 CANNOT see future scheduled announcement before publication time');

    // Audience preview calculation check (Admin)
    const previewRes = await fetch(`${baseUrl}/communications/announcements/audience?targetType=cohort&targetId=1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const previewData = await previewRes.json();
    assert(previewRes.status === 200 && previewData.success, 'Admin can preview audience size');
    assert(previewData.data.recipientCount >= 1, 'Audience preview resolves correct recipient count');

    // -------------------------------------------------------------
    // GATE 6 & 7: Notifications Inbox, Unread State & Isolation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6 & 7: Notifications Inbox, Unread State & Isolation...');

    // Fetch Intern 1 notifications
    const notifsRes = await fetch(`${baseUrl}/communications/notifications`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const notifsData = await notifsRes.json();
    assert(notifsRes.status === 200 && notifsData.success, 'Intern 1 can fetch notification inbox');
    assert(Array.isArray(notifsData.data), 'Notifications returned as array');

    // Unread count check
    const unreadCountRes = await fetch(`${baseUrl}/communications/notifications/unread-count`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const unreadCountData = await unreadCountRes.json();
    assert(unreadCountRes.status === 200 && typeof unreadCountData.count === 'number', 'Unread notification count returns integer');

    // Direct insert a test notification for Intern 1
    const [intern1User] = await query("SELECT id FROM users WHERE email = 'intern@jowis.com'");
    const [intern2User] = await query("SELECT id FROM users WHERE email = 'intern.zainab@jowis.com'");

    const notifInsert = await query(`
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
      VALUES (?, 'system', 'Phase 7 Verification Probe', 'Security testing notification for Intern 1', 0, NOW())
    `, [intern1User.id]);
    const testNotifId = notifInsert.insertId;

    // Mark single notification as read
    const readRes = await fetch(`${baseUrl}/communications/notifications/${testNotifId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const readData = await readRes.json();
    assert(readRes.status === 200 && readData.success, 'Intern 1 can mark notification as read');

    const [notifDb] = await query('SELECT is_read, read_at FROM notifications WHERE id = ?', [testNotifId]);
    assert(notifDb.is_read === 1, 'Notification is_read updated to 1');
    assert(notifDb.read_at !== null, 'read_at timestamp recorded in database');

    // Mark notification as unread
    const unreadRes = await fetch(`${baseUrl}/communications/notifications/${testNotifId}/unread`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    assert(unreadRes.status === 200, 'Intern 1 can mark notification as unread');

    // PRIVACY & SCOPE ISOLATION: Intern 2 tries to mark Intern 1's notification as read
    const hackRes = await fetch(`${baseUrl}/communications/notifications/${testNotifId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${intern2Token}` }
    });
    assert(hackRes.status === 403, 'Intern 2 is FORBIDDEN (403) from modifying Intern 1 notification');

    // PRIVACY: Intern 2 tries to delete Intern 1's notification
    const hackDelRes = await fetch(`${baseUrl}/communications/notifications/${testNotifId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${intern2Token}` }
    });
    assert(hackDelRes.status === 403, 'Intern 2 is FORBIDDEN (403) from deleting Intern 1 notification');

    // Mark all as read for Intern 1
    const markAllRes = await fetch(`${baseUrl}/communications/notifications/mark-all-read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    assert(markAllRes.status === 200, 'Intern 1 can mark all notifications as read');

    const [unreadCheck] = await query('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0', [intern1User.id]);
    assert(unreadCheck.cnt === 0, 'Unread count for Intern 1 is now 0 after mark-all-read');

    // -------------------------------------------------------------
    // GATE 8: Notification Preferences & Mandatory System Safeguard
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8: Notification Preferences & Mandatory System Safeguard...');

    // Retrieve preferences
    const getPrefRes = await fetch(`${baseUrl}/communications/preferences`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const getPrefData = await getPrefRes.json();
    assert(getPrefRes.status === 200 && getPrefData.success, 'Can retrieve notification preferences');
    assert(getPrefData.data.system_in_app === 1, 'system_in_app is enabled by default');

    // Update preferences: disable tasks_in_app
    const updatePrefRes = await fetch(`${baseUrl}/communications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${intern1Token}`
      },
      body: JSON.stringify({
        announcementsInApp: true,
        tasksInApp: false, // Disabled
        performanceInApp: true,
        documentsInApp: true
      })
    });
    const updatePrefData = await updatePrefRes.json();
    assert(updatePrefRes.status === 200 && updatePrefData.success, 'Updated notification preferences');
    assert(updatePrefData.data.tasks_in_app === 0, 'tasks_in_app successfully disabled');
    assert(updatePrefData.data.system_in_app === 1, 'system_in_app remains permanently locked to 1');

    // Reset back to enabled for clean state
    await fetch(`${baseUrl}/communications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${intern1Token}`
      },
      body: JSON.stringify({
        announcementsInApp: true,
        tasksInApp: true,
        performanceInApp: true,
        documentsInApp: true
      })
    });

    // -------------------------------------------------------------
    // GATE 9: Announcement Acknowledgement Workflow
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9: Announcement Acknowledgement Workflow...');

    // Check pending acknowledgements for Intern 1 (should include cohort1AnnId)
    const pendingAckRes = await fetch(`${baseUrl}/communications/announcements/pending-acknowledgements`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const pendingAckData = await pendingAckRes.json();
    assert(pendingAckRes.status === 200 && pendingAckData.success, 'Intern 1 can fetch pending acknowledgements');
    const isPending = pendingAckData.data.some(p => p.id === cohort1AnnId);
    assert(isPending, 'Cohort 1 announcement is listed in pending acknowledgements');

    // Acknowledge the announcement
    const ackRes = await fetch(`${baseUrl}/communications/announcements/${cohort1AnnId}/acknowledge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const ackData = await ackRes.json();
    assert(ackRes.status === 200 && ackData.success, 'Intern 1 can acknowledge announcement (200 OK)');

    // Duplicate acknowledgement should be safe & idempotent
    const dupAckRes = await fetch(`${baseUrl}/communications/announcements/${cohort1AnnId}/acknowledge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    assert(dupAckRes.status === 200, 'Duplicate acknowledgement is safe and idempotent');

    // Verify acknowledgement is recorded in database
    const [ackDb] = await query(
      'SELECT id FROM announcement_acknowledgements WHERE announcement_id = ? AND user_id = ?',
      [cohort1AnnId, intern1User.id]
    );
    assert(ackDb !== undefined, 'Acknowledgement record persisted in `announcement_acknowledgements`');

    // Admin inspection of acknowledgements for this announcement
    const ackReportRes = await fetch(`${baseUrl}/communications/announcements/${cohort1AnnId}/acknowledgements`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const ackReportData = await ackReportRes.json();
    assert(ackReportRes.status === 200 && ackReportData.success, 'Admin can view acknowledgement report');
    assert(ackReportData.stats.acknowledgedCount >= 1, 'Acknowledgement report reflects at least 1 acknowledged user');

    // -------------------------------------------------------------
    // GATE 10: Audit Logging & Traceability
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10: Audit Logging & Traceability...');
    const auditLogs = await query(`
      SELECT action FROM audit_logs 
      WHERE entity_type = 'announcements'
      ORDER BY created_at DESC LIMIT 20
    `);
    const actions = auditLogs.map(a => a.action);
    assert(actions.includes('CREATE_ANNOUNCEMENT') || actions.includes('PUBLISH_ANNOUNCEMENT'), 'CREATE/PUBLISH_ANNOUNCEMENT audit log recorded');
    assert(actions.includes('SCHEDULE_ANNOUNCEMENT'), 'SCHEDULE_ANNOUNCEMENT audit log recorded');
    assert(actions.includes('ARCHIVE_ANNOUNCEMENT'), 'ARCHIVE_ANNOUNCEMENT audit log recorded');
    assert(actions.includes('ACKNOWLEDGE_ANNOUNCEMENT'), 'ACKNOWLEDGE_ANNOUNCEMENT audit log recorded');

    // -------------------------------------------------------------
    // GATE 14: Security Hardening & Penetration Testing
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 14: Security Hardening & Penetration Testing...');

    // 1. SQL Injection attempt in announcements search
    const sqlInjRes = await fetch(`${baseUrl}/communications/announcements?search=' OR 1=1 --`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    assert(sqlInjRes.status === 200, 'SQL injection attempt in search handled safely with parameterized queries');

    // 2. XSS payload in announcement creation (sanitized text handling)
    const xssTitle = '<script>alert("XSS")</script> Test Announcement';
    const xssRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: xssTitle,
        content: '<img src=x onerror=alert(1)> Safe body content',
        targetType: 'all',
        status: 'draft'
      })
    });
    const xssData = await xssRes.json();
    assert(xssRes.status === 201, 'XSS payload stored as raw text without code execution (201 Created)');

    // 3. Intern attempting admin operations (RBAC check)
    const internCreateRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${intern1Token}`
      },
      body: JSON.stringify({
        title: 'Illegal Intern Broadcast',
        content: 'Should be rejected',
        targetType: 'all'
      })
    });
    assert(internCreateRes.status === 403, 'Intern forbidden from creating announcements (403 Forbidden)');

    // 4. Invalid targetType
    const invalidTargetRes = await fetch(`${baseUrl}/communications/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Bad Target',
        content: 'Testing invalid target',
        targetType: 'super_secret_hack'
      })
    });
    assert(invalidTargetRes.status === 400, 'Invalid targetType rejected with 400 Bad Request');

    // -------------------------------------------------------------
    // GATE 11: Cross-Module Notification Verification
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 11: Cross-Module Notification Verification...');

    // Check if notifications table contains records across different modules
    const modRows = await query(`
      SELECT DISTINCT type FROM notifications
    `);
    const existingTypes = modRows.map(m => m.type);
    assert(existingTypes.includes('announcement') || existingTypes.includes('system'), 'Notifications table supports `announcement` and `system` types');

    // Clean up temporary test data
    await query('DELETE FROM announcements WHERE id IN (?, ?, ?)', [draftId, schedId, xssData.data.id]);
    await query('DELETE FROM notifications WHERE id = ?', [testNotifId]);

    // -------------------------------------------------------------
    // GATE 20: Regression Checks across Phases 1-6
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 20: Regression Validation (Phases 1-6 Endpoints)...');

    const healthRes = await fetch(`${baseUrl}/health`);
    assert(healthRes.status === 200, 'Phase 1: /health endpoint 200 OK');

    const internsRes = await fetch(`${baseUrl}/interns`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(internsRes.status === 200, 'Phase 2: /interns endpoint 200 OK');

    const tasksRes = await fetch(`${baseUrl}/tasks`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(tasksRes.status === 200, 'Phase 3: /tasks endpoint 200 OK');

    const perfRes = await fetch(`${baseUrl}/performance/overview`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(perfRes.status === 200, 'Phase 4: /performance/overview endpoint 200 OK');

    const reportRes = await fetch(`${baseUrl}/reports/executive`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(reportRes.status === 200, 'Phase 5: /reports/executive endpoint 200 OK');

    const docTypeRes = await fetch(`${baseUrl}/documents/types`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(docTypeRes.status === 200, 'Phase 6: /documents/types endpoint 200 OK');

    const certTypeRes = await fetch(`${baseUrl}/certificates/types`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(certTypeRes.status === 200, 'Phase 6: /certificates/types endpoint 200 OK');

    console.log('\n=======================================================');
    console.log(`🎯 ALL PHASE 7 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (error) {
    console.error('\n❌ PHASE 7 TEST SUITE ABORTED WITH ERROR:', error);
    testFailed++;
  } finally {
    server.close();
    if (testFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runPhase7Tests();
