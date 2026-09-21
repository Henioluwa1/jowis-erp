# Jowis Studio — Enterprise Internship & Technology Training Center ERP

A production-ready, full-stack Enterprise Resource Planning (ERP) platform built for **Jowis Studio** to manage the end-to-end technology training lifecycle: intern applications, tracks, cohorts, mentors, authoritative attendance (with timezone-aware 9:00 AM cutoff), assignments/tasks, multi-factor performance evaluations, curriculum progress, certification, documents, communications, and organizational analytics.

---

## 1. System Architecture

```text
React.js + Vite + Tailwind CSS Frontend (Port 5173)
                   │
                   │ REST API (Bearer JWT)
                   ▼
Node.js + Express.js API Server (Port 5000)
                   │
                   │ mysql2 connection pool
                   ▼
MySQL Relational Database `jowis_studio_erp` (XAMPP Port 3306)
```

---

## 2. Default Demo Credentials

For development and evaluation, the database is pre-seeded with realistic accounts:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@jowis.com` | `Admin@12345` | Femi Ogunleye (Full Administrative Access) |
| **Operational Admin** | `operations@jowis.com` | `Admin@12345` | Blessing Johnson (Daily Operations) |
| **Lead Mentor** | `mentor.sam@jowis.com` | `Mentor@12345` | Samuel Adeyemi (Software Dev Mentor) |
| **UI/UX Mentor** | `mentor.chioma@jowis.com` | `Mentor@12345` | Chioma Okeke (Product Design Mentor) |
| **Intern 1** | `intern@jowis.com` | `Intern@12345` | David Adeleke (`JOWIS-INT-2026-001`) |
| **Intern 2** | `intern.zainab@jowis.com` | `Intern@12345` | Zainab Bello (`JOWIS-INT-2026-002`) |

> [!NOTE]
> The login portal at `http://localhost:5173/login` includes one-click quick demo buttons to instantly populate credentials for rapid testing.

---

## 3. Authoritative Attendance Rule (`Africa/Lagos`)

- **Operational Timezone:** `Africa/Lagos` (UTC+1)
- **Cutoff Time:** `09:00:00 AM`
- **Classification Rules:**
  - **Arrival before 09:00:00 AM** (`< 09:00:00`): **`PRESENT`** (0 late minutes)
  - **Arrival at or after 09:00:00 AM** (`>= 09:00:00`): **`LATE`** (`late_minutes = arrival - 09:00 AM`)
- The server clock is strictly authoritative. Client/browser clock tampering is prevented.
- Duplicate check-ins on the same calendar day are prevented via `UNIQUE KEY (intern_id, attendance_date)`.
- All administrative manual corrections require a mandatory reason and are logged to `attendance_audit_logs`.

---

## 4. Installation & Local Development Setup

### Prerequisites
- Node.js (v18+ or v24+)
- XAMPP (with MySQL service running on port 3306)
- npm

### Step 1: Start MySQL in XAMPP
Ensure MySQL is started in your XAMPP Control Panel (`localhost:3306`).

### Step 2: Initialize & Seed Database
From the project root:
```bash
cd backend
npm install
node src/scripts/init_db.js
```
This will automatically create the database `jowis_studio_erp`, run `database/schema.sql`, and seed all demo users, tracks, cohorts, attendance, tasks, and evaluations.

### Step 3: Run Backend Tests
Verify attendance rules and API authentication:
```bash
cd backend
npm test
node tests/api.test.js
```

### Step 4: Start Backend API Server
```bash
cd backend
npm start
# Server will run on http://localhost:5000 (API Base: http://localhost:5000/api)
```

### Step 5: Start Frontend Application
In a new terminal:
```bash
cd frontend
npm install
npm run dev
# Frontend will run on http://localhost:5173
```

---

## 5. Security & Ownership Rules
- Interns can **only view their own attendance, performance, documents, and submissions**.
- Interns attempting to fetch other interns' records receive `403 Forbidden`.
- Interns cannot alter attendance records, grades, certificates, or administrative settings.
- Notification scope is strictly enforced server-side; cross-user notification queries or actions return `403 Forbidden`.

---

## 6. Phase 7: Communication & Notification Engine

Phase 7 introduces an enterprise-grade communications hub, multi-audience announcement broadcaster, acknowledgement tracking system, and real-time notification engine.

