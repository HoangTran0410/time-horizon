export const APP_FONT_FAMILIES = {
  sans: '"Manrope", "IBM Plex Sans", "Segoe UI", sans-serif',
  serif: '"Fraunces", "Iowan Old Style", "Palatino Linotype", serif',
  mono: '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
} as const;

const CANVAS_FONT_STACKS = {
  sans: APP_FONT_FAMILIES.sans,
  mono: APP_FONT_FAMILIES.mono,
  emoji: `${APP_FONT_FAMILIES.emoji}, sans-serif`,
} as const;

export const CANVAS_FONT_PRESETS = {
  tick: `10px ${CANVAS_FONT_STACKS.mono}`,
  tickHighlighted: `600 11px ${CANVAS_FONT_STACKS.mono}`,
  collapsedCounter: `600 12px ${CANVAS_FONT_STACKS.sans}`,
  collapsedEventEmoji: `18px ${CANVAS_FONT_STACKS.emoji}`,
  eventEmoji: `24px ${CANVAS_FONT_STACKS.emoji}`,
  eventTitle: `500 12px ${CANVAS_FONT_STACKS.sans}`,
  eventDate: `10px ${CANVAS_FONT_STACKS.mono}`,
  rulerLabel: `600 11px ${CANVAS_FONT_STACKS.mono}`,
  bigBang: `700 12px ${CANVAS_FONT_STACKS.sans}`,
} as const;
