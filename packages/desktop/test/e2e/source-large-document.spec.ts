import { expect, test } from '@playwright/test'
import { enterSourceMode, launchWithMarkdown } from './helpers'

test('source mode virtualizes a 10,000-line document', async() => {
  const markdown = Array.from({ length: 10_000 }, (_, index) => `line ${index}`).join('\n')
  const { app, page } = await launchWithMarkdown(markdown)

  const startedAt = Date.now()
  await enterSourceMode(page, app)
  const elapsed = Date.now() - startedAt
  const state = await page.evaluate(() => {
    const root = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { lineCount(): number } })
      | null
    return {
      lineCount: root?.CodeMirror?.lineCount() ?? 0,
      renderedLines: root?.querySelectorAll('.cm-line').length ?? 0
    }
  })

  expect(state.lineCount).toBe(10_000)
  expect(state.renderedLines).toBeLessThan(500)
  expect(elapsed).toBeLessThan(5_000)
  await app.close()
})
