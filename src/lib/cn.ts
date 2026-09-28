/**
 * Join class names, skipping falsy values.
 *
 * This does NOT resolve conflicts (unlike tailwind-merge). Never pass two
 * classes that set the same property; pick one in the component instead.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
