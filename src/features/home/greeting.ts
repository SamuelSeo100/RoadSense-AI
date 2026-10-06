/** "morning" / "afternoon" / "evening" for the top-bar greeting. */
export function timeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export const firstName = (name: string | undefined | null) =>
  name?.trim().split(/\s+/)[0] || 'there';
