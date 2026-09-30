import { expect, test } from '@playwright/test'
import * as path from 'node:path'
import { clickMenuById, launchElectron, launchWithMarkdown, waitForMenuReady } from './helpers'

const preferences = { restoreLayoutState: true, sideBarVisibility: true, startUpAction: 'blank' }

test('opening a file starts with the sidebar hidden despite a saved visible sidebar', async() => {
  const { app, page } = await launchWithMarkdown('# File launch\n', { preferences })
  try {
    await expect(page.locator('.side-bar')).toBeHidden()
    await expect.poll(() => app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()?.getMenuItemById('sideBarMenuItem')?.checked
    )).toBe(false)

    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator('.side-bar')).toBeVisible()
    await expect(page.locator('.side-bar .opened-files')).toContainText('note.md')
  } finally {
    await app.close()
  }
})

test('opening a folder still shows the sidebar', async() => {
  const folder = path.resolve(__dirname, 'data')
  const { app, page } = await launchElectron([folder], { preferences })
  try {
    await waitForMenuReady(app)
    await expect(page.locator('.side-bar')).toBeVisible()
    await expect(page.locator('.side-bar')).toContainText('data')
  } finally {
    await app.close()
  }
})

test('a blank launch still restores sidebar visibility', async() => {
  const { app, page } = await launchElectron([], { preferences })
  try {
    await waitForMenuReady(app)
    await expect(page.locator('.side-bar')).toBeVisible()
  } finally {
    await app.close()
  }
})
