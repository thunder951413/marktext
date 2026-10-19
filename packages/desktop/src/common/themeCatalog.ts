// The built-in themes, in the order the Theme menu and the quick theme switcher
// list them. Each entry is [i18nLabelKey, themeId]: the visible label is
// `menu.theme.<labelKey>`, and `themeId` is what is stored in the `theme`
// preference. (A few themes keep historical ids, e.g. cadmiumLight -> 'light'.)
export type ThemeCatalogEntry = readonly [labelKey: string, id: string]

export const LIGHT_THEMES: ReadonlyArray<ThemeCatalogEntry> = [
  ['ayuLight', 'ayu-light'],
  ['cadmiumLight', 'light'],
  ['catppuccinLatte', 'catppuccin-latte'],
  ['everforestLight', 'everforest-light'],
  ['graphiteLight', 'graphite'],
  ['gruvboxLight', 'gruvbox-light'],
  ['rosePineDawn', 'rose-pine-dawn'],
  ['solarizedLight', 'solarized-light'],
  ['tokyoNightLight', 'tokyo-night-light'],
  ['ulyssesLight', 'ulysses']
]

export const DARK_THEMES: ReadonlyArray<ThemeCatalogEntry> = [
  ['ayuDark', 'ayu-dark'],
  ['ayuMirage', 'ayu-mirage'],
  ['cadmiumDark', 'dark'],
  ['catppuccinMocha', 'catppuccin-mocha'],
  ['cyberdream', 'cyberdream'],
  ['dracula', 'dracula'],
  ['everforestDark', 'everforest-dark'],
  ['gruvboxDark', 'gruvbox-dark'],
  ['horizonDark', 'horizon-dark'],
  ['kanagawa', 'kanagawa'],
  ['materialDark', 'material-dark'],
  ['monokaiPro', 'monokai-pro'],
  ['nightfox', 'nightfox'],
  ['nord', 'nord'],
  ['oneDark', 'one-dark'],
  ['oxocarbonDark', 'oxocarbon-dark'],
  ['palenight', 'palenight'],
  ['rosePine', 'rose-pine'],
  ['rosePineMoon', 'rose-pine-moon'],
  ['solarizedDark', 'solarized-dark'],
  ['synthwave84', 'synthwave-84'],
  ['tokyoNight', 'tokyo-night'],
  ['tokyoNightStorm', 'tokyo-night-storm']
]

export const ALL_THEMES: ReadonlyArray<ThemeCatalogEntry> = [...LIGHT_THEMES, ...DARK_THEMES]
