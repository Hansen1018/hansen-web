/**
 * Deterministic hash → hue (0-359).
 * Used by ProjectsSection / SkillsSection to assign stable accent colors
 * from project titles / skill names without runtime RNG or extra deps.
 */
export function hashHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}
