/**
 * @file utils/coercion.ts
 * @description Utility functions for automatic and explicit type coercion.
 * Converts raw string values (URL params, query strings) into primitive types
 * (number, boolean, string) or through a custom transform function.
 */

/**
 * Function type representing an explicit value transformer.
 */
export type ValueTransform<T> = (value: string) => T;

/**
 * Intelligently coerces a raw string value into a target type T.
 *
 * Automatic conversion rules when no explicit transformer is provided:
 * - "true"  -> true (boolean)
 * - "false" -> false (boolean)
 * - Valid numeric representation (e.g. "42", "3.14") -> number
 * - Any other string -> untouched original string
 *
 * @template T Expected return type.
 * @param value Raw string input or undefined.
 * @param transform Optional explicit conversion function (e.g. Number, Boolean, BigInt).
 * @returns Coerced value as type T, or undefined if input is undefined.
 */
export function coerceValue<T = unknown>(
  value: string | undefined,
  transform?: ValueTransform<T>
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  // 1. If an explicit transform function is provided, prioritize it
  if (typeof transform === "function") {
    return transform(value);
  }

  const trimmed = value.trim();

  // 2. Automatic boolean coercion
  if (trimmed.toLowerCase() === "true") {
    return true as unknown as T;
  }
  if (trimmed.toLowerCase() === "false") {
    return false as unknown as T;
  }

  // 3. Automatic number coercion
  // Verify that the string is non-empty and represents a valid numeric value
  if (trimmed !== "" && !isNaN(Number(trimmed))) {
    return Number(trimmed) as unknown as T;
  }

  // 4. Default: return original string value
  return value as unknown as T;
}

/**
 * Converts a key-value record of parameters (URL params or Query params)
 * into an object with automatic type coercion applied to every value.
 *
 * @param record Object containing string or array values.
 * @returns New object with compatible primitive types coerced.
 */
export function coerceRecord<T extends Record<string, unknown>>(
  record: Record<string, string | string[] | undefined>
): T {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(record)) {
    if (Array.isArray(val)) {
      result[key] = val.map((item) => coerceValue(item));
    } else {
      result[key] = coerceValue(val);
    }
  }

  return result as T;
}
