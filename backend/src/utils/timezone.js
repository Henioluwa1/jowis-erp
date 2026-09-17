// Timezone and Attendance Rules Engine for Jowis Studio ERP
// Organization default timezone: Africa/Lagos (UTC+1)

export const TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Lagos';
export const DEFAULT_CUTOFF = process.env.ATTENDANCE_CUTOFF_TIME || '09:00:00';

/**
 * Get current date & time in Africa/Lagos
 * @returns {Date} Date object adjusted to Lagos local time
 */
export const getLagosDate = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const dateMap = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      dateMap[part.type] = part.value;
    }
  }

  // Ensure 24-hour hour value
  let hour = dateMap.hour;
  if (hour === '24') hour = '00';

  const isoString = `${dateMap.year}-${dateMap.month}-${dateMap.day}T${hour}:${dateMap.minute}:${dateMap.second}`;
  return {
    date: `${dateMap.year}-${dateMap.month}-${dateMap.day}`,
    time: `${hour}:${dateMap.minute}:${dateMap.second}`,
    fullIso: isoString,
    hours: parseInt(hour, 10),
    minutes: parseInt(dateMap.minute, 10),
    seconds: parseInt(dateMap.second, 10)
  };
};

export const getLagosNow = () => {
  const { date, time, fullIso, hours, minutes, seconds } = getLagosDate();
  return {
    lagosDate: date,
    lagosTime: time,
    fullIso,
    hours,
    minutes,
    seconds
  };
};

/**
 * Convert HH:MM:SS string to total seconds from start of day
 */
export const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m, s = 0] = timeStr.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/**
 * Determine attendance status and late minutes based on cutoff
 * Rule:
 *   Arrival before 09:00:00 AM -> PRESENT
 *   Arrival at or after 09:00:00 AM -> LATE
 * 
 * @param {string} checkInTime - 'HH:MM:SS'
 * @param {string} cutoffTime - 'HH:MM:SS' (default: '09:00:00')
 * @returns {{ status: 'PRESENT' | 'LATE', lateMinutes: number }}
 */
export const evaluateAttendance = (checkInTime, cutoffTime = DEFAULT_CUTOFF) => {
  const checkInSec = timeToSeconds(checkInTime);
  const cutoffSec = timeToSeconds(cutoffTime);

  if (checkInSec < cutoffSec) {
    return {
      status: 'PRESENT',
      lateMinutes: 0
    };
  } else {
    const diffSec = checkInSec - cutoffSec;
    // e.g. exactly 09:00:00 is LATE with 0 minutes late, 09:01:00 is 1 minute late
    const lateMinutes = Math.floor(diffSec / 60);
    return {
      status: 'LATE',
      lateMinutes: lateMinutes
    };
  }
};

/**
 * Check if a date is an official working day (not weekend or company holiday)
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Object} workingDaysConfig - e.g. { monday: true, ... }
 * @param {Set<string>|Array<string>} holidays - Set or Array of holiday 'YYYY-MM-DD' strings
 * @returns {boolean}
 */
export const isWorkingDay = (dateStr, workingDaysConfig = null, holidays = []) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()];

  const config = workingDaysConfig || {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  };

  if (!config[dayName]) return false;

  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays);
  if (holidaySet.has(dateStr)) return false;

  return true;
};

/**
 * Calculate expected attendance days between start and end date,
 * strictly excluding non-working days (weekends) and company holidays.
 * 
 * @param {string} startDateStr - 'YYYY-MM-DD'
 * @param {string} endDateStr - 'YYYY-MM-DD'
 * @param {Object} workingDaysConfig - e.g. { monday: true, ... }
 * @param {Set<string>|Array<string>} holidays - Set or Array of holiday 'YYYY-MM-DD' strings
 * @returns {{ expectedDays: number, workingDates: string[] }}
 */
export const calculateExpectedWorkingDays = (startDateStr, endDateStr, workingDaysConfig = null, holidays = []) => {
  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);

  const start = new Date(Date.UTC(sYear, sMonth - 1, sDay));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay));

  if (start > end) return { expectedDays: 0, workingDates: [] };

  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays);
  const workingDates = [];

  const current = new Date(start);
  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    if (isWorkingDay(dateStr, workingDaysConfig, holidaySet)) {
      workingDates.push(dateStr);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    expectedDays: workingDates.length,
    workingDates
  };
};
