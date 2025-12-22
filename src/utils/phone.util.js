
/**
 * Normalizes a phone number to digits only.
 * @param {string} phone
 * @returns {string}
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

/**
 * Generates variations of a phone number (with/without country code)
 * to handle inconsistent database formats.
 * e.g. Input "919876543210" -> ["919876543210", "9876543210"]
 * e.g. Input "9876543210" -> ["9876543210"] (Can't assume country code without locale)
 * @param {string} phone
 * @returns {string[]}
 */
export const getPhoneVariations = (phone) => {
  const norm = normalizePhoneNumber(phone);
  const variations = new Set([norm]);

  // If number starts with 91 (India) and is long enough, add version without 91
  if (norm.startsWith('91') && norm.length > 10) {
    variations.add(norm.slice(2));
  }

  // Also add version WITH 91 if it looks like a 10 digit customized number,
  // though usually webhooks send the full format.
  // Ideally, user DB should be normalized, but this helps read messy data.
  if (norm.length === 10) {
    variations.add(`91${norm}`);
  }

  return Array.from(variations);
};
