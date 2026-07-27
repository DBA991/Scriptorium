import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerFileManagerHandlers } from './filemanager'
import { is } from '@electron-toolkit/utils'
import { saveWindowBounds, restoreWindowBounds, registerStoreHandlers } from './electronStore'
import { registerOcrHandlers } from './ocrHandler'
import { registerOcrAutomationHandlers } from './ocrAutomationHandler'
import { registerTeiHandlers } from './teiHandlers'
import { registerBrandLinkHandlers } from './brandLinkHandler'
import {
  registerClipboardHandlers,
  startClipboardWatcher,
  stopClipboardWatcher
} from './clipboardHandler'
import './handleSpellchecker'

import iconICO from '../../resources/icon.ico?asset'
import iconPNG from '../../resources/icon.png?asset'
import iconICNS from '../../resources/icon.icns?asset'

let mainWindow = null
const childWindows = new Map()
let iconPath
if (process.platform === 'win32') {
  iconPath = iconICO
} else if (process.platform === 'darwin') {
  iconPath = iconICNS
} else {
  iconPath = iconPNG
}

function createMainWindow() {
  const bounds = restoreWindowBounds('main')

  mainWindow = new BrowserWindow({
    ...bounds,
    title: 'Petrarca project: Scriptorium',
    showInTaskbar: true,
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
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', () => {
    ipcMain.emit('close-ocr-window')
    saveWindowBounds(mainWindow, 'main')
    for (const [id, win] of childWindows.entries()) {
      if (!win.isDestroyed()) {
        win.removeAllListeners('closed')
        win.close()
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    childWindows.clear()
  })
}

function createChildWindow(id) {
  const bounds = restoreWindowBounds(id)
  const idTransmuter = {
    viewer: 'Librarius',
    coder: 'Scriptor',
    image: 'Copista',
    assembler: 'Compilator',
    vocabulary: 'Glossographus',
    speculum: 'Speculum'
  }

  const child = new BrowserWindow({
    ...bounds,
    title: `Scriptorum - ${idTransmuter[id] || id.charAt(0).toUpperCase() + id.slice(1)}`,
    showInTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    },
    icon: iconPath
  })

  child.webContents.on('did-finish-load', () => {
    child.webContents.send('store:reinitialize', null)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    child.loadURL(process.env['ELECTRON_RENDERER_URL'] + `#/${id}`)
    child.webContents.openDevTools()
  } else {
    child.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: `/${id}`
    })
  }

  child.on('close', () => {
    saveWindowBounds(child, id)
  })

  child.on('closed', () => {
    childWindows.delete(id)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-closed', id)
    }
  })

  return child
}

app.whenReady().then(() => {
  createMainWindow()

  registerStoreHandlers()
  registerFileManagerHandlers()
  registerOcrHandlers(mainWindow, childWindows)
  registerOcrAutomationHandlers(mainWindow, childWindows)
  registerTeiHandlers(childWindows)
  registerBrandLinkHandlers()
  registerClipboardHandlers()
  startClipboardWatcher()

  ipcMain.handle('get-window-type', (event) => {
    if (mainWindow && event.sender === mainWindow.webContents) return 'main'
    for (const [id, win] of childWindows.entries()) {
      if (win.webContents === event.sender) return id
    }
    return 'unknown'
  })

  ipcMain.handle('open-window', (_, id) => {
    if (!childWindows.has(id)) {
      const newWin = createChildWindow(id)
      childWindows.set(id, newWin)
    } else {
      const win = childWindows.get(id)
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  ipcMain.handle('close-window', (_, id) => {
    const win = childWindows.get(id)
    if (win) win.close()
  })
})

app.on('window-all-closed', () => {
  stopClipboardWatcher()
  if (process.platform !== 'darwin') app.quit()
})
