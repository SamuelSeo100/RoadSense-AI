export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * Rough strength score for the sign-up meter (not a security guarantee).
 * One point each: 8+ chars, 12+ chars, upper + lower case, a digit, a symbol.
 */
export function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null;
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (score >= 4) return 'strong';
  if (score === 3) return 'medium';
  return 'weak';
}
