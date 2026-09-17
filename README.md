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
- Interns can **only view their own attendance, performance, and submissions**.
- Interns attempting to fetch other interns' records receive `403 Forbidden`.
- Interns cannot alter attendance records, grades, or administrative settings.
