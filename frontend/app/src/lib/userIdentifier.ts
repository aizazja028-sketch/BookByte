const USER_ID_KEY = 'bookbyte_user_id';

/**
 * Gets the current user ID from localStorage, or generates a new one if it doesn't exist
 */
export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
    console.log('Generated new user ID:', userId);
  }
  
  return userId;
};

/**
 * Exports the current user ID for backup purposes
 */
export const exportUserId = (): string => {
  return getUserId();
};

/**
 * Validates and imports a user ID
 * @param userId - The UUID string to import
 * @throws Error if the UUID format is invalid
 */
export const importUserId = (userId: string): void => {
  // Validate UUID format (supports both v4 and other UUID versions)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID must be a non-empty string');
  }
  
  const trimmedUserId = userId.trim();
  
  if (!uuidRegex.test(trimmedUserId)) {
    throw new Error('Invalid UUID format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  }
  
  localStorage.setItem(USER_ID_KEY, trimmedUserId);
  console.log('Imported user ID:', trimmedUserId);
};

/**
 * Checks if a user ID exists in localStorage
 */
export const hasUserId = (): boolean => {
  return localStorage.getItem(USER_ID_KEY) !== null;
};

/**
 * Clears the current user ID (use with caution)
 */
export const clearUserId = (): void => {
  localStorage.removeItem(USER_ID_KEY);
  console.log('User ID cleared');
};

/**
 * Validates if a string is a valid UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};
