/**
 * WYSIWYG engine selection. CodeMirror (packages/wysiwyg) is the default;
 * Muya stays available as a fallback while it is being retired — see
 * docs/ENGINE_DECISION.md at the repository root.
 *
 * Precedence: the MARKTEXT_EDITOR_ENGINE environment variable (tests, one-off
 * launches) over the `editorEngine` preference over the default. The choice is
 * made once per process, so changing the preference needs a restart.
 */
export type EditorEngine = 'codemirror' | 'muya'

export const DEFAULT_EDITOR_ENGINE: EditorEngine = 'codemirror'

export const isEditorEngine = (value: unknown): value is EditorEngine =>
  value === 'codemirror' || value === 'muya'

export const resolveEditorEngine = (envValue?: unknown, preference?: unknown): EditorEngine => {
  if (isEditorEngine(envValue)) return envValue
  if (isEditorEngine(preference)) return preference
  return DEFAULT_EDITOR_ENGINE
}
