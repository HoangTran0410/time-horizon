/** Colour helpers for canvas drawing. */

const computeWithAlpha = (color: string, alpha: number): string => {
  const normalized = color.trim();
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  if (/^#([0-9a-f]{3}){1,2}$/i.test(normalized)) {
    const hex = normalized.slice(1);
    const fullHex =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    const int = Number.parseInt(fullHex, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  return normalized;
};

/**
 * The canvas asks for the same few (colour, alpha) pairs on every frame for
 * every event, and parsing the hex each time showed up in profiles. Bounded:
 * inputs are theme and collection colours with a handful of alphas, and the
 * map is simply reset if anything ever feeds it unbounded values.
 */
const WITH_ALPHA_CACHE = new Map<string, string>();
const WITH_ALPHA_CACHE_LIMIT = 1024;

export const withAlpha = (color: string, alpha: number): string => {
  const cacheKey = `${color}|${alpha}`;
  const cached = WITH_ALPHA_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = computeWithAlpha(color, alpha);
  if (WITH_ALPHA_CACHE.size >= WITH_ALPHA_CACHE_LIMIT) WITH_ALPHA_CACHE.clear();
  WITH_ALPHA_CACHE.set(cacheKey, result);
  return result;
};
