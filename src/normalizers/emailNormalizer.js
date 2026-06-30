/**
 * Normalizes an email address.
 * Converts to lowercase and removes leading/trailing whitespace.
 * @param {string} email - The raw email address.
 * @returns {string|null} The normalized email or null if invalid.
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  return email.trim().toLowerCase();
}
