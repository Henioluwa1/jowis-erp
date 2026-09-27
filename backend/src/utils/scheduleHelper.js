/**
 * Authoritative Intern Attendance Schedule Helper (Jowis Studio ERP)
 * 
 * Rules:
 * 1. Interns work exactly 3 days per week (Monday -> Friday).
 * 2. Monday is strictly COMPULSORY for all interns.
 * 3. The intern chooses exactly 2 additional days from {Tuesday, Wednesday, Thursday, Friday}.
 * 4. Total schedule is exactly 3 days.
 * 5. Once selected, the schedule is LOCKED and cannot be modified.
 * 6. Non-scheduled days are NOT counted as absences.
 */

export const COMPULSORY_DAY = 'monday';
export const VALID_OPTIONAL_DAYS = ['tuesday', 'wednesday', 'thursday', 'friday'];
export const ALL_VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/**
 * Validate proposed schedule selection.
 * @param {Array<string>} days - e.g. ['monday', 'tuesday', 'thursday']
 * @returns {Array<string>} normalized canonical array of 3 lowercase weekday names
 * @throws {Error} if validation fails
 */
export function validateSchedule(days) {
  if (!Array.isArray(days)) {
    throw new Error('Schedule days must be provided as an array of day names.');
  }

  const normalized = days.map(d => String(d || '').toLowerCase().trim());
  const uniqueSet = new Set(normalized);

  if (uniqueSet.size !== 3) {
    throw new Error('An intern attendance schedule must contain exactly 3 unique working days.');
  }

  if (!uniqueSet.has(COMPULSORY_DAY)) {
    throw new Error('Monday is compulsory for all interns and must be included in your schedule.');
  }

  for (const day of uniqueSet) {
    if (!ALL_VALID_DAYS.includes(day)) {
      throw new Error(`Invalid attendance day '${day}'. Interns can only attend on weekdays (Monday through Friday).`);
    }
  }

  // Ensure exactly 2 optional days were chosen
  const optionalCount = Array.from(uniqueSet).filter(d => VALID_OPTIONAL_DAYS.includes(d)).length;
  if (optionalCount !== 2) {
    throw new Error('You must select exactly two additional days in addition to compulsory Monday.');
  }

  // Return in canonical weekday order
  return ALL_VALID_DAYS.filter(d => uniqueSet.has(d));
}

/**
 * Parse schedule_days from DB (handles JSON string, array, or null)
 * @param {any} raw
 * @returns {Array<string>|null}
 */
export function parseScheduleDays(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(d => String(d).toLowerCase().trim());
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.map(d => String(d).toLowerCase().trim());
  } catch {
    // fallback comma-separated
    if (typeof raw === 'string') {
      return raw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    }
  }
  return null;
}

/**
 * Convert intern schedule_days into workingDaysConfig for timezone.calculateExpectedWorkingDays
 * @param {Array<string>|null} scheduleDays
 * @returns {Object} { monday: boolean, ... }
 */
export function getWorkingDaysConfig(scheduleDays) {
  const days = parseScheduleDays(scheduleDays) || ['monday', 'wednesday', 'friday'];
  const daySet = new Set(days);

  return {
    monday: daySet.has('monday'),
    tuesday: daySet.has('tuesday'),
    wednesday: daySet.has('wednesday'),
    thursday: daySet.has('thursday'),
    friday: daySet.has('friday'),
    saturday: false,
    sunday: false
  };
}

/**
 * Check if a specific YYYY-MM-DD date is a scheduled working day for an intern
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Array<string>|null} scheduleDays - e.g. ['monday', 'tuesday', 'thursday']
 * @returns {boolean}
 */
export function isScheduledDay(dateStr, scheduleDays) {
  const days = parseScheduleDays(scheduleDays) || ['monday', 'wednesday', 'friday'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateObj.getUTCDay()];
  return days.includes(dayName);
}

/**
 * Calculate affected scheduled working days between two dates for an intern,
 * strictly counting ONLY days where the intern was expected to attend work
 * and excluding non-working company holidays.
 * 
 * @param {string} startDateStr - 'YYYY-MM-DD'
 * @param {string} endDateStr - 'YYYY-MM-DD'
 * @param {Array<string>|null} scheduleDays - e.g. ['monday', 'tuesday', 'thursday']
 * @param {Set<string>|Array<string>} holidays - Holiday dates 'YYYY-MM-DD'
 * @returns {{ count: number, dates: Array<string> }}
 */
export function calculateAffectedScheduledDays(startDateStr, endDateStr, scheduleDays, holidays = []) {
  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);

  const start = new Date(Date.UTC(sYear, sMonth - 1, sDay));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay));

  if (start > end) return { count: 0, dates: [] };

  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays);
  const days = parseScheduleDays(scheduleDays) || ['monday', 'wednesday', 'friday'];
  const daySet = new Set(days);

  const affectedDates = [];
  const current = new Date(start);

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][current.getUTCDay()];

    // Must be in intern schedule and not a holiday
    if (daySet.has(weekday) && !holidaySet.has(dateStr)) {
      affectedDates.push(dateStr);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    count: affectedDates.length,
    dates: affectedDates
  };
}
