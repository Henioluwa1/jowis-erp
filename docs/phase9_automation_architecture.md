# Jowis Studio — Phase 9 Advanced ERP & Automation Architecture

## 1. Executive Summary

Phase 9 introduces a deterministic, transparent, auditable, and resilient **Automation Engine** to the **Jowis Studio Enterprise Internship ERP**. 

In an enterprise internship and technology training center, operational overhead scales with the number of cohorts, interns, mentors, and deliverables. Manual tracking of daily attendance cutoffs, overdue tasks, module completions, 4-gate certificate qualifications, document compliance, and mentor workloads leads to human error, delayed escalations, and compliance risks.

The Phase 9 Automation Engine automates recurring business processes deterministically while maintaining strict governance, auditable state transitions, bounded failure recovery, and real-time operational visibility.

---

## 2. Architecture & Components

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ADMIN CONSOLE                                   │
│  • Rules & Triggers Tab    • Execution History Tab   • Live Alerts Feed     │
│  • Manual Trigger "Run"    • Execution Inspector     • Actionable Deep-Links│
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ HTTPS / Bearer JWT (RBAC)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTOMATION CONTROLLER & API LAYER                        │
│   GET /rules       POST /rules/:ruleCode/run       GET /executions          │
│   PUT /rules/:id   POST /executions/:id/retry      GET /alerts              │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTOMATION SERVICE CORE                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 9 Business Rule Handlers (Deterministic, Scoped, Configurable)        │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ SHA-256 Idempotency Engine: H(ruleCode:entity:cycleDate)              │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ Bounded Retry Controller (Max 3 retries, terminal failure lock)       │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ System Alerts Aggregator (5 Anomaly Detectors)                        │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ Cross-Module Dispatcher: DB Trans + Notifications + Audit Logs        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MYSQL RELATIONAL PERSISTENCE                          │
│  • automation_rules (config, schedule, status, stats, timestamps)           │
│  • automation_executions (idempotency_key, payload, counters, retries)      │
│  • audit_logs (append-only trail with actor, action, diffs)                │
│  • notifications (in-app alerts to interns, mentors, admins)                │
│  • core domain tables (attendance, tasks, modules, certs, documents, users) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 `automation_rules` Table
Stores rule definitions, trigger types, schedules, parameters, and lifetime performance metrics.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PK` | Primary key |
| `rule_code` | `VARCHAR(60) UNIQUE NOT NULL` | Canonical rule code (e.g. `AUTO_ATTENDANCE_CLOSE`) |
| `rule_name` | `VARCHAR(150) NOT NULL` | Human-readable title |
| `description` | `TEXT` | Functional summary |
| `category` | `VARCHAR(50) NOT NULL` | Categorization: `attendance`, `tasks`, `training`, `performance`, `compliance`, `certification`, `cohorts`, `mentors`, `reporting` |
| `trigger_type` | `ENUM('scheduled', 'event', 'manual')` | How the rule is invoked |
| `cron_expression` | `VARCHAR(50)` | Standard 5-part cron or descriptive interval |
| `is_active` | `TINYINT(1) DEFAULT 1` | Global toggle flag |
| `configuration` | `JSON` | Dynamic rule parameters (thresholds, days, grace periods) |
| `last_executed_at` | `DATETIME` | Lagos timestamp of last execution |
| `last_execution_status`| `ENUM(...)` | `completed`, `failed`, `partial_failure`, `skipped`, `pending` |
| `consecutive_failures` | `INT DEFAULT 0` | Failure tracker for auto-disabling flaky jobs |
| `execution_count` | `INT DEFAULT 0` | Total runs counter |

### 3.2 `automation_executions` Table
Stores individual execution logs with complete input payloads, output metrics, and SHA-256 idempotency keys.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PK` | Execution identifier |
| `rule_id` | `INT NOT NULL FK` | References `automation_rules(id)` |
| `rule_code` | `VARCHAR(60) NOT NULL` | Canonical code |
| `trigger_source` | `ENUM('scheduler', 'event', 'manual', 'retry')` | Source of the trigger |
| `triggered_by` | `INT FK NULL` | User ID who triggered manually (NULL for system) |
| `idempotency_key` | `VARCHAR(128) UNIQUE` | SHA-256 hash preventing duplicate cycles |
| `status` | `ENUM('pending', 'running', 'completed', 'failed', 'partial_failure', 'skipped')` | Execution state |
| `payload` | `JSON` | Execution parameters and input context |
| `result` | `JSON` | Execution summary, details, and anomalies |
| `items_processed` | `INT DEFAULT 0` | Total records scanned |
| `items_modified` | `INT DEFAULT 0` | Records updated or inserted |
| `error_message` | `TEXT NULL` | Failure diagnostics |
| `retry_count` | `INT DEFAULT 0` | Retry counter (bounded <= 3) |
| `max_retries` | `INT DEFAULT 3` | Retry ceiling |
| `execution_time_ms`| `INT DEFAULT 0` | Duration in milliseconds |
| `created_at` | `DATETIME` | Timestamp |

---

## 4. Canonical Automation Rules

The engine implements 9 deterministic business rule handlers:

