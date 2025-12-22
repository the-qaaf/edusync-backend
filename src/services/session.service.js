
// Simple in-memory session store (Phone -> Selected Student ID)
const sessionStore = new Map();

/**
 * Get the currently selected student ID for a phone number.
 */
export const getSessionStudentId = (phone) => sessionStore.get(phone);

/**
 * Set the active student ID for a phone number.
 */
export const setSessionStudentId = (phone, studentId) => sessionStore.set(phone, studentId);

/**
 * Clear session
 */
export const clearSession = (phone) => sessionStore.delete(phone);
