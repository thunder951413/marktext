import { type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/theme'
import { t } from '../../i18n'
import type Preference from '../../preferences'
import { LIGHT_THEMES, DARK_THEMES, type ThemeCatalogEntry } from 'common/themeCatalog'

export default function(userPreference: Preference): MenuItemConstructorOptions {
  const preferences = userPreference.getAll() as { theme?: string; followSystemTheme?: boolean }
  const { theme, followSystemTheme } = preferences
  const isThemeSelectionEnabled = !followSystemTheme

  const themeRadio = ([labelKey, id]: ThemeCatalogEntry): MenuItemConstructorOptions => ({
    label: t(`menu.theme.${labelKey}`),
    type: 'radio',
    id,
    enabled: isThemeSelectionEnabled,
    checked: theme === id,
    click() {
      actions.selectTheme(id)
    }
  })

  const submenu: MenuItemConstructorOptions[] = [
    // Follow System Theme
    {
      label: t('preferences.theme.followSystemTheme'),
      type: 'checkbox',
      id: 'follow-system-theme',
      checked: !!followSystemTheme,
      click(menuItem) {
        actions.setFollowSystemTheme(menuItem.checked)
      }
    }
  ]

  if (!isThemeSelectionEnabled) {
    submenu.push({
      label: t('menu.theme.followThemDisabled'),
      enabled: false
    })
  }

  // Group themes into nested submenus so the top-level Theme menu stays short
  // instead of expanding to the full window height with 30+ flat items (#4534).
  submenu.push(
    { type: 'separator' },
    {
      label: t('menu.theme.lightThemes'),
      submenu: LIGHT_THEMES.map(themeRadio)
    },
    {
      label: t('menu.theme.darkThemes'),
      submenu: DARK_THEMES.map(themeRadio)
    }
  )

  return {
    label: t('menu.theme.theme'),
    id: 'themeMenu',
    submenu
  }
}
