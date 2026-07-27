import { clipboard, ipcMain, BrowserWindow } from 'electron'
import crypto from 'crypto'
import { store } from './electronStore'

const MAX_ENTRIES = 50
const POLL_INTERVAL_MS = 800

let lastSeenText = null
let pollTimer = null

function getHistory() {
  return store.get('clipboardHistory', [])
}

function broadcastHistory(history) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('clipboard:updated', history)
    }
  })
}

/**
 * Aggiunge una nuova voce in testa alla cronologia (FIFO, max 50 voci).
 * Se il testo è già la voce più recente, non duplica.
 */
function pushEntry(text) {
  if (!text || !text.trim()) return

  const history = getHistory()
  if (history[0]?.text === text) return

  const entry = { id: crypto.randomUUID(), text, timestamp: Date.now() }
  const updated = [entry, ...history].slice(0, MAX_ENTRIES)

  store.set('clipboardHistory', updated)
  broadcastHistory(updated)
}

/**
 * Avvia il polling della clipboard di sistema. Va chiamato una sola volta,
 * dopo app.whenReady().
 */
export function startClipboardWatcher() {
  if (pollTimer) return

  lastSeenText = clipboard.readText() || null

  pollTimer = setInterval(() => {
    try {
      const text = clipboard.readText()
      if (text && text !== lastSeenText) {
        lastSeenText = text
        pushEntry(text)
      }
    } catch (error) {
      console.error('Errore lettura clipboard:', error)
    }
  }, POLL_INTERVAL_MS)
}

export function stopClipboardWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function registerClipboardHandlers() {
  ipcMain.handle('clipboard:getHistory', () => getHistory())

  ipcMain.handle('clipboard:copyItem', (_event, text) => {
    clipboard.writeText(text)
    lastSeenText = text
    return true
  })

  ipcMain.handle('clipboard:removeItem', (_event, id) => {
    const updated = getHistory().filter((entry) => entry.id !== id)
    store.set('clipboardHistory', updated)
    broadcastHistory(updated)
    return updated
  })

  ipcMain.handle('clipboard:clearHistory', () => {
    store.set('clipboardHistory', [])
    broadcastHistory([])
    return []
  })
}
