import { query } from '../config/db.js';

export async function runPhase8Migration() {
  console.log('🚀 Running Phase 8 Database Migration (Administration, Audit & System Governance)...');

  try {
    // -------------------------------------------------------------
    // 1. Evolve `users` Table
    // -------------------------------------------------------------
    console.log('  Checking `users` table for deactivation tracking...');
    const userCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    `);
    const userColNames = userCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!userColNames.includes('deactivation_reason')) {
      console.log('    Adding `deactivation_reason` to `users`...');
      await query(`ALTER TABLE users ADD COLUMN deactivation_reason VARCHAR(255) NULL AFTER is_active`);
    }

    // -------------------------------------------------------------
    // 2. Evolve `audit_logs` Table (Gates 8, 11)
    // -------------------------------------------------------------
    console.log('  Evolving `audit_logs` table for enterprise governance...');
    const auditCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'
    `);
    const auditColNames = auditCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!auditColNames.includes('reason')) {
      console.log('    Adding `reason` column to `audit_logs`...');
      await query(`ALTER TABLE audit_logs ADD COLUMN reason VARCHAR(255) NULL AFTER new_value`);
    }

    if (!auditColNames.includes('status')) {
      console.log('    Adding `status` column to `audit_logs`...');
      await query(`ALTER TABLE audit_logs ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' AFTER reason`);
    }

    if (!auditColNames.includes('user_agent')) {
      console.log('    Adding `user_agent` column to `audit_logs`...');
      await query(`ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip_address`);
    }

    try {
      await query(`CREATE INDEX idx_audit_user_created ON audit_logs (user_id, created_at)`);
    } catch (e) {}

    // -------------------------------------------------------------
    // 3. Create `permissions` and `role_permissions` (Gate 4)
    // -------------------------------------------------------------
    console.log('  Creating `permissions` and `role_permissions` schema...');
    await query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_perm_module (module),
        INDEX idx_perm_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT UNSIGNED NOT NULL,
        permission_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed canonical permissions matrix
    console.log('  Seeding canonical permissions across 14 enterprise domains...');
    const permissionsData = [
      // Users
      { module: 'users', action: 'read', slug: 'users:read', description: 'View user roster and profile records' },
      { module: 'users', action: 'create', slug: 'users:create', description: 'Create new user accounts' },
      { module: 'users', action: 'update', slug: 'users:update', description: 'Update user account profile information' },
      { module: 'users', action: 'status', slug: 'users:status', description: 'Activate or deactivate user accounts with mandatory justification' },
      { module: 'users', action: 'role', slug: 'users:role', description: 'Assign or modify user roles with privilege escalation controls' },
      { module: 'users', action: 'reset_password', slug: 'users:reset_password', description: 'Administratively reset user passwords' },

      // Roles & Governance
      { module: 'roles', action: 'read', slug: 'roles:read', description: 'View role definitions and permission mappings' },
      { module: 'roles', action: 'manage', slug: 'roles:manage', description: 'Manage role assignments and security policies' },

      // Settings
      { module: 'settings', action: 'read', slug: 'settings:read', description: 'View system and organization settings' },
      { module: 'settings', action: 'update', slug: 'settings:update', description: 'Update system and organization configuration' },

      // Audit
      { module: 'audit', action: 'read', slug: 'audit:read', description: 'Inspect audit trails and governance logs' },

      // Attendance
      { module: 'attendance', action: 'read', slug: 'attendance:read', description: 'View attendance registers and analytics' },
      { module: 'attendance', action: 'manage', slug: 'attendance:manage', description: 'Execute daily close and manual attendance corrections' },
      { module: 'attendance', action: 'record', slug: 'attendance:record', description: 'Self check-in against Lagos cutoff clock' },

      // Interns
      { module: 'interns', action: 'read', slug: 'interns:read', description: 'View intern profiles and placements' },
      { module: 'interns', action: 'manage', slug: 'interns:manage', description: 'Enroll, reassign, and transition intern lifecycles' },

      // Tracks & Cohorts
      { module: 'tracks', action: 'read', slug: 'tracks:read', description: 'View training tracks and curriculum blueprints' },
      { module: 'tracks', action: 'manage', slug: 'tracks:manage', description: 'Create, update, and manage training tracks' },
      { module: 'cohorts', action: 'read', slug: 'cohorts:read', description: 'View cohort batches and schedules' },
      { module: 'cohorts', action: 'manage', slug: 'cohorts:manage', description: 'Create, update, and manage cohorts' },

      // Tasks
      { module: 'tasks', action: 'read', slug: 'tasks:read', description: 'View task curriculum and assignments' },
      { module: 'tasks', action: 'manage', slug: 'tasks:manage', description: 'Author tasks and assign deliverables' },
      { module: 'tasks', action: 'submit', slug: 'tasks:submit', description: 'Submit technical work deliverables' },
      { module: 'tasks', action: 'review', slug: 'tasks:review', description: 'Grade deliverables and return for revision' },

      // Performance
      { module: 'performance', action: 'read', slug: 'performance:read', description: 'View performance evaluations and radar distributions' },
      { module: 'performance', action: 'evaluate', slug: 'performance:evaluate', description: 'Score interns against institutional criteria' },
      { module: 'performance', action: 'finalize', slug: 'performance:finalize', description: 'Finalize, lock, and amend performance records' },

      // Reports
      { module: 'reports', action: 'read', slug: 'reports:read', description: 'Access executive dashboards and analytics' },
      { module: 'reports', action: 'export', slug: 'reports:export', description: 'Export RFC-4180 audit CSV reports' },

      // Documents
      { module: 'documents', action: 'read', slug: 'documents:read', description: 'Inspect institutional compliance documents' },
      { module: 'documents', action: 'upload', slug: 'documents:upload', description: 'Upload compliance document versions' },
      { module: 'documents', action: 'verify', slug: 'documents:verify', description: 'Verify or reject compliance documents' },

      // Certificates
      { module: 'certificates', action: 'read', slug: 'certificates:read', description: 'View issued certificates and registry' },
      { module: 'certificates', action: 'issue', slug: 'certificates:issue', description: 'Verify eligibility and issue official certificates' },
      { module: 'certificates', action: 'revoke', slug: 'certificates:revoke', description: 'Revoke credentials with formal justification' },

      // Communications
      { module: 'communications', action: 'read', slug: 'communications:read', description: 'View announcements and notifications' },
      { module: 'communications', action: 'broadcast', slug: 'communications:broadcast', description: 'Author, schedule, and broadcast targeted announcements' }
    ];

    for (const p of permissionsData) {
      await query(`
        INSERT INTO permissions (module, action, slug, description)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description)
      `, [p.module, p.action, p.slug, p.description]);
    }

    // Role mapping
    const roles = await query('SELECT id, name FROM roles');
    const roleMap = {};
    roles.forEach(r => { roleMap[r.name] = r.id; });

    const allPermRows = await query('SELECT id, slug FROM permissions');
    const permMap = {};
    allPermRows.forEach(p => { permMap[p.slug] = p.id; });

    // Super Admin: Has ALL permissions
    if (roleMap['super_admin']) {
      for (const p of allPermRows) {
        await query(`
          INSERT IGNORE INTO role_permissions (role_id, permission_id)
          VALUES (?, ?)
        `, [roleMap['super_admin'], p.id]);
      }
    }

    // Operational Admin: All operational permissions, excludes self-escalation
    if (roleMap['admin']) {
      const adminSlugs = [
        'users:read', 'users:create', 'users:update', 'users:status', 'users:reset_password',
        'roles:read', 'settings:read', 'settings:update', 'audit:read',
        'attendance:read', 'attendance:manage',
        'interns:read', 'interns:manage',
        'tracks:read', 'tracks:manage',
        'cohorts:read', 'cohorts:manage',
        'tasks:read', 'tasks:manage', 'tasks:review',
        'performance:read', 'performance:evaluate', 'performance:finalize',
        'reports:read', 'reports:export',
        'documents:read', 'documents:verify',
        'certificates:read', 'certificates:issue', 'certificates:revoke',
        'communications:read', 'communications:broadcast'
      ];
      for (const slug of adminSlugs) {
        if (permMap[slug]) {
          await query(`
            INSERT IGNORE INTO role_permissions (role_id, permission_id)
            VALUES (?, ?)
          `, [roleMap['admin'], permMap[slug]]);
        }
      }
    }

    // Mentor: Scoped pedagogical permissions
    if (roleMap['mentor']) {
      const mentorSlugs = [
        'interns:read',
        'tracks:read',
        'cohorts:read',
        'tasks:read', 'tasks:review',
        'performance:read', 'performance:evaluate',
        'reports:read',
        'documents:read', 'documents:verify',
        'communications:read'
      ];
      for (const slug of mentorSlugs) {
        if (permMap[slug]) {
          await query(`
            INSERT IGNORE INTO role_permissions (role_id, permission_id)
            VALUES (?, ?)
          `, [roleMap['mentor'], permMap[slug]]);
        }
      }
    }

    // Intern: Individual self-service permissions
    if (roleMap['intern']) {
      const internSlugs = [
        'attendance:record',
        'tasks:submit',
        'documents:upload',
        'communications:read'
      ];
      for (const slug of internSlugs) {
        if (permMap[slug]) {
          await query(`
            INSERT IGNORE INTO role_permissions (role_id, permission_id)
            VALUES (?, ?)
          `, [roleMap['intern'], permMap[slug]]);
        }
      }
    }
    console.log('  ✅ Permissions matrix mapped successfully.');

    // -------------------------------------------------------------
    // 4. Evolve `system_settings` Table (Gates 6, 7)
    // -------------------------------------------------------------
    console.log('  Evolving `system_settings` table...');
    const settCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings'
    `);
    const settColNames = settCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!settColNames.includes('value_type')) {
      console.log('    Adding `value_type` column to `system_settings`...');
      await query(`ALTER TABLE system_settings ADD COLUMN value_type ENUM('string', 'number', 'boolean', 'json', 'time') NOT NULL DEFAULT 'string' AFTER setting_value`);
    }

    if (!settColNames.includes('is_public')) {
      console.log('    Adding `is_public` column to `system_settings`...');
      await query(`ALTER TABLE system_settings ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER category`);
    }

    if (!settColNames.includes('updated_by')) {
      console.log('    Adding `updated_by` column to `system_settings`...');
      await query(`ALTER TABLE system_settings ADD COLUMN updated_by INT UNSIGNED NULL AFTER description`);
      try {
        await query(`ALTER TABLE system_settings ADD CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      } catch (e) {}
    }

    // Set correct value_types for existing keys
    await query(`UPDATE system_settings SET value_type = 'time' WHERE setting_key IN ('attendance_cutoff_time', 'attendance_auto_close_time')`);
    await query(`UPDATE system_settings SET value_type = 'json' WHERE setting_key = 'working_days'`);
    await query(`UPDATE system_settings SET value_type = 'number' WHERE setting_key LIKE 'weight_%' OR setting_key LIKE 'alert_%'`);
    await query(`UPDATE system_settings SET value_type = 'boolean' WHERE setting_key = 'auto_close_attendance_enabled'`);

    // Seed authoritative organization settings (Gate 6) preserving existing defaults
    const orgSettings = [
      {
        key: 'organization_contact_email',
        value: 'operations@jowis.com',
        type: 'string',
        category: 'general',
        description: 'Official corporate communications email for Jowis Studio',
        is_public: 1
      },
      {
        key: 'organization_contact_phone',
        value: '+234 800 569 4738',
        type: 'string',
        category: 'general',
        description: 'Official front desk contact number',
        is_public: 1
      },
      {
        key: 'organization_address',
        value: '12 Innovation Hub Boulevard, Victoria Island, Lagos, Nigeria',
        type: 'string',
        category: 'general',
        description: 'Official physical studio training facility location',
        is_public: 1
      },
      {
        key: 'certificate_signatory_title',
        value: 'Director of Engineering & Training',
        type: 'string',
        category: 'certificates',
        description: 'Authoritative title displayed on institutional certificates',
        is_public: 0
      },
      {
        key: 'certificate_signatory_name',
        value: 'Femi Ogunleye',
        type: 'string',
        category: 'certificates',
        description: 'Institutional certificate signatory name',
        is_public: 0
      },
      {
        key: 'security_session_timeout_minutes',
        value: '1440',
        type: 'number',
        category: 'security',
        description: 'JWT authorization active lifetime in minutes',
        is_public: 0
      },
      {
        key: 'security_password_min_length',
        value: '8',
        type: 'number',
        category: 'security',
        description: 'Enforced minimum password complexity character count',
        is_public: 0
      },
      {
        key: 'communication_default_priority',
        value: 'normal',
        type: 'string',
        category: 'communications',
        description: 'Default priority assigned to new general announcements',
        is_public: 0
      }
    ];

    for (const s of orgSettings) {
      await query(`
        INSERT INTO system_settings (setting_key, setting_value, value_type, category, is_public, description)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          value_type = VALUES(value_type),
          is_public = VALUES(is_public),
          description = VALUES(description)
      `, [s.key, s.value, s.type, s.category, s.is_public, s.description]);
    }
    console.log('  ✅ Organization and system configuration seeded.');

    // -------------------------------------------------------------
    // 5. Hardening Notification Preferences (Gate A5)
    // -------------------------------------------------------------
    try {
      await query(`ALTER TABLE notification_preferences ADD CONSTRAINT chk_pref_system_in_app CHECK (system_in_app = 1)`);
    } catch (e) {
      // Constraint may already exist
    }

    console.log('✨ Phase 8 Database Migration Completed Successfully!');
  } catch (error) {
    console.error('❌ Phase 8 Database Migration Failed:', error);
    throw error;
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_phase8.js')) {
  runPhase8Migration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
