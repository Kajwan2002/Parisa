// The pastel colours a category can be tinted with. Kept deliberately
// soft so the whole app stays "cute", never loud.
export const CATEGORY_COLORS = [
  '#f7a8c4', // rose
  '#f6b7d4', // pink
  '#f4978e', // coral
  '#ffc5a1', // peach
  '#ffe0a3', // butter
  '#c8e6a8', // matcha
  '#a7e0cf', // mint
  '#a9d8ef', // sky
  '#b9c8f2', // periwinkle
  '#c7b4e6', // lavender
  '#e0b3d8', // orchid
  '#d9c3b0', // latte
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export function isCategoryColor(v: string): v is CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(v)
}

// A friendly emoji picker palette (grouped-ish, no need for a full keyboard).
export const CATEGORY_EMOJIS = [
  '🛒', '🍜', '🍰', '☕', '🍓', '🥑', '🍷', '🍕',
  '🚌', '🚗', '⛽', '🚕', '✈️', '🏨', '🎟️', '🗺️',
  '🛍️', '👗', '👟', '💄', '💅', '💇‍♀️', '🧴', '🕯️',
  '🏠', '🛋️', '💡', '🧺', '🪴', '🔧', '📶', '📺',
  '💊', '🩺', '🏥', '🦷', '🧘‍♀️', '🏋️‍♀️', '🐶', '🐱',
  '🎉', '🎁', '🎮', '📚', '🎬', '🎵', '💐', '💖',
  '💶', '💰', '🏦', '📈', '🧾', '🎓', '👶', '🌸',
] as const

export const DEFAULT_EMOJI = '🌸'
