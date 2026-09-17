import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  console.log('🚀 Starting Jowis Studio ERP Database Initialization...');

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server.');

    // 1. Create database if not exists
    console.log('📦 Creating database `jowis_studio_erp`...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`jowis_studio_erp\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`jowis_studio_erp\`;`);

    // 2. Read and run schema.sql
    console.log('📜 Executing schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await connection.query(schemaSql);
    console.log('✅ Schema created successfully.');

    // 3. Read and run seed.sql (roles, settings, tracks)
    console.log('🌱 Executing seed.sql...');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
    await connection.query(seedSql);

    // 4. Generate password hashes
    console.log('🔐 Hashing default passwords...');
    const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);
    const mentorPasswordHash = await bcrypt.hash('Mentor@12345', 10);
    const internPasswordHash = await bcrypt.hash('Intern@12345', 10);

    // 5. Insert Users
    console.log('👤 Inserting demo users...');
    const users = [
      // role_id 1 = super_admin, 2 = admin, 3 = mentor, 4 = intern
      [1, 1, 'admin@jowis.com', adminPasswordHash, 'Femi', 'Ogunleye', '+2348011112222', null, 1],
      [2, 2, 'operations@jowis.com', adminPasswordHash, 'Blessing', 'Johnson', '+2348022223333', null, 1],
      [3, 3, 'mentor.sam@jowis.com', mentorPasswordHash, 'Samuel', 'Adeyemi', '+2348033334444', null, 1],
      [4, 3, 'mentor.chioma@jowis.com', mentorPasswordHash, 'Chioma', 'Okeke', '+2348044445555', null, 1],
      [5, 4, 'intern@jowis.com', internPasswordHash, 'David', 'Adeleke', '+2348055556666', null, 1],
      [6, 4, 'intern.zainab@jowis.com', internPasswordHash, 'Zainab', 'Bello', '+2348066667777', null, 1],
      [7, 4, 'intern.emeka@jowis.com', internPasswordHash, 'Emeka', 'Eze', '+2348077778888', null, 1],
      [8, 4, 'intern.sarah@jowis.com', internPasswordHash, 'Sarah', 'Kalu', '+2348088889999', null, 1]
    ];

    for (const u of users) {
      await connection.query(
        `INSERT INTO users (id, role_id, email, password_hash, first_name, last_name, phone, avatar_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1`,
        u
      );
    }

    // 6. Insert Mentors
    console.log('👨‍🏫 Inserting mentors profile...');
    await connection.query(`
      INSERT INTO mentors (id, user_id, specialization, bio) VALUES
      (1, 3, 'Full-Stack Software Architecture & Cloud', 'Lead Software Engineer with 8+ years developing enterprise distributed systems and mentoring tech interns.'),
      (2, 4, 'Design Systems & Product Experience', 'Senior Product Designer specializing in Design Systems, User Research, and Micro-interactions.')
      ON DUPLICATE KEY UPDATE specialization = VALUES(specialization);
    `);

    // 7. Insert Cohorts
    console.log('🎓 Inserting cohorts...');
    await connection.query(`
      INSERT INTO cohorts (id, name, track_id, lead_mentor_id, start_date, end_date, capacity, status) VALUES
      (1, 'Cohort JOWIS-2026-A', 1, 1, '2026-02-01', '2026-08-15', 30, 'active'),
      (2, 'Cohort JOWIS-2026-B', 2, 2, '2026-03-01', '2026-07-31', 25, 'active'),
      (3, 'Cohort JOWIS-2025-Q4', 1, 1, '2025-09-01', '2026-02-28', 25, 'completed')
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);

    // 8. Insert Intern Profiles
    console.log('📋 Inserting intern profiles...');
    await connection.query(`
      INSERT INTO intern_profiles (id, user_id, intern_code, track_id, cohort_id, mentor_id, phone, gender, date_of_birth, address, emergency_contact_name, emergency_contact_phone, education, skills, status, start_date, expected_end_date) VALUES
      (1, 5, 'JOWIS-INT-2026-001', 1, 1, 1, '+2348055556666', 'male', '2001-05-14', '12 Awolowo Road, Ikoyi, Lagos', 'Mr. Adeleke Sr.', '+2348099990001', 'B.Sc Computer Science, UNILAG', 'JavaScript, HTML/CSS, Git, React basics', 'active', '2026-02-01', '2026-08-15'),
      (2, 6, 'JOWIS-INT-2026-002', 2, 2, 2, '+2348066667777', 'female', '2002-08-22', '45 Allen Avenue, Ikeja, Lagos', 'Alhaji Bello', '+2348099990002', 'B.A Creative Arts, UNILORIN', 'Figma, Adobe XD, Wireframing, UX Writing', 'active', '2026-03-01', '2026-07-31'),
      (3, 7, 'JOWIS-INT-2026-003', 1, 1, 1, '+2348077778888', 'male', '2000-11-03', '8 Admiralty Way, Lekki, Lagos', 'Mrs. Eze', '+2348099990003', 'HND Computer Engineering, YabaTech', 'JavaScript, Python basics, SQL', 'active', '2026-02-01', '2026-08-15'),
      (4, 8, 'JOWIS-INT-2026-004', 1, 1, 1, '+2348088889999', 'female', '2001-02-18', '21 Isaac John Street, GRA Ikeja', 'Chief Kalu', '+2348099990004', 'B.Sc Software Engineering, Covenant Univ', 'React, TypeScript, Tailwind', 'active', '2026-02-01', '2026-08-15')
      ON DUPLICATE KEY UPDATE intern_code = VALUES(intern_code);
    `);

    // 9. Insert Realistic Historical Attendance
    console.log('⏰ Inserting historical attendance records...');
    const attendanceRecords = [
      // David Adeleke (intern_id 1)
      [1, '2026-09-01', '08:42:15', '17:02:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-02', '08:51:00', '17:05:30', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-03', '09:14:20', '17:15:00', 'LATE', 14, null, 'Traffic on third mainland bridge'],
      [1, '2026-09-04', '08:35:10', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-05', '08:48:00', '17:03:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-08', '08:58:30', '17:01:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-09', '09:22:00', '17:20:00', 'LATE', 22, null, 'Heavy rainfall in Lagos mainland'],
      [1, '2026-09-10', '08:40:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-11', '08:39:12', '17:02:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-12', '08:45:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-15', '08:50:00', '17:05:00', 'PRESENT', 0, null, 'Normal check-in'],
      [1, '2026-09-16', '08:44:00', '17:01:00', 'PRESENT', 0, null, 'Normal check-in'],
      // Zainab Bello (intern_id 2)
      [2, '2026-09-01', '08:30:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-02', '08:41:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-03', '08:35:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-04', '08:47:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-08', '09:05:00', '17:05:00', 'LATE', 5, null, 'Bus breakdown'],
      [2, '2026-09-09', '08:50:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-10', '08:30:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-11', '08:45:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-12', '08:38:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-15', '08:40:00', '17:00:00', 'PRESENT', 0, null, 'Normal check-in'],
      [2, '2026-09-16', '09:12:00', '17:10:00', 'LATE', 12, null, 'Subway delay']
    ];

    for (const a of attendanceRecords) {
      await connection.query(
        `INSERT INTO attendance (intern_id, attendance_date, check_in_time, check_out_time, status, late_minutes, marked_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), late_minutes = VALUES(late_minutes);`,
        a
      );
    }

    // 10. Insert Tasks & Submissions
    console.log('📌 Inserting tasks and submissions...');
    await connection.query(`
      INSERT INTO tasks (id, title, description, track_id, cohort_id, assigned_by, due_date, max_score, priority) VALUES
      (1, 'Build a RESTful Authentication API with JWT', 'Design and implement a secure authentication module in Express with bcrypt password hashing, JWT token issuance, refresh rotation, and protected role-based routes.', 1, 1, 3, '2026-09-25 23:59:59', 100, 'high'),
      (2, 'Implement Relational MySQL Schema with Foreign Keys', 'Design the normalized SQL tables for the ERP system including users, cohorts, attendance, and tasks. Implement proper unique constraints and foreign keys.', 1, 1, 3, '2026-09-20 23:59:59', 100, 'medium'),
      (3, 'Figma Design System & High-Fidelity UI Prototype', 'Create a complete ERP design system with color tokens, typography scales, interactive components (tables, badges, modal), and desktop/mobile frames.', 2, 2, 4, '2026-09-22 23:59:59', 100, 'high')
      ON DUPLICATE KEY UPDATE title = VALUES(title);
    `);

    await connection.query(`
      INSERT INTO task_submissions (id, task_id, intern_id, submission_text, submission_url, submitted_at, status, score, feedback, graded_by, graded_at) VALUES
      (1, 2, 1, 'Completed the schema with all foreign keys, unique constraint on intern_id+attendance_date, and audit logs.', 'https://github.com/jowis-interns/david-erp-db', '2026-09-18 14:20:00', 'graded', 95.00, 'Excellent work on referential integrity and indexes!', 3, '2026-09-19 10:00:00'),
      (2, 3, 2, 'Submitted Figma community file link with auto-layout components and dark/light system.', 'https://www.figma.com/file/demo-jowis-erp', '2026-09-20 16:30:00', 'graded', 92.00, 'Great component consistency and accessible color contrast.', 4, '2026-09-21 11:30:00')
      ON DUPLICATE KEY UPDATE score = VALUES(score);
    `);

    // 11. Insert Performance Evaluations
    console.log('📊 Inserting performance evaluations...');
    await connection.query(`
      INSERT INTO performance_evaluations (id, intern_id, evaluator_id, evaluation_period, technical_skills, task_completion, problem_solving, communication, teamwork, professionalism, learning_progress, attendance_rating, overall_score, summary_feedback) VALUES
      (1, 1, 3, '2026-Month-08', 4, 5, 4, 4, 4, 5, 5, 4, 88.50, 'David demonstrates exceptional technical grasp in backend engineering. Consistently completes tasks before deadlines with clean architecture.'),
      (2, 2, 4, '2026-Month-08', 5, 4, 4, 5, 5, 5, 4, 4, 89.20, 'Zainab has a sharp eye for UI polish and communicates user research findings very clearly in team reviews.')
      ON DUPLICATE KEY UPDATE overall_score = VALUES(overall_score);
    `);

    // 12. Insert Curriculum Progress
    console.log('📚 Inserting curriculum progress...');
    const progressData = [
      [1, 'HTML5 & Responsive CSS', 1, 'completed', 100],
      [1, 'JavaScript ES6+ & Async Programming', 2, 'completed', 100],
      [1, 'React.js & State Management', 3, 'completed', 100],
      [1, 'Node.js & Express REST APIs', 4, 'in_progress', 75],
      [1, 'MySQL & Database Architecture', 5, 'in_progress', 60],
      [1, 'Final Capstone Project', 6, 'not_started', 0],
      [2, 'Design Thinking & UX Research', 1, 'completed', 100],
      [2, 'Wireframing & Information Architecture', 2, 'completed', 100],
      [2, 'Figma & Design Systems', 3, 'completed', 100],
      [2, 'Prototyping & Usability Testing', 4, 'in_progress', 80],
      [2, 'Capstone Product Showcase', 5, 'not_started', 0]
    ];

    for (const p of progressData) {
      await connection.query(`
        INSERT INTO curriculum_progress (intern_id, module_name, module_order, status, completion_percentage)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status), completion_percentage = VALUES(completion_percentage);
      `, p);
    }

    // 13. Insert Announcements
    console.log('📢 Inserting announcements...');
    await connection.query(`
      INSERT INTO announcements (id, title, content, author_id, target_type, is_pinned) VALUES
      (1, 'Welcome to Jowis Studio Internship Program 2026!', 'We are thrilled to welcome our new cohort of technology interns. Please ensure you attend the daily standup sessions promptly before 09:00 AM. Check your dashboard for track schedules.', 1, 'all', 1),
      (2, 'Mid-Term Capstone Project Brief Released', 'Mentors have published the specifications for the Q3 capstone project in the Tasks section. Submissions are due on the 25th.', 3, 'track', 0)
      ON DUPLICATE KEY UPDATE title = VALUES(title);
    `);

    console.log('\n======================================================');
    console.log('🎉 JOWIS STUDIO ERP DATABASE INITIALIZATION COMPLETE! 🎉');
    console.log('======================================================');
    console.log('Default Credentials:');
    console.log('  Super Admin: admin@jowis.com       / Admin@12345');
    console.log('  Operations:  operations@jowis.com  / Admin@12345');
    console.log('  Mentor:      mentor.sam@jowis.com  / Mentor@12345');
    console.log('  Intern:      intern@jowis.com      / Intern@12345');
    console.log('  Intern 2:    intern.zainab@jowis.com / Intern@12345');
    console.log('======================================================\n');

  } catch (error) {
    console.error('❌ Database Initialization Failed:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
