/** Tiny className combiner — filters falsy values and joins with spaces. */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

export default cn;
