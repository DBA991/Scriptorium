import { ipcMain, shell } from 'electron'

const DELTA2STUDIO_URL = 'https://delta2studio.pages.dev'

export function registerBrandLinkHandlers() {
  ipcMain.handle('brand:openDelta2Studio', async () => {
    try {
      await shell.openExternal(DELTA2STUDIO_URL)
      return { success: true }
    } catch (error) {
      console.error('Errore apertura Delta2Studio:', error)
      return { success: false, error: error.message }
    }
  })
}
