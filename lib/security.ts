import bcrypt from "bcryptjs";

/**
 * Validate a transaction PIN.
 *
 * PIN must be exactly 4 or 6 numeric digits.
 */
export function validPin(pin: string): boolean {
  return /^\d{4}(\d{2})?$/.test(String(pin ?? ""));
}

/**
 * Hash a sensitive value such as a transaction PIN.
 */
export async function hash(
  value: string
): Promise<string> {
  if (!value) {
    throw new Error("Value is required.");
  }

  return bcrypt.hash(value, 12);
}

/**
 * Verify a plain value against a stored hash.
 */
export async function verify(
  value: string,
  hashedValue: string
): Promise<boolean> {
  if (!value || !hashedValue) {
    return false;
  }

  try {
    return await bcrypt.compare(
      value,
      hashedValue
    );
  } catch {
    return false;
  }
}