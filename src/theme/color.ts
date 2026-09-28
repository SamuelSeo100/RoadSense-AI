/** `#rrggbb` + alpha (0–1) → `rgba(…)`. Mirrors Tailwind's `/60` opacity modifier. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
