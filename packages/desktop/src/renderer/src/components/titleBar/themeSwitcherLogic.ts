import { LIGHT_THEMES, DARK_THEMES } from 'common/themeCatalog'

export interface ThemeOption {
  id: string
  label: string
  group: 'light' | 'dark'
}

/**
 * Flat, ordered list of every built-in theme with its display label.
 * `labelOf` receives the i18n label key from the shared catalog.
 */
export function buildThemeOptions(labelOf: (labelKey: string) => string): ThemeOption[] {
  const toOptions = (group: 'light' | 'dark', entries: typeof LIGHT_THEMES): ThemeOption[] =>
    entries.map(([labelKey, id]) => ({ id, label: labelOf(labelKey), group }))
  return [...toOptions('light', LIGHT_THEMES), ...toOptions('dark', DARK_THEMES)]
}

/** Case-insensitive match on the label or the theme id; blank query keeps all. */
export function filterThemeOptions(options: ThemeOption[], query: string): ThemeOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter(
    (option) => option.label.toLowerCase().includes(q) || option.id.toLowerCase().includes(q)
  )
}

/**
 * Next index when stepping through `length` items, wrapping at both ends.
 * `current` may be -1 (nothing highlighted): stepping forward lands on the
 * first item and stepping back on the last.
 */
export function stepIndex(length: number, current: number, delta: number): number {
  if (length <= 0) return -1
  if (current < 0) return delta >= 0 ? 0 : length - 1
  return (((current + delta) % length) + length) % length
}
