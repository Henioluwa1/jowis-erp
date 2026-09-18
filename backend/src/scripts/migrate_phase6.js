import { query } from '../config/db.js';

export async function runPhase6Migration() {
  console.log('🚀 Running Phase 6 Database Migration (Documents, Verification & Certificates)...');

  try {
    // 1. Create `document_types` table
    console.log('  Verifying `document_types` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS document_types (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT NULL,
        category ENUM('identification', 'academic', 'agreement', 'assessment', 'completion', 'other') NOT NULL DEFAULT 'other',
        is_required BOOLEAN NOT NULL DEFAULT 0,
        allowed_file_types VARCHAR(255) NOT NULL DEFAULT 'pdf,jpg,jpeg,png',
        max_file_size INT UNSIGNED NOT NULL DEFAULT 10485760,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_doctype_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        INDEX idx_doctype_status (status),
        INDEX idx_doctype_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `document_types` table ready.');

    // 2. Create `intern_documents` table
    console.log('  Verifying `intern_documents` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS intern_documents (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        intern_id INT UNSIGNED NOT NULL,
        document_type_id INT UNSIGNED NOT NULL,
        title VARCHAR(150) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INT UNSIGNED NOT NULL DEFAULT 0,
        current_version INT UNSIGNED NOT NULL DEFAULT 1,
        status ENUM('uploaded', 'pending_verification', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending_verification',
        uploaded_by INT UNSIGNED NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_by INT UNSIGNED NULL,
        verified_at DATETIME NULL,
        rejection_reason TEXT NULL,
        expiry_date DATE NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_idoc_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_idoc_type FOREIGN KEY (document_type_id) REFERENCES document_types (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_idoc_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_idoc_verifier FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
        INDEX idx_idoc_intern (intern_id),
        INDEX idx_idoc_type (document_type_id),
        INDEX idx_idoc_status (status),
        INDEX idx_idoc_expiry (expiry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `intern_documents` table ready.');

    // 3. Create `document_versions` table
    console.log('  Verifying `document_versions` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        document_id INT UNSIGNED NOT NULL,
        version_number INT UNSIGNED NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INT UNSIGNED NOT NULL,
        uploaded_by INT UNSIGNED NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('uploaded', 'pending_verification', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending_verification',
        verified_by INT UNSIGNED NULL,
        verified_at DATETIME NULL,
        rejection_reason TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_dver_doc FOREIGN KEY (document_id) REFERENCES intern_documents (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_dver_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_dver_verifier FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
        INDEX idx_dver_doc (document_id, version_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `document_versions` table ready.');

    // 4. Create `certificate_types` table
    console.log('  Verifying `certificate_types` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS certificate_types (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT NULL,
        template_layout VARCHAR(50) NOT NULL DEFAULT 'standard',
        signatory_name VARCHAR(100) NOT NULL DEFAULT 'Executive Director',
        signatory_title VARCHAR(100) NOT NULL DEFAULT 'Lead Director, Jowis Studio',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_certtype_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        INDEX idx_certtype_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `certificate_types` table ready.');

    // 5. Evolve `certificates` table
    console.log('  Evolving `certificates` table schema...');
    const certCols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'certificates'
    `);
    const certColNames = certCols.map(c => c.COLUMN_NAME);

    if (!certColNames.includes('certificate_number')) {
      await query(`ALTER TABLE certificates ADD COLUMN certificate_number VARCHAR(100) NULL AFTER intern_id`);
    }
    if (!certColNames.includes('certificate_type_id')) {
      await query(`ALTER TABLE certificates ADD COLUMN certificate_type_id INT UNSIGNED NULL AFTER intern_id`);
    }
    if (!certColNames.includes('verification_code')) {
      await query(`ALTER TABLE certificates ADD COLUMN verification_code VARCHAR(64) NULL AFTER certificate_number`);
    }
    if (!certColNames.includes('completion_date')) {
      await query(`ALTER TABLE certificates ADD COLUMN completion_date DATE NULL AFTER issue_date`);
    }
    if (!certColNames.includes('status')) {
      await query(`ALTER TABLE certificates ADD COLUMN status ENUM('issued', 'revoked', 'reissued') NOT NULL DEFAULT 'issued' AFTER signatory_title`);
    }
    if (!certColNames.includes('revocation_reason')) {
      await query(`ALTER TABLE certificates ADD COLUMN revocation_reason TEXT NULL AFTER status`);
    }
    if (!certColNames.includes('revoked_by')) {
      await query(`ALTER TABLE certificates ADD COLUMN revoked_by INT UNSIGNED NULL AFTER revocation_reason`);
    }
    if (!certColNames.includes('revoked_at')) {
      await query(`ALTER TABLE certificates ADD COLUMN revoked_at DATETIME NULL AFTER revoked_by`);
    }
    if (!certColNames.includes('issued_by')) {
      await query(`ALTER TABLE certificates ADD COLUMN issued_by INT UNSIGNED NULL AFTER revoked_at`);
    }
    if (!certColNames.includes('pdf_path')) {
      await query(`ALTER TABLE certificates ADD COLUMN pdf_path VARCHAR(255) NULL AFTER issued_by`);
    }
    if (!certColNames.includes('metadata')) {
      await query(`ALTER TABLE certificates ADD COLUMN metadata JSON NULL AFTER pdf_path`);
    }
    if (!certColNames.includes('updated_at')) {
      await query(`ALTER TABLE certificates ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    }

    // Add unique index on certificate_number and verification_code if not present
    const certIndexes = await query(`
      SHOW INDEX FROM certificates WHERE Key_name IN ('uq_cert_number', 'uq_cert_vcode')
    `);
    const certIndexNames = certIndexes.map(i => i.Key_name);
    if (!certIndexNames.includes('uq_cert_number')) {
      try {
        await query(`ALTER TABLE certificates ADD UNIQUE INDEX uq_cert_number (certificate_number)`);
      } catch (e) { /* ignore if already exists */ }
    }
    if (!certIndexNames.includes('uq_cert_vcode')) {
      try {
        await query(`ALTER TABLE certificates ADD UNIQUE INDEX uq_cert_vcode (verification_code)`);
      } catch (e) { /* ignore if already exists */ }
    }
    console.log('  ✅ `certificates` table evolved successfully.');

    // 6. Seed Default Document Types
    console.log('  Seeding default document types...');
    const [adminUser] = await query("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name IN ('super_admin', 'admin') LIMIT 1");
    const adminId = adminUser?.id || 1;

    const defaultDocTypes = [
      {
        name: 'National ID / Government Issued ID',
        code: 'NATIONAL_ID',
        description: 'Valid national identification card, international passport, or driver license for identity verification.',
        category: 'identification',
        is_required: 1,
        allowed_file_types: 'pdf,jpg,jpeg,png',
        max_file_size: 10485760
      },
      {
        name: 'Signed Internship Agreement',
        code: 'INTERNSHIP_AGREEMENT',
        description: 'Signed institutional terms and conditions governing confidentiality, attendance, and code of conduct.',
        category: 'agreement',
        is_required: 1,
        allowed_file_types: 'pdf',
        max_file_size: 10485760
      },
      {
        name: 'Academic Transcript / Student Verification',
        code: 'ACADEMIC_TRANSCRIPT',
        description: 'Official academic statement or matriculation letter verifying current student or graduate status.',
        category: 'academic',
        is_required: 1,
        allowed_file_types: 'pdf,jpg,jpeg,png',
        max_file_size: 10485760
      },
      {
        name: 'Final Capstone Project Report',
        code: 'FINAL_PROJECT_REPORT',
        description: 'Comprehensive documentation and codebase submission report for the capstone internship project.',
        category: 'completion',
        is_required: 0,
        allowed_file_types: 'pdf,zip,doc,docx',
        max_file_size: 20971520
      },
      {
        name: 'Curriculum Vitae (CV) / Resume',
        code: 'RESUME_CV',
        description: 'Current technical resume detailing background, skills, and previous practical experience.',
        category: 'other',
        is_required: 0,
        allowed_file_types: 'pdf,doc,docx',
        max_file_size: 10485760
      }
    ];

    for (const dt of defaultDocTypes) {
      const existing = await query("SELECT id FROM document_types WHERE code = ?", [dt.code]);
      if (existing.length === 0) {
        await query(`
          INSERT INTO document_types (name, code, description, category, is_required, allowed_file_types, max_file_size, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `, [dt.name, dt.code, dt.description, dt.category, dt.is_required, dt.allowed_file_types, dt.max_file_size, adminId]);
      }
    }
    console.log('  ✅ Default document types seeded.');

    // 7. Seed Default Certificate Types
    console.log('  Seeding default certificate types...');
    const defaultCertTypes = [
      {
        name: 'Internship Completion Certificate',
        code: 'INTERNSHIP_COMPLETION',
        description: 'Official institutional credential awarded upon fulfilling all requirements of the Jowis Studio Internship Program.',
        signatory_name: 'Dr. John O. Williams',
        signatory_title: 'Executive Director, Jowis Studio'
      },
      {
        name: 'Training Excellence Certificate',
        code: 'TRAINING_EXCELLENCE',
        description: 'Honors credential recognizing distinguished technical mastery, attendance diligence, and project execution.',
        signatory_name: 'Dr. John O. Williams',
        signatory_title: 'Executive Director, Jowis Studio'
      },
      {
        name: 'Certificate of Program Participation',
        code: 'PARTICIPATION',
        description: 'Official record recognizing program enrollment, active participation, and curriculum exposure.',
        signatory_name: 'Dr. John O. Williams',
        signatory_title: 'Executive Director, Jowis Studio'
      }
    ];

    for (const ct of defaultCertTypes) {
      const existing = await query("SELECT id FROM certificate_types WHERE code = ?", [ct.code]);
      if (existing.length === 0) {
        await query(`
          INSERT INTO certificate_types (name, code, description, template_layout, signatory_name, signatory_title, status, created_by)
          VALUES (?, ?, ?, 'standard', ?, ?, 'active', ?)
        `, [ct.name, ct.code, ct.description, ct.signatory_name, ct.signatory_title, adminId]);
      }
    }
    console.log('  ✅ Default certificate types seeded.');

    console.log('\n🎉 Phase 6 Database Migration Completed Successfully!\n');
  } catch (err) {
    console.error('❌ Phase 6 Migration Failed:', err);
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_phase6.js')) {
  runPhase6Migration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