### Core Capabilities & Audit Hardening
- **Announcement Lifecycle:** `draft`, `scheduled`, `published`, `expired`, and `archived` states with automatic time-based transitions.
- **Server-Authoritative Audience Targeting:** Broadcasts resolve recipients securely server-side targeting `all`, `interns`, `mentors`, `admins`, specific `track`, specific `cohort`, or individual `intern`. Hardened against mentor cross-cohort scope leaks.
- **Deterministic Idempotency:** Action/event-aware deterministic SHA-256 idempotency hashing (`userId:type:entityType:entityId:title:message`) to eliminate duplicate notification processing while preserving legitimate distinct events.
- **Urgent Announcement Acknowledgement:** Mandatory acknowledgement tracking (`announcement_acknowledgements`), pending banners for interns, and real-time administrative compliance tracking with percentage progress bars.
- **In-App Notification Engine:** Real-time unread badges, mark as read/unread/all, dismiss actions, read timestamps (`read_at`).
- **User Notification Preferences:** Granular user controls (`announcements_in_app`, `tasks_in_app`, `performance_in_app`, etc.) with mandatory system alerts permanently locked ON with database-level CHECK constraint (`system_in_app = 1`).
- **Cross-Module Event Triggers:** Automated in-app notifications dispatched for document verification/rejection, certificate issuance/revocation, task assignments/reviews, and performance evaluations.

---

## 7. Phase 8: Administration, Audit & System Governance

Phase 8 provides Jowis Studio ERP with an enterprise-grade administrative, governance, and audit layer.

### Core Capabilities
- **Centralized Governance Hub (`/admin/governance`):** Unified administrative portal with tabbed sections for Governance Overview, User Administration, Roles & Permissions, Organization & System Settings, and Immutable Audit Logs.
- **User Administration:** Paginated, searchable, and role-filtered user roster. Profile inspection without password hash exposure, secure password resets, and account activation/deactivation requiring mandatory justification reasons.
- **Privilege Escalation Protection:** Strict server-side RBAC safeguards:
  - Self-deactivation and self-role modifications are prohibited.
  - Operational Admins cannot elevate users to `super_admin`.
  - Non-super admins cannot alter security-critical system settings.
  - Mentors and Interns are strictly blocked from all administrative endpoints (403 Forbidden).
- **Canonical Permissions Matrix:** 32 canonical domain capabilities mapped across 14 modules (`users`, `roles`, `system`, `attendance`, `interns`, `training`, `tasks`, `performance`, `reports`, `documents`, `certificates`, `communications`, `settings`, `audit`) with relational junction tables (`permissions`, `role_permissions`).
- **Organization & System Configuration:** Controlled parameter registry supporting typed values (`string`, `number`, `boolean`, `json`, `time`), format validation, audit recording, and public/private flag enforcement.
- **Authoritative Africa/Lagos Time & Attendance Rules:** Organization defaults preserved with strict server-side cutoff (`09:00:00 AM`) and working schedule definition.
- **Immutable Audit Trail:** Append-only audit logs with HTTP 405 Method Not Allowed enforcement for any `PUT` or `DELETE` mutation requests. Captures actor ID, action, entity type, entity ID, before/after JSON diffs, mandatory justification reasons, HTTP status, client IP address, and User-Agent headers.

### Verification & Testing (Phase 8)
```bash
# Run Phase 7 audit test suite (73 assertions)
cd backend
npm run test:phase7

# Run Phase 8 dedicated suite (78 assertions)
cd backend
npm run test:phase8
```

---

## 8. Phase 9: Advanced ERP & Automation

Phase 9 implements an enterprise-grade, deterministic, and auditable **Automation Engine** for Jowis Studio ERP, streamlining daily operations without black-box or non-deterministic automation risks.

### Core Capabilities
- **Centralized Automation Console (`/admin/automation`):** Dedicated administrative console featuring three integrated tabs:
  1. **Rules & Triggers:** Active automation rules registry with category filters (`All`, `Attendance`, `Tasks`, `Training`, `Compliance`, `Mentors`), instant execution metrics, manual "Run Now" trigger, and modal-based rule configuration.
  2. **Execution History:** Paginated log of all historical executions with status filters, latency metrics, items processed/modified counters, detailed JSON inspector, and one-click retry for failed jobs.
  3. **Live Operational Alerts Feed:** Real-time anomaly feed identifying critical business risks (unassigned interns, overdue reviews, missing documents, overloaded mentors, and past-due tasks) with direct administrative module deep-links.
