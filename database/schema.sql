-- Jowis Studio Internship & Technology Training Center ERP System
-- Relational Database Schema
-- Database: jowis_studio_erp

CREATE DATABASE IF NOT EXISTS `jowis_studio_erp` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `jowis_studio_erp`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. ROLES
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `avatar_url` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `deactivation_reason` VARCHAR(255) NULL,
  `last_login` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_users_role` (`role_id`),
  INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TRACKS (Training Programs)
DROP TABLE IF EXISTS `tracks`;
CREATE TABLE `tracks` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `duration_weeks` INT UNSIGNED NOT NULL DEFAULT 24,
  `curriculum_summary` TEXT NULL,
  `required_skills` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. MENTORS
DROP TABLE IF EXISTS `mentors`;
CREATE TABLE `mentors` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL UNIQUE,
  `specialization` VARCHAR(150) NULL,
  `bio` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_mentors_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. COHORTS (Batches)
DROP TABLE IF EXISTS `cohorts`;
CREATE TABLE `cohorts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `cohort_code` VARCHAR(50) NOT NULL UNIQUE,
  `track_id` INT UNSIGNED NOT NULL,
  `lead_mentor_id` INT UNSIGNED NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `capacity` INT UNSIGNED NOT NULL DEFAULT 30,
  `description` TEXT NULL,
  `status` ENUM('upcoming', 'active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cohorts_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cohorts_mentor` FOREIGN KEY (`lead_mentor_id`) REFERENCES `mentors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_cohorts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. INTERN PROFILES
DROP TABLE IF EXISTS `intern_profiles`;
CREATE TABLE `intern_profiles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL UNIQUE,
  `intern_code` VARCHAR(50) NOT NULL UNIQUE,
  `track_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NOT NULL,
  `mentor_id` INT UNSIGNED NULL,
  `phone` VARCHAR(30) NULL,
  `gender` ENUM('male', 'female', 'other') NULL,
  `date_of_birth` DATE NULL,
  `address` TEXT NULL,
  `emergency_contact_name` VARCHAR(100) NULL,
  `emergency_contact_phone` VARCHAR(30) NULL,
  `education` VARCHAR(255) NULL,
  `skills` TEXT NULL,
  `previous_experience` TEXT NULL,
  `status` ENUM('applied', 'screening', 'accepted', 'onboarding', 'active', 'suspended', 'completed', 'dropped', 'alumni') NOT NULL DEFAULT 'active',
  `start_date` DATE NOT NULL,
  `expected_end_date` DATE NOT NULL,
  `actual_end_date` DATE NULL,
  `notes` TEXT NULL,
  `schedule_days` JSON NULL DEFAULT NULL,
  `schedule_locked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_intern_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_intern_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_intern_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_intern_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `mentors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_intern_status` (`status`),
  INDEX `idx_intern_track` (`track_id`),
  INDEX `idx_intern_cohort` (`cohort_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6B. INTERN ASSIGNMENT HISTORY
DROP TABLE IF EXISTS `intern_assignment_history`;
CREATE TABLE `intern_assignment_history` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `assignment_type` ENUM('track', 'cohort', 'mentor') NOT NULL,
  `previous_id` INT UNSIGNED NULL,
  `new_id` INT UNSIGNED NOT NULL,
  `previous_name` VARCHAR(150) NULL,
  `new_name` VARCHAR(150) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `changed_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_iah_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_iah_changer` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_iah_intern` (`intern_id`),
  INDEX `idx_iah_type` (`assignment_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6C. INTERN LIFECYCLE HISTORY
DROP TABLE IF EXISTS `intern_lifecycle_history`;
CREATE TABLE `intern_lifecycle_history` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `previous_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `changed_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ilh_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ilh_changer` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_ilh_intern` (`intern_id`),
  INDEX `idx_ilh_status` (`new_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. APPLICATIONS (Intake pipeline)
DROP TABLE IF EXISTS `applications`;
CREATE TABLE `applications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `track_id` INT UNSIGNED NOT NULL,
  `education` VARCHAR(255) NULL,
  `skills` TEXT NULL,
  `portfolio_url` VARCHAR(255) NULL,
  `resume_url` VARCHAR(255) NULL,
  `status` ENUM('new', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'waitlisted') NOT NULL DEFAULT 'new',
  `interview_date` DATETIME NULL,
  `interview_notes` TEXT NULL,
  `decision_notes` TEXT NULL,
  `converted_intern_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_app_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_app_converted` FOREIGN KEY (`converted_intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_app_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. ATTENDANCE (Authoritative module)
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `attendance_date` DATE NOT NULL,
  `check_in_time` TIME NOT NULL,
  `check_out_time` TIME NULL,
  `status` ENUM('PRESENT', 'LATE', 'ABSENT', 'EXCUSED') NOT NULL,
  `late_minutes` INT UNSIGNED NOT NULL DEFAULT 0,
  `marked_by` INT UNSIGNED NULL COMMENT 'NULL if intern self-marked, otherwise user_id of Admin',
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attendance_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_marked_by` FOREIGN KEY (`marked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `uk_intern_attendance_date` UNIQUE (`intern_id`, `attendance_date`),
  INDEX `idx_attendance_date` (`attendance_date`),
  INDEX `idx_attendance_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. ATTENDANCE AUDIT LOGS (Every manual correction)
DROP TABLE IF EXISTS `attendance_audit_logs`;
CREATE TABLE `attendance_audit_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `attendance_id` INT UNSIGNED NOT NULL,
  `intern_id` INT UNSIGNED NOT NULL,
  `changed_by` INT UNSIGNED NOT NULL,
  `old_status` ENUM('PRESENT', 'LATE', 'ABSENT', 'EXCUSED') NOT NULL,
  `new_status` ENUM('PRESENT', 'LATE', 'ABSENT', 'EXCUSED') NOT NULL,
  `old_time` TIME NULL,
  `new_time` TIME NULL,
  `reason` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_attendance` FOREIGN KEY (`attendance_id`) REFERENCES `attendance` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_changer` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9B. COMPANY HOLIDAYS & NON-WORKING DAYS
DROP TABLE IF EXISTS `company_holidays`;
CREATE TABLE `company_holidays` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `holiday_date` DATE NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9B_2. PERMISSION REQUESTS & EXCUSED ABSENCE WORKFLOW
DROP TABLE IF EXISTS `permission_requests`;
CREATE TABLE `permission_requests` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `request_code` VARCHAR(50) NOT NULL UNIQUE,
  `request_type` VARCHAR(50) NOT NULL DEFAULT 'absence',
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `affected_days_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `affected_dates` JSON NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `message` TEXT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `mentor_review_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'RECOMMENDED') NOT NULL DEFAULT 'PENDING',
  `mentor_review_notes` TEXT NULL,
  `reviewed_by_mentor_id` INT UNSIGNED NULL,
  `mentor_reviewed_at` DATETIME NULL,
  `final_review_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `final_review_notes` TEXT NULL,
  `reviewed_by_user_id` INT UNSIGNED NULL,
  `final_reviewed_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_perm_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_perm_mentor` FOREIGN KEY (`reviewed_by_mentor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_perm_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_perm_intern` (`intern_id`),
  INDEX `idx_perm_status` (`status`),
  INDEX `idx_perm_dates` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9C. TRAINING MODULES (Curriculum units within tracks)
DROP TABLE IF EXISTS `training_modules`;
CREATE TABLE `training_modules` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `track_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `module_code` VARCHAR(50) NOT NULL,
  `sequence_order` INT UNSIGNED NOT NULL DEFAULT 1,
  `estimated_hours` INT UNSIGNED NOT NULL DEFAULT 10,
  `status` ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tm_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uk_track_module_code` (`track_id`, `module_code`),
  INDEX `idx_tm_track` (`track_id`),
  INDEX `idx_tm_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TASKS (Technical milestones & assignments)
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `instructions` TEXT NULL,
  `expected_deliverable` VARCHAR(255) NULL,
  `track_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NULL,
  `module_id` INT UNSIGNED NULL,
  `task_type` ENUM('assignment', 'project', 'quiz', 'practical', 'research', 'coding', 'design', 'presentation', 'other') NOT NULL DEFAULT 'assignment',
  `difficulty` ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'intermediate',
  `assigned_by` INT UNSIGNED NOT NULL,
  `due_date` DATETIME NOT NULL,
  `due_days` INT UNSIGNED NULL,
  `estimated_hours` INT UNSIGNED NOT NULL DEFAULT 8,
  `max_score` INT UNSIGNED NOT NULL DEFAULT 100,
  `pass_score` INT UNSIGNED NOT NULL DEFAULT 60,
  `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
  `attachment_url` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tasks_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tasks_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tasks_module` FOREIGN KEY (`module_id`) REFERENCES `training_modules` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tasks_author` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_tasks_track` (`track_id`),
  INDEX `idx_tasks_module` (`module_id`),
  INDEX `idx_tasks_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10B. TASK ASSIGNMENTS (Task instantiation to intern/cohort)
DROP TABLE IF EXISTS `task_assignments`;
CREATE TABLE `task_assignments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT UNSIGNED NOT NULL,
  `intern_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NULL,
  `assigned_by` INT UNSIGNED NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATETIME NOT NULL,
  `status` ENUM('assigned', 'in_progress', 'submitted', 'under_review', 'returned', 'completed', 'overdue', 'cancelled') NOT NULL DEFAULT 'assigned',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ta_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ta_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ta_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ta_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uk_task_intern_assignment` (`task_id`, `intern_id`),
  INDEX `idx_ta_status` (`status`),
  INDEX `idx_ta_intern` (`intern_id`),
  INDEX `idx_ta_cohort` (`cohort_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. TASK SUBMISSIONS
DROP TABLE IF EXISTS `task_submissions`;
CREATE TABLE `task_submissions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_assignment_id` INT UNSIGNED NULL,
  `task_id` INT UNSIGNED NOT NULL,
  `intern_id` INT UNSIGNED NOT NULL,
  `submission_text` TEXT NULL,
  `submission_url` VARCHAR(255) NULL,
  `attachment_path` VARCHAR(255) NULL,
  `submitted_at` DATETIME NOT NULL,
  `attempt_number` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('submitted', 'under_review', 'returned', 'graded', 'completed') NOT NULL DEFAULT 'submitted',
  `score` DECIMAL(5, 2) NULL,
  `feedback` TEXT NULL,
  `graded_by` INT UNSIGNED NULL,
  `graded_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sub_ta` FOREIGN KEY (`task_assignment_id`) REFERENCES `task_assignments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sub_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sub_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sub_grader` FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_sub_task_intern` (`task_id`, `intern_id`),
  INDEX `idx_sub_ta` (`task_assignment_id`),
  INDEX `idx_sub_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11B. TASK REVIEWS (Audit history of mentor reviews)
DROP TABLE IF EXISTS `task_reviews`;
CREATE TABLE `task_reviews` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `submission_id` INT UNSIGNED NOT NULL,
  `reviewer_id` INT UNSIGNED NOT NULL,
  `score` DECIMAL(5, 2) NULL,
  `feedback` TEXT NULL,
  `status` ENUM('completed', 'returned') NOT NULL DEFAULT 'completed',
  `reviewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tr_sub` FOREIGN KEY (`submission_id`) REFERENCES `task_submissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tr_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_tr_sub` (`submission_id`),
  INDEX `idx_tr_reviewer` (`reviewer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. PERFORMANCE MANAGEMENT & EVALUATION ENGINE (Phase 4)
DROP TABLE IF EXISTS `evaluation_scores`;
DROP TABLE IF EXISTS `performance_evaluations`;
DROP TABLE IF EXISTS `performance_rating_bands`;
DROP TABLE IF EXISTS `performance_criteria`;
DROP TABLE IF EXISTS `performance_periods`;

CREATE TABLE `performance_periods` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('draft', 'active', 'closed', 'archived') NOT NULL DEFAULT 'draft',
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pp_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_pp_status` (`status`),
  INDEX `idx_pp_dates` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `performance_criteria` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `category` ENUM('technical', 'delivery', 'behavioral', 'leadership', 'communication', 'general') NOT NULL DEFAULT 'technical',
  `weight` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `max_score` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `order_index` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pc_status` (`status`),
  INDEX `idx_pc_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `performance_rating_bands` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `min_score` DECIMAL(5, 2) NOT NULL,
  `max_score` DECIMAL(5, 2) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT 'emerald',
  `description` TEXT NULL,
  `order_index` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_prb_scores` (`min_score`, `max_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `performance_evaluations` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `period_id` INT UNSIGNED NULL,
  `reviewer_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NULL,
  `track_id` INT UNSIGNED NULL,
  `evaluator_id` INT UNSIGNED NULL COMMENT 'Legacy compatibility alias for reviewer_id',
  `evaluation_period` VARCHAR(50) NULL COMMENT 'Descriptive cycle tag e.g. Q3-2026',
  `status` ENUM('draft', 'submitted', 'reviewed', 'finalized') NOT NULL DEFAULT 'draft',
  `overall_score` DECIMAL(5, 2) NULL COMMENT 'Server-calculated weighted percentage 0-100',
  `overall_rating` VARCHAR(50) NULL COMMENT 'Band descriptor e.g. Exceeds Expectations',
  `strengths` TEXT NULL,
  `areas_for_improvement` TEXT NULL,
  `reviewer_comments` TEXT NULL,
  `intern_comments` TEXT NULL,
  `summary_feedback` TEXT NULL COMMENT 'Legacy compatibility feedback mirror',
  `submitted_at` DATETIME NULL,
  `reviewed_at` DATETIME NULL,
  `finalized_at` DATETIME NULL,
  `finalized_by` INT UNSIGNED NULL,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 0,
  `amendment_reason` TEXT NULL,
  `amended_by` INT UNSIGNED NULL,
  `amended_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pe_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_period` FOREIGN KEY (`period_id`) REFERENCES `performance_periods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_finalized_by` FOREIGN KEY (`finalized_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_amended_by` FOREIGN KEY (`amended_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY `uk_pe_intern_period` (`intern_id`, `period_id`),
  INDEX `idx_pe_status` (`status`),
  INDEX `idx_pe_reviewer` (`reviewer_id`),
  INDEX `idx_pe_period` (`period_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `evaluation_scores` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `evaluation_id` INT UNSIGNED NOT NULL,
  `criterion_id` INT UNSIGNED NOT NULL,
  `score` DECIMAL(5, 2) NOT NULL,
  `max_score` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  `weight` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `weighted_score` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `comments` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_es_eval` FOREIGN KEY (`evaluation_id`) REFERENCES `performance_evaluations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_es_criterion` FOREIGN KEY (`criterion_id`) REFERENCES `performance_criteria` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uk_eval_criterion` (`evaluation_id`, `criterion_id`),
  INDEX `idx_es_eval` (`evaluation_id`),
  INDEX `idx_es_criterion` (`criterion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. CURRICULUM PROGRESS
DROP TABLE IF EXISTS `curriculum_progress`;
CREATE TABLE `curriculum_progress` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `module_name` VARCHAR(100) NOT NULL,
  `module_order` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  `completion_percentage` INT UNSIGNED NOT NULL DEFAULT 0,
  `completed_at` DATETIME NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_curr_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `uk_curr_module` UNIQUE (`intern_id`, `module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14A. DOCUMENT TYPES
DROP TABLE IF EXISTS `document_types`;
CREATE TABLE `document_types` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `category` ENUM('identification', 'academic', 'agreement', 'assessment', 'completion', 'other') NOT NULL DEFAULT 'other',
  `is_required` BOOLEAN NOT NULL DEFAULT 0,
  `allowed_file_types` VARCHAR(255) NOT NULL DEFAULT 'pdf,jpg,jpeg,png',
  `max_file_size` INT UNSIGNED NOT NULL DEFAULT 10485760,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_doctype_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_doctype_status` (`status`),
  INDEX `idx_doctype_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14B. INTERN DOCUMENTS
DROP TABLE IF EXISTS `intern_documents`;
CREATE TABLE `intern_documents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `document_type_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
  `current_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('uploaded', 'pending_verification', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending_verification',
  `uploaded_by` INT UNSIGNED NOT NULL,
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `verified_by` INT UNSIGNED NULL,
  `verified_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `expiry_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_idoc_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_idoc_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idoc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_idoc_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_idoc_intern` (`intern_id`),
  INDEX `idx_idoc_type` (`document_type_id`),
  INDEX `idx_idoc_status` (`status`),
  INDEX `idx_idoc_expiry` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14C. DOCUMENT VERSIONS
DROP TABLE IF EXISTS `document_versions`;
CREATE TABLE `document_versions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `document_id` INT UNSIGNED NOT NULL,
  `version_number` INT UNSIGNED NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL,
  `uploaded_by` INT UNSIGNED NOT NULL,
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('uploaded', 'pending_verification', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending_verification',
  `verified_by` INT UNSIGNED NULL,
  `verified_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_dver_doc` FOREIGN KEY (`document_id`) REFERENCES `intern_documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dver_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_dver_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_dver_doc` (`document_id`, `version_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15A. CERTIFICATE TYPES
DROP TABLE IF EXISTS `certificate_types`;
CREATE TABLE `certificate_types` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `template_layout` VARCHAR(50) NOT NULL DEFAULT 'standard',
  `signatory_name` VARCHAR(100) NOT NULL DEFAULT 'Executive Director',
  `signatory_title` VARCHAR(100) NOT NULL DEFAULT 'Lead Director, Jowis Studio',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_certtype_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_certtype_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15B. CERTIFICATES
DROP TABLE IF EXISTS `certificates`;
CREATE TABLE `certificates` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `certificate_type_id` INT UNSIGNED NULL,
  `certificate_number` VARCHAR(100) NOT NULL UNIQUE,
  `verification_code` VARCHAR(64) NOT NULL UNIQUE,
  `issue_date` DATE NOT NULL,
  `completion_date` DATE NOT NULL,
  `track_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NOT NULL,
  `signatory_name` VARCHAR(100) NOT NULL DEFAULT 'Executive Director',
  `signatory_title` VARCHAR(100) NOT NULL DEFAULT 'Lead Director, Jowis Studio',
  `status` ENUM('issued', 'revoked', 'reissued') NOT NULL DEFAULT 'issued',
  `revocation_reason` TEXT NULL,
  `revoked_by` INT UNSIGNED NULL,
  `revoked_at` DATETIME NULL,
  `issued_by` INT UNSIGNED NULL,
  `pdf_path` VARCHAR(255) NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cert_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_type` FOREIGN KEY (`certificate_type_id`) REFERENCES `certificate_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_revoker` FOREIGN KEY (`revoked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_issuer` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_cert_status` (`status`),
  INDEX `idx_cert_vcode` (`verification_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. ANNOUNCEMENTS
DROP TABLE IF EXISTS `announcement_acknowledgements`;
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `author_id` INT UNSIGNED NOT NULL,
  `target_type` ENUM('all', 'interns', 'mentors', 'admins', 'track', 'cohort', 'intern') NOT NULL DEFAULT 'all',
  `target_id` INT UNSIGNED NULL COMMENT 'Track ID, Cohort ID, or Intern ID if applicable',
  `status` ENUM('draft', 'scheduled', 'published', 'expired', 'archived') NOT NULL DEFAULT 'draft',
  `priority` ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `requires_acknowledgement` TINYINT(1) NOT NULL DEFAULT 0,
  `published_at` DATETIME NULL,
  `scheduled_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ann_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_ann_status_pub` (`status`, `published_at`),
  INDEX `idx_ann_target` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16A. ANNOUNCEMENT ACKNOWLEDGEMENTS
CREATE TABLE `announcement_acknowledgements` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `acknowledged_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ack_ann` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ack_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uk_ann_user` (`announcement_id`, `user_id`),
  INDEX `idx_ack_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. NOTIFICATIONS
DROP TABLE IF EXISTS `notification_preferences`;
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('attendance', 'task', 'evaluation', 'announcement', 'system', 'document', 'certificate') NOT NULL DEFAULT 'system',
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `related_entity_type` VARCHAR(50) NULL,
  `related_entity_id` INT UNSIGNED NULL,
  `link` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `read_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_notif_user_read` (`user_id`, `is_read`),
  INDEX `idx_notif_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17A. NOTIFICATION PREFERENCES
CREATE TABLE `notification_preferences` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL UNIQUE,
  `announcements_in_app` TINYINT(1) NOT NULL DEFAULT 1,
  `tasks_in_app` TINYINT(1) NOT NULL DEFAULT 1,
  `performance_in_app` TINYINT(1) NOT NULL DEFAULT 1,
  `documents_in_app` TINYINT(1) NOT NULL DEFAULT 1,
  `system_in_app` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Mandatory system notifications cannot be disabled',
  `email_notifications` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_pref_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_pref_system_in_app` CHECK (`system_in_app` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. SYSTEM SETTINGS
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NOT NULL,
  `value_type` ENUM('string', 'number', 'boolean', 'json', 'time') NOT NULL DEFAULT 'string',
  `category` VARCHAR(50) NOT NULL DEFAULT 'general',
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `description` VARCHAR(255) NULL,
  `updated_by` INT UNSIGNED NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_settings_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. AUDIT LOGS (Immutable governance trail)
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT UNSIGNED NULL,
  `old_value` JSON NULL,
  `new_value` JSON NULL,
  `reason` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
  INDEX `idx_audit_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. PERMISSIONS (Canonical RBAC domain capabilities)
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_perm_module` (`module`),
  INDEX `idx_perm_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. ROLE PERMISSIONS (Junction mapping)
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. AUTOMATION RULES (Phase 9 Enterprise Automation Engine)
DROP TABLE IF EXISTS `automation_rules`;
CREATE TABLE `automation_rules` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `rule_code` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'operations',
  `trigger_type` ENUM('schedule', 'event', 'manual') NOT NULL DEFAULT 'schedule',
  `schedule_interval` VARCHAR(50) NOT NULL DEFAULT 'daily',
  `action_type` VARCHAR(100) NOT NULL,
  `config` JSON NULL,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `last_run_at` DATETIME NULL,
  `next_run_at` DATETIME NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ar_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_ar_code` (`rule_code`),
  INDEX `idx_ar_category` (`category`),
  INDEX `idx_ar_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. AUTOMATION EXECUTIONS (Audit history and execution records)
DROP TABLE IF EXISTS `automation_executions`;
CREATE TABLE `automation_executions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `rule_id` INT UNSIGNED NOT NULL,
  `rule_code` VARCHAR(64) NOT NULL,
  `trigger_type` VARCHAR(30) NOT NULL DEFAULT 'manual',
  `idempotency_key` VARCHAR(128) NOT NULL,
  `status` ENUM('pending', 'running', 'completed', 'failed', 'skipped', 'retrying') NOT NULL DEFAULT 'pending',
  `start_time` DATETIME NOT NULL,
  `completion_time` DATETIME NULL,
  `retry_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `max_retries` INT UNSIGNED NOT NULL DEFAULT 3,
  `affected_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `details` JSON NULL,
  `error_message` TEXT NULL,
  `executed_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ae_rule` FOREIGN KEY (`rule_id`) REFERENCES `automation_rules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ae_executor` FOREIGN KEY (`executed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_ae_rule_id` (`rule_id`),
  INDEX `idx_ae_status` (`status`),
  INDEX `idx_ae_key` (`idempotency_key`),
  INDEX `idx_ae_start` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
