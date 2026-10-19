import { describe, it, expect } from 'vitest'
import { ALL_THEMES, DARK_THEMES, LIGHT_THEMES } from 'common/themeCatalog'
import { isDarkThemeId } from 'common/theme'
import {
  buildThemeOptions,
  filterThemeOptions,
  stepIndex
} from '../../../src/renderer/src/components/titleBar/themeSwitcherLogic'
import en from '../../../static/locales/en.json'
import zhCN from '../../../static/locales/zh-CN.json'
import { themes as preferenceThemes } from '../../../src/renderer/src/prefComponents/theme/config'

const labelOf = (key: string): string => key

describe('theme catalog', () => {
  it('lists the same themes as the preferences page', () => {
    const catalogIds = ALL_THEMES.map(([, id]) => id).sort()
    expect(catalogIds).toEqual(preferenceThemes.map((theme) => theme.name).sort())
  })

  it('has unique ids and a menu label for each entry', () => {
    const ids = ALL_THEMES.map(([, id]) => id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const [labelKey] of ALL_THEMES) {
      expect((en.menu.theme as Record<string, string>)[labelKey]).toBeTruthy()
    }
  })

  it('groups light and dark themes consistently with the dark-theme classifier', () => {
    for (const [, id] of DARK_THEMES) expect(isDarkThemeId(id)).toBe(true)
    for (const [, id] of LIGHT_THEMES) expect(isDarkThemeId(id)).toBe(false)
  })
})

describe('theme switcher options', () => {
  const options = buildThemeOptions(labelOf)

  it('lists light themes before dark themes, keeping catalog order', () => {
    expect(options.map((option) => option.id)).toEqual(ALL_THEMES.map(([, id]) => id))
    const firstDark = options.findIndex((option) => option.group === 'dark')
    expect(options.slice(0, firstDark).every((option) => option.group === 'light')).toBe(true)
    expect(options.slice(firstDark).every((option) => option.group === 'dark')).toBe(true)
  })

  it('filters by label or id, ignoring case and surrounding spaces', () => {
    const named = buildThemeOptions((key) => (key === 'dracula' ? 'Dracula' : key))
    expect(filterThemeOptions(named, '  DRAC ').map((o) => o.id)).toEqual(['dracula'])
    expect(filterThemeOptions(named, 'tokyo-night').map((o) => o.id)).toEqual([
      'tokyo-night-light',
      'tokyo-night',
      'tokyo-night-storm'
    ])
    expect(filterThemeOptions(named, 'zzz')).toEqual([])
  })

  it('returns everything for a blank query', () => {
    expect(filterThemeOptions(options, '   ')).toBe(options)
  })
})

describe('stepIndex', () => {
  it('moves and wraps in both directions', () => {
    expect(stepIndex(5, 0, 1)).toBe(1)
    expect(stepIndex(5, 4, 1)).toBe(0)
    expect(stepIndex(5, 0, -1)).toBe(4)
  })

  it('starts at the ends when nothing is highlighted', () => {
    expect(stepIndex(5, -1, 1)).toBe(0)
    expect(stepIndex(5, -1, -1)).toBe(4)
  })

  it('returns -1 for an empty list', () => {
    expect(stepIndex(0, -1, 1)).toBe(-1)
    expect(stepIndex(0, 0, -1)).toBe(-1)
  })
})

describe('theme switcher strings', () => {
  const keys = ['title', 'filter', 'followNotice', 'noMatch', 'hint'] as const
  it('are provided for English and Simplified Chinese', () => {
    for (const locale of [en, zhCN]) {
      for (const key of keys) {
        expect(locale.titleBar.themeSwitcher[key]).toBeTruthy()
      }
    }
  })
})
