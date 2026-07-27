import { app, ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { stopOcrAutomation } from './ocrAutomationHandler.js'
import iconICO from '../../resources/icon.ico?asset'
import iconPNG from '../../resources/icon.png?asset'
import iconICNS from '../../resources/icon.icns?asset'

export let ocrChildWindow = null

let iconPath
if (process.platform === 'win32') {
  iconPath = iconICO
} else if (process.platform === 'darwin') {
  iconPath = iconICNS
} else {
  iconPath = iconPNG
}

export function getOcrChildWindow() {
  return ocrChildWindow
}

export function createOcrChildWindow(parent, imageDataUrl = null) {
  if (ocrChildWindow && !ocrChildWindow.isDestroyed()) {
    if (ocrChildWindow.isMinimized()) ocrChildWindow.restore()
    ocrChildWindow.focus()
    if (imageDataUrl) {
      ocrChildWindow.webContents.send('ocr-image-data', imageDataUrl)
    }
    return ocrChildWindow
  }

  ocrChildWindow = new BrowserWindow({
    width: 600,
    height: 800,
    title: `Scriptorium - OCR`,
    parent,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    },
    icon: iconPath
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    ocrChildWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + `#/ocr`)
    ocrChildWindow.webContents.openDevTools()
  } else {
    ocrChildWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: `/ocr`
    })
  }

  ocrChildWindow.webContents.on('did-finish-load', () => {
    if (imageDataUrl) {
      ocrChildWindow.webContents.send('ocr-image-data', imageDataUrl)
    }
  })

  ocrChildWindow.on('closed', () => {
    ocrChildWindow = null
    stopOcrAutomation()
  })

  return ocrChildWindow
}

export function closeOcrWindow() {
  if (ocrChildWindow && !ocrChildWindow.isDestroyed()) {
    ocrChildWindow.close()
    ocrChildWindow = null
  }
}

export function registerOcrHandlers(mainWindow, childWindows) {
  ipcMain.on('open-ocr-window', (event, imageData) => {
    const imageWindow = childWindows.get('image')
    if (imageWindow) {
      createOcrChildWindow(imageWindow, imageData)
    }
  })

  ipcMain.on('send-text-to-editor', (event, text) => {
    const coderWindow = childWindows.get('coder')
    if (coderWindow) {
      coderWindow.webContents.send('receive-text-from-ocr', text)
    }
  })

  ipcMain.on('close-ocr-window', () => {
    closeOcrWindow()
  })
}
