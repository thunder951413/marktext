export const isVimModeEnabled = (): boolean => {
  if (typeof window === 'undefined' || !window.electron?.process?.env) return true
  const env = window.electron.process.env
  return env.PERF_TESTING !== 'true' || env.MARKTEXT_VIM_TESTING === 'true'
}
