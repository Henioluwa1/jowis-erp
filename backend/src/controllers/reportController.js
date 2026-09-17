import { query } from '../config/db.js';

/**
 * Helper to convert array of objects to CSV string
 */
const toCSV = (rows, headers) => {
  if (!rows || rows.length === 0) return '';
  const headerLine = headers.map(h => `"${h.label}"`).join(',');
  const bodyLines = rows.map(row => {
    return headers.map(h => {
      let val = row[h.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [headerLine, ...bodyLines].join('\r\n');
};

export const exportAttendanceCSV = async (req, res) => {
  try {
    const { startDate, endDate, cohortId, trackId } = req.query;
    let conditions = [];
    let params = [];

    if (startDate) { conditions.push('a.attendance_date >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('a.attendance_date <= ?'); params.push(endDate); }
    if (cohortId) { conditions.push('ip.cohort_id = ?'); params.push(cohortId); }
    if (trackId) { conditions.push('ip.track_id = ?'); params.push(trackId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const records = await query(`
      SELECT a.attendance_date, a.check_in_time, a.status, a.late_minutes, a.notes,
             ip.intern_code, u.first_name, u.last_name, u.email,
             t.name as track_name, c.name as cohort_name
      FROM attendance a
      JOIN intern_profiles ip ON a.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      ${where}
      ORDER BY a.attendance_date DESC, u.last_name ASC
    `, params);

    const headers = [
      { key: 'attendance_date', label: 'Date' },
      { key: 'intern_code', label: 'Intern ID' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'track_name', label: 'Track' },
      { key: 'cohort_name', label: 'Cohort' },
      { key: 'check_in_time', label: 'Check-In Time' },
      { key: 'status', label: 'Status' },
      { key: 'late_minutes', label: 'Late Minutes' },
      { key: 'notes', label: 'Notes' }
    ];

    const csv = toCSV(records, headers);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('exportAttendanceCSV error:', error);
    res.status(500).json({ success: false, message: 'Failed to export attendance CSV.' });
  }
};

export const exportInternsCSV = async (req, res) => {
  try {
    const records = await query(`
      SELECT ip.intern_code, u.first_name, u.last_name, u.email, ip.phone,
             ip.status, t.name as track_name, c.name as cohort_name,
             ip.start_date, ip.expected_end_date
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      ORDER BY ip.id ASC
    `);

    const headers = [
      { key: 'intern_code', label: 'Intern Code' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'track_name', label: 'Track' },
      { key: 'cohort_name', label: 'Cohort' },
      { key: 'status', label: 'Status' },
      { key: 'start_date', label: 'Start Date' },
      { key: 'expected_end_date', label: 'Expected End Date' }
    ];

    const csv = toCSV(records, headers);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="interns_list_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('exportInternsCSV error:', error);
    res.status(500).json({ success: false, message: 'Failed to export interns CSV.' });
  }
};