- **9 Deterministic Business Rules:**
  - `AUTO_ATTENDANCE_CLOSE`: Daily Lagos cutoff (09:00:00) absence reconciliation for enrolled interns.
  - `AUTO_OVERDUE_TASKS`: Overdue task detection and status escalation to `overdue`.
  - `AUTO_TRAINING_PROGRESS`: Curriculum module completion aggregation per intern.
  - `AUTO_PERF_REMINDERS`: Mentor performance evaluation reminders for active periods.
  - `AUTO_DOC_EXPIRY`: Compliance and document expiration auditor.
  - `AUTO_CERT_ELIGIBILITY`: Authoritative 4-Gate Certificate Criteria evaluator.
  - `AUTO_COHORT_LIFECYCLE`: Cohort transition engine (`upcoming` -> `active` -> `completed`).
  - `AUTO_MENTOR_WORKLOAD`: Mentor allocation capacity monitor (threshold: 15 interns).
  - `AUTO_SCHEDULED_REPORT`: Executive operational digest generator.
- **Deterministic SHA-256 Idempotency Engine:** Prevents duplicate side-effects on repeated execution cycles (`ruleCode:entity:cycleDate`). Non-forced repeated triggers cleanly return `skipped`.
- **Bounded Retries:** Automatic failure recovery bounded to a maximum of 3 retries. Only `failed` or `partial_failure` runs can be retried.
- **Role-Based Access Control:** Strictly restricted to `super_admin` and `admin`. Direct access or API requests by `mentor` and `intern` roles return `403 Forbidden`.

---

## 9. Phase 10: Final QA, Security Hardening & Deployment Readiness

Phase 10 transition the ERP to institutional deployment readiness through an exhaustive 20-Gate forensic audit:
- **Authentication & Secret Hardening:** Verified all 6 demo accounts. Password hashes and credentials strictly omitted from API responses and normal logs. Server-side logout endpoint with audit logging.
- **SQL Parameterization Hardening:** 100% prepared statements across all queries. Converted all array join interpolations in communications to parameterized placeholders.
- **File Upload Protection:** Comprehensive blocked extensions (`.exe`, `.php`, `.jsp`, `.asp`, `.aspx`, `.bash`, `.ps1`, etc.), path-traversal payload rejection, and MIME verification across all document and task upload endpoints.
- **Institutional 4-Gate Certificate Verification:** Automated server-side validation across lifecycle status, task completion rate, performance ratings, and verified compliance documents prior to issuance.
- **Frontend Crash Prevention & Forensic QA:** Fixed paginated array extraction in document management and restored missing icon imports. Full browser verification conducted across Super Admin, Operational Admin, Mentor, and Intern roles.

---

## 10. Implementation Status Matrix (Phases 1–10)

| Phase | Module | Status | Assertions | Key Milestones |
| :--- | :--- | :---: | :---: | :--- |
| **Phase 1** | Foundation, Auth & DB | Passed | 45 | MySQL schema, JWT auth, Bcrypt passwords |
| **Phase 2** | Attendance & Timezone | Passed | 52 | Africa/Lagos timezone, 09:00 AM cutoff |
| **Phase 3** | Interns, Cohorts & Tracks | Passed | 48 | Intern lifecycle, track management |
| **Phase 4** | Tasks & Submissions | Passed | 56 | Task assignments, grading, submissions |
| **Phase 5** | Evaluations & Feedback | Passed | 58 | Multi-factor metrics, mentor reviews |
| **Phase 6** | Documents & Certificates | Passed | 64 | 4-Gate certification, verification |
| **Phase 7** | Communications & Alerts | Passed | 73 | Announcements, in-app notifications |
| **Phase 8** | Administration & Governance | Passed | 78 | RBAC matrix, audit logs, system config |
| **Phase 9** | Advanced ERP & Automation | Passed | 78 | 9 rules, idempotency, bounded retries |
| **Phase 10**| Final QA & Deployment | Passed | 75 | Forensic audit, upload hardening, 20 gates |
| **Cumulative**| **Full ERP System** | **ALL PASSED** | **712** | **12 Suites, 0 Failures, 0 Skipped** |

---

## 11. Comprehensive Verification & Testing

```bash
# Run Phase 10 dedicated QA & hardening suite (75 assertions)
cd backend
npm run test:phase10

# Run full project regression suite (712 assertions across all 12 modules)
cd backend
npm run test:all

# Production frontend build
cd frontend
npm run build
```

---

## 12. Deployment Checklist & Notes

1. **Environment Configuration:** Copy `backend/.env.example` to `backend/.env` and configure `NODE_ENV=production`, custom `JWT_SECRET`, and production database credentials.
2. **Database Initialization:** Run `npm run init-db` in `backend/` to provision schema, constraints, and baseline institutional records.
3. **Frontend Build:** Run `npm run build` in `frontend/` to generate production assets in `frontend/dist/`.
4. **Reverse Proxy:** Direct `/api` and `/uploads` requests to the Node.js process (port 5000) and serve `frontend/dist/` statically.

