import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool, { query } from '../config/db.js';
import { generateCertificatePDF } from '../utils/certificateGenerator.js';
import { repairAllDummyPdfs, createValidPdfBuffer } from './repair_dummy_pdfs.js';
import { certificateStorageDir, documentStorageDir } from '../utils/documentUpload.js';
import { calculateAffectedScheduledDays } from '../utils/scheduleHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedFullSystemTestData() {
  console.log('================================================================');
  console.log('🚀 JOWIS STUDIO ERP — FULL SYSTEM REALISTIC SEED DATA POPULATOR');
  console.log('================================================================\n');

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);
  const internPasswordHash = await bcrypt.hash('Intern@12345', 10);

  // 1. Ensure Roles
  console.log('🔹 1. Verifying System Roles...');
  const roles = await query('SELECT id, name FROM roles');
  const roleMap = {};
  roles.forEach(r => { roleMap[r.name] = r.id; });

  // 2. Ensure Super Admin and >=2 Admins
  console.log('🔹 2. Populating Admin Accounts (Super Admin + 2 Admins)...');
  
  // Super Admin
  const [existingSuper] = await query('SELECT id FROM users WHERE email = ?', ['admin@jowis.com']);
  if (!existingSuper) {
    await query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role_id, is_active, must_change_password)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `, ['Femi', 'Ogunleye', 'admin@jowis.com', adminPasswordHash, roleMap['super_admin']]);
  } else {
    await query('UPDATE users SET password_hash = ?, role_id = ?, must_change_password = 0, is_active = 1 WHERE id = ?',
      [adminPasswordHash, roleMap['super_admin'], existingSuper.id]);
  }

  // Admin 1 (Operations)
  const [existingOpAdmin] = await query('SELECT id FROM users WHERE email = ?', ['operations@jowis.com']);
  if (!existingOpAdmin) {
    await query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role_id, is_active, must_change_password)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `, ['Blessing', 'Johnson', 'operations@jowis.com', adminPasswordHash, roleMap['admin']]);
  } else {
    await query('UPDATE users SET password_hash = ?, role_id = ?, must_change_password = 0, is_active = 1 WHERE id = ?',
      [adminPasswordHash, roleMap['admin'], existingOpAdmin.id]);
  }

  // Admin 2 (Academic & Curriculum)
  const [existingAcadAdmin] = await query('SELECT id FROM users WHERE email = ?', ['academic.admin@jowis.com']);
  if (!existingAcadAdmin) {
    await query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role_id, is_active, must_change_password)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `, ['Kelechi', 'Nwosu', 'academic.admin@jowis.com', adminPasswordHash, roleMap['admin']]);
  } else {
    await query('UPDATE users SET password_hash = ?, role_id = ?, must_change_password = 0, is_active = 1 WHERE id = ?',
      [adminPasswordHash, roleMap['admin'], existingAcadAdmin.id]);
  }

  // 3. Ensure >= 3 Mentors
  console.log('🔹 3. Populating Mentors (>= 3 Active Mentors)...');
  const mentorSpecs = [
    { email: 'mentor.sam@jowis.com', first: 'Samuel', last: 'Adeyemi', spec: 'Full-Stack Engineering & Architecture' },
    { email: 'mentor.chioma@jowis.com', first: 'Chioma', last: 'Okeke', spec: 'UI/UX Design Systems & Research' },
    { email: 'mentor.frontend@jowis.com', first: 'Tunde', last: 'Bakare', spec: 'Cloud Infrastructure & Security' }
  ];

  const mentorIds = [];
  for (const m of mentorSpecs) {
    let [userRow] = await query('SELECT id FROM users WHERE email = ?', [m.email]);
    let uId = userRow?.id;
    if (!uId) {
      const insUser = await query(`
        INSERT INTO users (first_name, last_name, email, password_hash, role_id, is_active, must_change_password)
        VALUES (?, ?, ?, ?, ?, 1, 0)
      `, [m.first, m.last, m.email, adminPasswordHash, roleMap['mentor']]);
      uId = insUser.insertId;
    } else {
      await query('UPDATE users SET password_hash = ?, role_id = ?, is_active = 1 WHERE id = ?', [adminPasswordHash, roleMap['mentor'], uId]);
    }

    let [mentorRow] = await query('SELECT id FROM mentors WHERE user_id = ?', [uId]);
    let mId = mentorRow?.id;
    if (!mId) {
      const insMentor = await query(`
        INSERT INTO mentors (user_id, specialization)
        VALUES (?, ?)
      `, [uId, m.spec]);
      mId = insMentor.insertId;
    }
    mentorIds.push(mId);
  }

  // 4. Ensure Tracks and Cohorts
  console.log('🔹 4. Verifying Tracks & Cohorts...');
  const [defaultTrack] = await query('SELECT id FROM tracks ORDER BY id ASC LIMIT 1');
  const [defaultCohort] = await query('SELECT id FROM cohorts ORDER BY id ASC LIMIT 1');
  const trackId = defaultTrack?.id || 1;
  const cohortId = defaultCohort?.id || 1;

  // 5. Populate Interns covering all 9 lifecycle statuses
  console.log('🔹 5. Populating Interns across all 9 Lifecycle Statuses...');
  const internSpecs = [
    {
      code: 'JOWIS-INT-2026-001',
      email: 'intern@jowis.com',
      first: 'David',
      last: 'Adeleke',
      status: 'active',
      trackId: 1,
      cohortId: 1,
      scheduleDays: ['monday', 'tuesday', 'thursday'],
      scheduleLocked: 1,
      mentorId: mentorIds[0]
    },
    {
      code: 'JOWIS-INT-2026-002',
      email: 'intern.zainab@jowis.com',
      first: 'Zainab',
      last: 'Bello',
      status: 'active',
      trackId: 2,
      cohortId: 2,
      scheduleDays: ['monday', 'wednesday', 'friday'],
      scheduleLocked: 1,
      mentorId: mentorIds[1]
    },
    {
      code: 'JOWIS-INT-2026-003',
      email: 'intern.emeka@jowis.com',
      first: 'Emeka',
      last: 'Eze',
      status: 'active',
      trackId: 1,
      cohortId: 1,
      scheduleDays: ['monday', 'tuesday', 'friday'],
      scheduleLocked: 1,
      mentorId: mentorIds[0]
    },
    {
      code: 'JOWIS-INT-2026-004',
      email: 'intern.sarah@jowis.com',
      first: 'Sarah',
      last: 'Kalu',
      status: 'active',
      trackId: 2,
      cohortId: 2,
      scheduleDays: ['monday', 'wednesday', 'thursday'],
      scheduleLocked: 1,
      mentorId: mentorIds[2]
    },
    {
      code: 'JOWIS-INT-2026-005',
      email: 'intern.applied@jowis.com',
      first: 'Tolu',
      last: 'Davies',
      status: 'applied',
      trackId: 1,
      cohortId: 1,
      scheduleDays: null,
      scheduleLocked: 0,
      mentorId: null
    },
    {
      code: 'JOWIS-INT-2026-006',
      email: 'intern.screening@jowis.com',
      first: 'Fatima',
      last: 'Yusuf',
      status: 'screening',
      trackId: 2,
      cohortId: 2,
      scheduleDays: null,
      scheduleLocked: 0,
      mentorId: null
    },
    {
      code: 'JOWIS-INT-2026-007',
      email: 'intern.accepted@jowis.com',
      first: 'Israel',
      last: 'Oluwagbenga',
      status: 'accepted',
      trackId: 1,
      cohortId: 1,
      scheduleDays: null,
      scheduleLocked: 0,
      mentorId: null
    },
    {
      code: 'JOWIS-INT-2026-008',
      email: 'intern.onboarding@jowis.com',
      first: 'Chinedu',
      last: 'Obi',
      status: 'onboarding',
      trackId: 1,
      cohortId: 1,
      scheduleDays: null,
      scheduleLocked: 0,
      mentorId: mentorIds[0]
    },
    {
      code: 'JOWIS-INT-2026-009',
      email: 'intern.suspended@jowis.com',
      first: 'Ibrahim',
      last: 'Musa',
      status: 'suspended',
      trackId: 2,
      cohortId: 2,
      scheduleDays: ['monday', 'tuesday', 'wednesday'],
      scheduleLocked: 1,
      mentorId: mentorIds[1]
    },
    {
      code: 'JOWIS-INT-2026-010',
      email: 'intern.completed@jowis.com',
      first: 'Grace',
      last: 'Okon',
      status: 'completed',
      trackId: 1,
      cohortId: 1,
      scheduleDays: ['monday', 'wednesday', 'friday'],
      scheduleLocked: 1,
      mentorId: mentorIds[0]
    },
    {
      code: 'JOWIS-INT-2026-011',
      email: 'intern.dropped@jowis.com',
      first: 'Victor',
      last: 'Bassey',
      status: 'dropped',
      trackId: 2,
      cohortId: 2,
      scheduleDays: null,
      scheduleLocked: 0,
      mentorId: mentorIds[2]
    },
    {
      code: 'JOWIS-INT-2026-012',
      email: 'intern.alumni@jowis.com',
      first: 'Ngozi',
      last: 'Okafor',
      status: 'alumni',
      trackId: 1,
      cohortId: 1,
      scheduleDays: ['monday', 'thursday', 'friday'],
      scheduleLocked: 1,
      mentorId: mentorIds[1]
    }
  ];

  const internProfileMap = {};

  for (const spec of internSpecs) {
    let [userRow] = await query('SELECT id FROM users WHERE email = ?', [spec.email]);
    let uId = userRow?.id;
    if (!uId) {
      const insUser = await query(`
        INSERT INTO users (first_name, last_name, email, password_hash, role_id, is_active, must_change_password)
        VALUES (?, ?, ?, ?, ?, 1, 0)
      `, [spec.first, spec.last, spec.email, internPasswordHash, roleMap['intern']]);
      uId = insUser.insertId;
    } else {
      await query('UPDATE users SET password_hash = ?, role_id = ?, first_name = ?, last_name = ?, is_active = 1 WHERE id = ?',
        [internPasswordHash, roleMap['intern'], spec.first, spec.last, uId]);
    }

    let [profileRow] = await query('SELECT id FROM intern_profiles WHERE user_id = ?', [uId]);
    let pId = profileRow?.id;
    const scheduleDaysJson = spec.scheduleDays ? JSON.stringify(spec.scheduleDays) : null;

    if (!pId) {
      const insProfile = await query(`
        INSERT INTO intern_profiles (
          user_id, intern_code, track_id, cohort_id, mentor_id,
          status, start_date, expected_end_date, schedule_days, schedule_locked
        ) VALUES (?, ?, ?, ?, ?, ?, '2026-02-01', '2026-08-31', ?, ?)
      `, [uId, spec.code, spec.trackId || trackId, spec.cohortId || cohortId, spec.mentorId, spec.status, scheduleDaysJson, spec.scheduleLocked]);
      pId = insProfile.insertId;
    } else {
      await query(`
        UPDATE intern_profiles SET
          intern_code = ?, track_id = ?, cohort_id = ?, mentor_id = ?,
          status = ?, schedule_days = ?, schedule_locked = ?
        WHERE id = ?
      `, [spec.code, spec.trackId || trackId, spec.cohortId || cohortId, spec.mentorId, spec.status, scheduleDaysJson, spec.scheduleLocked, pId]);
    }

    internProfileMap[spec.email] = {
      profileId: pId,
      userId: uId,
      ...spec
    };
  }

  // 6. Generate Realistic Historical Attendance with strictly 09:00 Lagos Cutoff
  console.log('🔹 6. Generating Realistic Attendance Records for Scheduled Days Only (09:00 AM Cutoff)...');
  const activeInterns = [
    internProfileMap['intern@jowis.com'],
    internProfileMap['intern.zainab@jowis.com'],
    internProfileMap['intern.emeka@jowis.com'],
    internProfileMap['intern.sarah@jowis.com'],
    internProfileMap['intern.completed@jowis.com']
  ];

  // Working day date series from 2026-09-01 to 2026-09-25
  const calendarDates = [];
  const curr = new Date(Date.UTC(2026, 8, 1)); // 2026-09-01
  const end = new Date(Date.UTC(2026, 8, 25)); // 2026-09-25
  const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  while (curr <= end) {
    const dayOfWeek = weekdayNames[curr.getUTCDay()];
    const dateStr = curr.toISOString().split('T')[0];
    if (dayOfWeek !== 'sunday' && dayOfWeek !== 'saturday') {
      calendarDates.push({ date: dateStr, day: dayOfWeek });
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  for (const intern of activeInterns) {
    const scheduledDays = intern.scheduleDays || [];
    const scheduledDaySet = new Set(scheduledDays);

    for (const { date, day } of calendarDates) {
      if (!scheduledDaySet.has(day)) {
        // NON-SCHEDULED DAY: STRICTLY DO NOT INSERT ABSENCE
        continue;
      }

      // Check if attendance already recorded
      const [existingAtt] = await query(
        'SELECT id FROM attendance WHERE intern_id = ? AND attendance_date = ?',
        [intern.profileId, date]
      );

      if (!existingAtt) {
        // Deterministic realistic distribution based on date hash
        const hash = (date.charCodeAt(date.length - 1) + intern.profileId) % 10;

        if (hash === 7) {
          // Late arrival (09:12:30, +12 min)
          await query(`
            INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, notes)
            VALUES (?, ?, '09:12:30', 'LATE', 12, 'Arrival after 09:00 AM institutional cutoff')
          `, [intern.profileId, date]);
        } else if (hash === 9) {
          // Excused absence
          await query(`
            INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, notes)
            VALUES (?, ?, '09:00:00', 'EXCUSED', 0, 'Approved absence under institutional permission PR-2026-0002')
          `, [intern.profileId, date]);
        } else {
          // Punctual on-time arrival (08:44:15, PRESENT)
          await query(`
            INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, notes)
            VALUES (?, ?, '08:44:15', 'PRESENT', 0, 'Punctual check-in before 09:00:00 cutoff')
          `, [intern.profileId, date]);
        }
      }
    }
  }

  // 7. Seed Permission Requests (Covering all stages: PENDING, RECOMMENDED, APPROVED, REJECTED)
  console.log('🔹 7. Seeding Permission / Absence Requests across all Workflow States...');
  const david = internProfileMap['intern@jowis.com'];
  const zainab = internProfileMap['intern.zainab@jowis.com'];
  const emeka = internProfileMap['intern.emeka@jowis.com'];
  const sarah = internProfileMap['intern.sarah@jowis.com'];

  const [samUser] = await query('SELECT id FROM users WHERE email = ?', ['mentor.sam@jowis.com']);
  const [chiomaUser] = await query('SELECT id FROM users WHERE email = ?', ['mentor.chioma@jowis.com']);
  const [adminUser] = await query('SELECT id FROM users WHERE email = ?', ['admin@jowis.com']);

  const permissionSpecs = [
    {
      internId: david.profileId,
      code: 'PR-2026-0001',
      type: 'academic',
      start: '2026-09-28',
      end: '2026-10-02',
      scheduleDays: david.scheduleDays, // ['monday', 'tuesday', 'thursday']
      reason: 'University Semester Examinations',
      message: 'Final year 2nd semester exam timetable conflicts with lab schedule. Timetable attached.',
      status: 'PENDING',
      mentorReviewStatus: 'RECOMMENDED',
      mentorReviewNotes: 'Recommended for approval. Exam timetable verified with university.',
      reviewedByMentorId: samUser?.id,
      finalReviewStatus: 'PENDING',
      finalReviewNotes: null,
      reviewedByUserId: null
    },
    {
      internId: zainab.profileId,
      code: 'PR-2026-0002',
      type: 'sick_leave',
      start: '2026-09-14',
      end: '2026-09-18',
      scheduleDays: zainab.scheduleDays, // ['monday', 'wednesday', 'friday']
      reason: 'Severe Malaria & Medical Bed Rest',
      message: 'Doctor recommended 5-day strict rest. Medical certificate presented.',
      status: 'APPROVED',
      mentorReviewStatus: 'APPROVED',
      mentorReviewNotes: 'Approved. Hospital sick report confirmed.',
      reviewedByMentorId: chiomaUser?.id,
      finalReviewStatus: 'APPROVED',
      finalReviewNotes: 'Final determination approved. Excused attendance registered for affected work days.',
      reviewedByUserId: adminUser?.id
    },
    {
      internId: emeka.profileId,
      code: 'PR-2026-0003',
      type: 'emergency',
      start: '2026-09-21',
      end: '2026-09-22',
      scheduleDays: emeka.scheduleDays, // ['monday', 'tuesday', 'friday']
      reason: 'Family Emergency Travel',
      message: 'Urgent family situation requiring travel to hometown.',
      status: 'REJECTED',
      mentorReviewStatus: 'REJECTED',
      mentorReviewNotes: 'Declined. Minimum 48-hour formal notice required for personal leave.',
      reviewedByMentorId: samUser?.id,
      finalReviewStatus: 'REJECTED',
      finalReviewNotes: 'Rejected pursuant to institutional attendance and notice regulations.',
      reviewedByUserId: adminUser?.id
    },
    {
      internId: sarah.profileId,
      code: 'PR-2026-0004',
      type: 'official_duty',
      start: '2026-10-05',
      end: '2026-10-09',
      scheduleDays: sarah.scheduleDays, // ['monday', 'wednesday', 'thursday']
      reason: 'National Student Innovation Hackathon',
      message: 'Representing university technology team at national level.',
      status: 'PENDING',
      mentorReviewStatus: 'PENDING',
      mentorReviewNotes: null,
      reviewedByMentorId: null,
      finalReviewStatus: 'PENDING',
      finalReviewNotes: null,
      reviewedByUserId: null
    }
  ];

  for (const p of permissionSpecs) {
    const { count, dates } = calculateAffectedScheduledDays(p.start, p.end, p.scheduleDays, []);
    const [existing] = await query('SELECT id FROM permission_requests WHERE request_code = ?', [p.code]);

    let permId = existing?.id;
    if (!existing) {
      const insRes = await query(`
        INSERT INTO permission_requests (
          intern_id, request_code, request_type, start_date, end_date,
          affected_days_count, affected_dates, reason, message, status,
          mentor_review_status, mentor_review_notes, reviewed_by_mentor_id,
          final_review_status, final_review_notes, reviewed_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.internId,
        p.code,
        p.type,
        p.start,
        p.end,
        count,
        JSON.stringify(dates),
        p.reason,
        p.message,
        p.status,
        p.mentorReviewStatus,
        p.mentorReviewNotes,
        p.reviewedByMentorId,
        p.finalReviewStatus,
        p.finalReviewNotes,
        p.reviewedByUserId
      ]);
      permId = insRes.insertId;
    }

    // If APPROVED, ensure affected dates in attendance are marked EXCUSED
    if (p.status === 'APPROVED') {
      for (const attDate of dates) {
        const [existingAtt] = await query(
          'SELECT id FROM attendance WHERE intern_id = ? AND attendance_date = ?',
          [p.internId, attDate]
        );
        const excNotes = `Approved Permission (${p.code}): ${p.reason}`;
        let attId;
        if (existingAtt) {
          attId = existingAtt.id;
          await query(
            'UPDATE attendance SET status = "EXCUSED", notes = ?, marked_by = ? WHERE id = ?',
            [excNotes, adminUser?.id || 1, attId]
          );
        } else {
          const insAtt = await query(`
            INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, marked_by, notes)
            VALUES (?, ?, '09:00:00', 'EXCUSED', 0, ?, ?)
          `, [p.internId, attDate, adminUser?.id || 1, excNotes]);
          attId = insAtt.insertId;
        }

        // Check if audit log exists
        const [existingAudit] = await query(
          'SELECT id FROM attendance_audit_logs WHERE attendance_id = ? AND new_status = "EXCUSED"',
          [attId]
        );
        if (!existingAudit) {
          await query(`
            INSERT INTO attendance_audit_logs (attendance_id, intern_id, changed_by, old_status, new_status, reason)
            VALUES (?, ?, ?, 'ABSENT', 'EXCUSED', ?)
          `, [attId, p.internId, adminUser?.id || 1, `Permission Approved: ${p.code}`]);
        }
      }
    }
  }

  // 8. Generate Authentic Certificates with Valid PDF Byte Structures
  console.log('🔹 8. Generating Official Completion Certificates & Valid PDF Files...');
  const certInterns = [
    internProfileMap['intern.completed@jowis.com'],
    internProfileMap['intern.alumni@jowis.com']
  ];

  // Ensure certificate types
  const [certType] = await query('SELECT id FROM certificate_types LIMIT 1');
  const certTypeId = certType?.id || 1;

  for (const ci of certInterns) {
    const certNum = `JOWIS-CERT-2026-${String(ci.profileId).padStart(4, '0')}`;
    const [existingCert] = await query('SELECT id FROM certificates WHERE certificate_number = ?', [certNum]);
    const pdfFileName = `cert_${certNum}.pdf`;
    const targetPdfPath = path.join(certificateStorageDir, pdfFileName);

    await generateCertificatePDF({
      internName: `${ci.first} ${ci.last}`,
      certificateNumber: certNum,
      verificationCode: `VERIFY-${Date.now()}-${ci.profileId}`,
      certificateTitle: 'CERTIFICATE OF INTERNSHIP EXCELLENCE',
      trackName: 'Full-Stack Software Development',
      cohortName: 'Cohort JOWIS-2026-A',
      outputPath: targetPdfPath
    });

    if (!existingCert) {
      await query(`
        INSERT INTO certificates (
          certificate_code, intern_id, certificate_type_id, certificate_number, verification_code,
          issue_date, completion_date, track_id, cohort_id, pdf_path, status, issued_by
        ) VALUES (?, ?, ?, ?, ?, '2026-08-31', '2026-08-31', ?, ?, ?, 'issued', 1)
      `, [certNum, ci.profileId, certTypeId, certNum, `VERIFY-${Date.now()}-${ci.profileId}`, trackId, cohortId, pdfFileName]);
    }
  }

  // 9. Repair All Dummy Document PDFs in Storage
  console.log('🔹 9. Repairing All Dummy PDF Files in Storage...');
  repairAllDummyPdfs();

  // 10. Summary Report
  console.log('\n================================================================');
  console.log('✨ FULL SYSTEM TEST DATA POPULATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log('✅ Super Admin: admin@jowis.com (Admin@12345)');
  console.log('✅ Admins: operations@jowis.com, academic.admin@jowis.com (Admin@12345)');
  console.log('✅ Mentors: mentor.sam@jowis.com, mentor.chioma@jowis.com, mentor.frontend@jowis.com');
  console.log('✅ Interns: 12 Profiles across all 9 Lifecycle Statuses');
  console.log('✅ Locked 3-Day Schedules: Monday + 2 Days configured & locked');
  console.log('✅ Historical Attendance: Strict 09:00 Lagos cutoff populated');
  console.log('✅ Permission Requests: PENDING, RECOMMENDED, APPROVED, REJECTED seeded');
  console.log('✅ PDF Documents: 100% Valid, Readable PDF-1.4 documents on disk');
  console.log('================================================================\n');

  process.exit(0);
}

seedFullSystemTestData().catch((err) => {
  console.error('Seed test data error:', err);
  process.exit(1);
});