| Rule Code | Category | Description | Primary Side Effects |
| :--- | :--- | :--- | :--- |
| `AUTO_ATTENDANCE_CLOSE` | `attendance` | Daily closeout of Lagos attendance cutoff (09:00:00). Marks missing interns as `ABSENT`. | Inserts `ABSENT` attendance records for active enrolled interns with no check-in. |
| `AUTO_OVERDUE_TASKS` | `tasks` | Scans pending and in-progress tasks past `due_date`. | Transitions status to `overdue`, notifies intern and assigned mentor. |
| `AUTO_TRAINING_PROGRESS` | `training` | Calculates completion ratios across curriculum modules and tracks. | Computes overall training progress percentage per intern. |
| `AUTO_PERF_REMINDERS` | `performance` | Detects interns lacking evaluations for active review periods. | Dispatches actionable reminders to mentors with pending evaluations. |
| `AUTO_DOC_EXPIRY` | `compliance` | Audits verification status and expiration dates of intern documents. | Flags expired credentials, notifies interns to re-upload documents. |
| `AUTO_CERT_ELIGIBILITY` | `certification` | Evaluates the authoritative 4-Gate Certificate Criteria. | Computes qualification and updates eligibility registry without manual intervention. |
| `AUTO_COHORT_LIFECYCLE` | `cohorts` | Monitors cohort start and end dates. | Transitions cohorts (`upcoming` -> `active` -> `completed`). |
| `AUTO_MENTOR_WORKLOAD` | `mentors` | Checks intern-to-mentor allocation ratios against capacity limits (default: 15). | Flags overloaded mentors and generates admin system alerts. |
| `AUTO_SCHEDULED_REPORT` | `reporting` | Aggregates periodic executive internship performance metrics. | Generates structured operational digests for administration. |

---

## 5. Deterministic Idempotency Architecture

To prevent duplicate side-effects (such as redundant absence logs, repeated notifications, or conflicting state transitions) when an automation executes multiple times within the same cycle, the engine uses deterministic SHA-256 idempotency hashing:

```text
idempotencyKey = SHA-256(`${ruleCode}:${entityType || 'global'}:${entityId || '0'}:${cycleDate}`)
```

### Idempotency Flow
1. When a rule executes, the service calculates the target cycle date (e.g. `2026-09-19` for daily attendance).
2. It queries `automation_executions` for an existing execution with that `idempotency_key`.
3. **If found** and `force != true`:
   - Execution immediately returns `{ status: 'skipped', reason: 'already_executed_for_cycle' }`.
   - Zero database mutations occur.
   - Zero duplicate notifications are dispatched.
4. **If not found** or `force == true`:
   - An execution record is inserted with `status: 'running'`.
   - The handler completes mutations inside a transaction.
   - The execution record is finalized with `status: 'completed'`, `items_processed`, and `items_modified`.

---

## 6. Execution Lifecycle & Bounded Retries

```text
       ┌───────────┐
       │  TRIGGER  │ (Manual, Scheduler, Event)
       └─────┬─────┘
             │
             ▼
      [Idempotency Check]
        /           \
 [Already Run]   [New Cycle / Force]
      /               \
     ▼                 ▼
┌─────────┐      ┌─────────┐
│ SKIPPED │      │ RUNNING │
└─────────┘      └────┬────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
     [Success]               [Failure]
           │                     │
           ▼                     ▼
    ┌───────────┐        ┌──────────────┐
    │ COMPLETED │        │    FAILED    │
    └───────────┘        └──────┬───────┘
                                │
                    [Retry Requested (Admin)]
                                │
                    [retry_count < max_retries?]
                          /           \
                        [Yes]         [No]
                         /             \
                        ▼               ▼
                  ┌─────────┐    ┌───────────────┐
                  │ RUNNING │    │ 400 Bad Req   │
                  │ (retry) │    │ (Limit reached│
                  └─────────┘    └───────────────┘
```

### Retry Safeguards
- Only executions in `failed` or `partial_failure` state can be retried.
- Retries are strictly bounded by `max_retries` (default: 3).
- Attempting to retry a successful or completed execution returns `400 Bad Request`.
- Exceeding maximum retries locks the execution and prompts manual administrator intervention.

---

## 7. Real-Time Operational Alerts Feed

The engine includes an anomaly detection aggregator that surfaces 5 categories of real-time operational risks across the ERP:

1. **Unassigned Active Interns:** Interns in active cohorts without an assigned mentor.
2. **Overdue Evaluations:** Interns active for more than 7 days with zero performance reviews.
3. **Missing / Unverified Documents:** Interns lacking required onboarding documents.
4. **Mentor Overload:** Mentors assigned more interns than the configured maximum capacity (default: 15).
5. **Overdue Unsubmitted Tasks:** Intern deliverables pending submission past the deadline.

Each alert includes severity (`critical`, `warning`, `info`), count, summary, and a direct navigation link to the relevant administrative module (`/admin/users`, `/admin/mentors`, `/admin/documents`, etc.).

---

## 8. Role-Based Access Control & Security

| Operation | Super Admin | Operational Admin | Mentor | Intern |
| :--- | :---: | :---: | :---: | :---: |
| View Rules & Statistics (`GET /api/automation/rules`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |
| Trigger Rule ("Run Now") (`POST /api/automation/rules/:code/run`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |
| Update Rule Config (`PUT /api/automation/rules/:id`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |
| Toggle Active / Disabled (`PATCH /api/automation/rules/:id/toggle`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |
| View Execution History (`GET /api/automation/executions`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |
| Retry Failed Execution (`POST /api/automation/executions/:id/retry`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |
| View Live Alerts Feed (`GET /api/automation/alerts`) | Allowed | Allowed | 403 Forbidden | 403 Forbidden |

---

## 9. Verification & Test Metrics

- **Dedicated Suite:** `backend/tests/phase9.test.js`
  - Total Tests: **78**
  - Result: **78 Passed, 0 Failed, 0 Skipped**
- **Cumulative Regression Suite:** `npm run test:all`
  - Total Tests: **637** across 11 test files
  - Result: **637 Passed, 0 Failed, 0 Skipped (100% Pass Rate)**
- **Production Build:**
  - `npm run build` executed in 14.11s with 0 errors.
