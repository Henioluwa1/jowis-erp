import crypto from 'crypto';

const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding confusing chars I, O
const LOWERCASE_CHARS = 'abcdefghijkmnopqrstuvwxyz'; // Excluding confusing chars l
const DIGIT_CHARS = '23456789'; // Excluding confusing chars 0, 1
const SYMBOL_CHARS = '!@#$%&*+=-?';

const ALL_CHARS = UPPERCASE_CHARS + LOWERCASE_CHARS + DIGIT_CHARS + SYMBOL_CHARS;

/**
 * Generate a cryptographically secure random temporary password.
 * Format: 14 characters, guaranteed at least 2 uppercase, 2 lowercase, 2 digits, 2 symbols.
 * Unguessable and fully random.
 */
export function generateSecureTemporaryPassword(length = 14) {
  if (length < 10) length = 14;

  const passwordChars = [];

  // Guarantee at least 2 of each required character class
  for (let i = 0; i < 2; i++) {
    passwordChars.push(UPPERCASE_CHARS[crypto.randomInt(0, UPPERCASE_CHARS.length)]);
    passwordChars.push(LOWERCASE_CHARS[crypto.randomInt(0, LOWERCASE_CHARS.length)]);
    passwordChars.push(DIGIT_CHARS[crypto.randomInt(0, DIGIT_CHARS.length)]);
    passwordChars.push(SYMBOL_CHARS[crypto.randomInt(0, SYMBOL_CHARS.length)]);
  }

  // Fill the remaining length with random chars from all sets
  while (passwordChars.length < length) {
    passwordChars.push(ALL_CHARS[crypto.randomInt(0, ALL_CHARS.length)]);
  }

  // Cryptographic Fisher-Yates Shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = temp;
  }

  return passwordChars.join('');
}

/**
 * Validate password against enterprise complexity policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' };
  }

  if (!/[!@#$%^&*(),.?":{}|<>_+\-=\\[\]]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*...).' };
  }

  return { valid: true };
}
