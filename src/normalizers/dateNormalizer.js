const MONTHS_MAP = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12'
};

/**
 * Normalizes dates to YYYY-MM format or 'Present'.
 * Supports various formats: "June 2021", "06/2021", "2021-06-15", "Present", etc.
 * @param {string} dateStr - The date string to normalize.
 * @returns {string|null} The normalized date string in YYYY-MM, 'Present', or null.
 */
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const clean = dateStr.trim().toLowerCase();

  // Handle ongoing dates
  if (['present', 'current', 'now', 'ongoing', 'till date', 'active'].includes(clean)) {
    return 'Present';
  }

  // Check for YYYY-MM or YYYY-MM-DD
  const yyyyMmDdRegex = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/;
  let match = clean.match(yyyyMmDdRegex);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  // Check for MM/YYYY or M/YYYY
  const mmYyyyRegex = /^(\d{1,2})[-/](\d{4})$/;
  match = clean.match(mmYyyyRegex);
  if (match) {
    const month = match[1].padStart(2, '0');
    const year = match[2];
    return `${year}-${month}`;
  }

  // Check for TextMonth YYYY (e.g. "June 2021", "Jun 2021")
  const textMonthRegex = /^([a-z]+)\s+(\d{4})$/;
  match = clean.match(textMonthRegex);
  if (match) {
    const monthName = match[1];
    const year = match[2];
    const monthCode = MONTHS_MAP[monthName];
    if (monthCode) {
      return `${year}-${monthCode}`;
    }
  }

  // Check for YYYY TextMonth (e.g. "2021 June", "2021 Jun")
  const textMonthReverseRegex = /^(\d{4})\s+([a-z]+)$/;
  match = clean.match(textMonthReverseRegex);
  if (match) {
    const year = match[1];
    const monthName = match[2];
    const monthCode = MONTHS_MAP[monthName];
    if (monthCode) {
      return `${year}-${monthCode}`;
    }
  }

  // Check for just YYYY
  const yyyyRegex = /^(\d{4})$/;
  match = clean.match(yyyyRegex);
  if (match) {
    return `${match[1]}-01`; // Default to January
  }

  // Native Date parsing fallback
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
}
