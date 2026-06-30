/**
 * Normalizes a phone number to E.164 format.
 * Format: +[country_code][subscriber_number] up to 15 digits.
 * If number has 10 digits and no country code, defaults to +1 (US).
 * @param {string} phone - The raw phone number string.
 * @returns {string|null} The normalized phone number or null.
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Check if it already has a '+' prefix
  const hasPlus = phone.trim().startsWith('+');
  
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  // If 10 digits and no leading plus, default to +1 (US)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, prepend plus
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Fallback: prepend '+' to whatever digits we have
  return `+${digits}`;
}
