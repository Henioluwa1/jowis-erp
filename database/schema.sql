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

-- 10. TASKS & ASSIGNMENTS
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `track_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NULL,
  `assigned_by` INT UNSIGNED NOT NULL,
  `due_date` DATETIME NOT NULL,
  `max_score` INT UNSIGNED NOT NULL DEFAULT 100,
  `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  `attachment_url` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tasks_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tasks_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tasks_author` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. TASK SUBMISSIONS
DROP TABLE IF EXISTS `task_submissions`;
CREATE TABLE `task_submissions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT UNSIGNED NOT NULL,
  `intern_id` INT UNSIGNED NOT NULL,
  `submission_text` TEXT NULL,
  `submission_url` VARCHAR(255) NULL,
  `submitted_at` DATETIME NOT NULL,
  `status` ENUM('submitted', 'under_review', 'graded', 'late') NOT NULL DEFAULT 'submitted',
  `score` DECIMAL(5, 2) NULL,
  `feedback` TEXT NULL,
  `graded_by` INT UNSIGNED NULL,
  `graded_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sub_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sub_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sub_grader` FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `uk_task_intern` UNIQUE (`task_id`, `intern_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. PERFORMANCE EVALUATIONS (Multi-Factor Scoring)
DROP TABLE IF EXISTS `performance_evaluations`;
CREATE TABLE `performance_evaluations` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `evaluator_id` INT UNSIGNED NOT NULL,
  `evaluation_period` VARCHAR(30) NOT NULL COMMENT 'e.g. 2026-Month-09 or Mid-Term',
  `technical_skills` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `task_completion` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `problem_solving` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `communication` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `teamwork` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `professionalism` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `learning_progress` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `attendance_rating` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1 to 5',
  `overall_score` DECIMAL(5, 2) NOT NULL COMMENT 'Calculated percentage 0-100',
  `summary_feedback` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_eval_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_evaluator` FOREIGN KEY (`evaluator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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

-- 14. DOCUMENTS
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `intern_id` INT UNSIGNED NOT NULL,
  `uploaded_by` INT UNSIGNED NOT NULL,
  `category` ENUM('id_proof', 'cv', 'agreement', 'recommendation', 'project', 'other') NOT NULL DEFAULT 'other',
  `title` VARCHAR(150) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
  `mime_type` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_doc_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_doc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. CERTIFICATES
DROP TABLE IF EXISTS `certificates`;
CREATE TABLE `certificates` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `certificate_code` VARCHAR(80) NOT NULL UNIQUE,
  `intern_id` INT UNSIGNED NOT NULL,
  `track_id` INT UNSIGNED NOT NULL,
  `cohort_id` INT UNSIGNED NOT NULL,
  `issue_date` DATE NOT NULL,
  `signatory_name` VARCHAR(100) NOT NULL DEFAULT 'Executive Director',
  `signatory_title` VARCHAR(100) NOT NULL DEFAULT 'Lead Director, Jowis Studio',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cert_intern` FOREIGN KEY (`intern_id`) REFERENCES `intern_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cert_cohort` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. ANNOUNCEMENTS
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `author_id` INT UNSIGNED NOT NULL,
  `target_type` ENUM('all', 'track', 'cohort', 'mentors') NOT NULL DEFAULT 'all',
  `target_id` INT UNSIGNED NULL COMMENT 'Track ID or Cohort ID if applicable',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ann_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. NOTIFICATIONS
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('attendance', 'task', 'evaluation', 'announcement', 'system') NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `link` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_notif_user` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. SYSTEM SETTINGS
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'general',
  `description` VARCHAR(255) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. AUDIT LOGS
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT UNSIGNED NULL,
  `old_value` JSON NULL,
  `new_value` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
