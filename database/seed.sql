-- Jowis Studio Internship ERP Seed Data
USE `jowis_studio_erp`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. ROLES
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'super_admin', 'Full system access, system configuration, audit logs, and administration management'),
(2, 'admin', 'Operational management of interns, cohorts, tracks, attendance, tasks, and reports'),
(3, 'mentor', 'Instructor/Mentor managing assigned tracks, cohorts, intern evaluations, and task reviews'),
(4, 'intern', 'Student/Intern accessing personal dashboard, attendance, tasks, progress, and documents')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 2. SYSTEM SETTINGS
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `category`, `description`) VALUES
('organization_name', 'Jowis Studio', 'general', 'Organization / Company Name'),
('app_timezone', 'Africa/Lagos', 'attendance', 'Operational timezone for attendance and system timestamps'),
('attendance_cutoff_time', '09:00:00', 'attendance', 'Arrival cutoff time in Lagos timezone. >= 09:00 is marked LATE'),
('attendance_auto_close_time', '17:00:00', 'attendance', 'End of working hours cutoff for day attendance'),
('auto_close_attendance_enabled', '0', 'attendance', 'Enable automatic marking of unexcused absent after closing time (0=Disabled, 1=Enabled)'),
('working_days', '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}', 'attendance', 'Configured organizational working days of the week'),
('weight_attendance', '20', 'performance', 'Weight percentage for attendance in overall performance (20%)'),
('weight_tasks', '30', 'performance', 'Weight percentage for task completion/quality (30%)'),
('weight_assessments', '25', 'performance', 'Weight percentage for formal tests and assessments (25%)'),
('weight_professionalism', '15', 'performance', 'Weight percentage for teamwork, communication, and professionalism (15%)'),
('weight_mentor_evaluation', '10', 'performance', 'Weight percentage for mentor qualitative review (10%)'),
('alert_threshold_low_attendance', '75', 'alerts', 'Attendance percentage below which an administrative alert is triggered'),
('alert_threshold_late_frequency', '3', 'alerts', 'Number of late days in a month that triggers punctuality alert')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- 2B. COMPANY HOLIDAYS
INSERT INTO `company_holidays` (`holiday_date`, `name`, `description`, `is_active`) VALUES
('2026-05-01', 'Workers\' Day', 'National Public Holiday for Workers', 1),
('2026-06-12', 'Democracy Day', 'National Democracy Celebration Day', 1),
('2026-10-01', 'Independence Day', 'Nigeria National Independence Day', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. TRACKS
INSERT INTO `tracks` (`id`, `name`, `slug`, `description`, `duration_weeks`, `curriculum_summary`, `required_skills`, `is_active`) VALUES
(1, 'Full-Stack Software Development', 'software-development', 'Modern web and enterprise software development covering React, Node.js, Express, MySQL, REST APIs, and DevOps fundamentals.', 24, 'HTML5, CSS3, JavaScript ES6+, React.js, Node.js, Express, MySQL, Git, Docker, System Architecture', 'Basic programming logic, Computer literacy', 1),
(2, 'UI/UX & Product Design', 'ui-ux-design', 'End-to-end user experience and product design covering user research, wireframing, high-fidelity prototyping in Figma, design systems, and usability testing.', 16, 'Design Thinking, User Research, Wireframing, Figma, Design Systems, Usability Testing, Micro-interactions', 'Creativity, Attention to detail', 1),
(3, 'Cybersecurity & Ethical Hacking', 'cybersecurity', 'Core cybersecurity operations, network defense, vulnerability assessment, ethical penetration testing, and security compliance.', 24, 'Networking fundamentals, Linux command line, Kali Linux, Wireshark, Metasploit, Web Application Security (OWASP Top 10), Cryptography', 'Basic networking knowledge', 1),
(4, 'Data Analytics & Business Intelligence', 'data-analytics', 'Data extraction, cleaning, exploration, and visual storytelling using Python, SQL, Power BI, and statistical analysis.', 20, 'Excel Advanced, SQL, Python (Pandas/NumPy), Power BI, Tableau, Statistical Modeling', 'Analytical mindset, Basic mathematics', 1),
(5, 'Cloud & DevOps Engineering', 'devops-engineering', 'Cloud infrastructure management, CI/CD pipelines, container orchestration, and server administration.', 20, 'Linux Administration, Docker, Kubernetes, AWS Fundamentals, GitHub Actions, Nginx, Monitoring', 'Linux basics, Basic networking', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET FOREIGN_KEY_CHECKS = 1;
