import { ipcMain } from 'electron'
import { createOcrChildWindow, getOcrChildWindow } from './ocrHandler.js'

const autoState = {
  running: false,
  cancelled: false,
  pages: [],
  config: null,
  startIndex: 0,
  index: 0,
  doneResolve: null,
  readyResolve: null,
  viewerWebContents: null
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function gradeForPage(pageNumberOneBased, config) {
  const { pageFlip, grade, gradeEven } = config
  if (pageFlip) {
    return pageNumberOneBased % 2 === 1 ? grade : gradeEven
  }
  return grade
}

function waitForPageDone() {
  return new Promise((resolve) => {
    autoState.doneResolve = resolve
  })
}

function waitForReady() {
  return new Promise((resolve) => {
    autoState.readyResolve = resolve
  })
}

function resetState() {
  autoState.running = false
  autoState.cancelled = false
  autoState.pages = []
  autoState.config = null
  autoState.startIndex = 0
  autoState.index = 0
  autoState.doneResolve = null
  autoState.readyResolve = null
  autoState.viewerWebContents = null
}

function notifyViewer(channel, payload) {
  const wc = autoState.viewerWebContents
  if (wc && !wc.isDestroyed()) {
    wc.send(channel, payload)
  }
}

export function stopOcrAutomation() {
  if (!autoState.running) return
  autoState.cancelled = true
  if (autoState.doneResolve) {
    const resolve = autoState.doneResolve
    autoState.doneResolve = null
    resolve()
  }
  if (autoState.readyResolve) {
    const resolve = autoState.readyResolve
    autoState.readyResolve = null
    resolve()
  }
}

async function runAutomation() {
  const { pages, config } = autoState
  const total = pages.length

  while (autoState.index < total && !autoState.cancelled) {
    const currentIndex = autoState.index
    const pageNumber = autoState.startIndex + currentIndex + 1
    const page = pages[currentIndex]
    const grade = gradeForPage(pageNumber, config)

    const ocrWindow = getOcrChildWindow()
    if (!ocrWindow || ocrWindow.isDestroyed()) {
      break
    }

    ocrWindow.webContents.send('ocr-auto:page', {
      imageUrl: page.url,
      cssStyles: config.cssStyles,
      grade,
      pageNumber
    })

    notifyViewer('ocr-auto:progress', { currentIndex, total, pageNumber })

    await waitForPageDone()

    if (autoState.cancelled) break

    await delay(500)

    autoState.index++
  }

  notifyViewer('ocr-auto:finished')
  resetState()
}

export function registerOcrAutomationHandlers(mainWindow, childWindows) {
  ipcMain.on('ocr-auto:start', (event, config) => {
    if (autoState.running) return
    if (!config || !Array.isArray(config.pages) || config.pages.length === 0) return

    autoState.running = true
    autoState.cancelled = false
    autoState.pages = config.pages
    autoState.config = config
    autoState.startIndex = config.startIndex || 0
    autoState.index = 0
    autoState.doneResolve = null
    autoState.readyResolve = null
    autoState.viewerWebContents = event.sender

    const imageWindow = childWindows.get('image')
    if (!imageWindow) {
      notifyViewer('ocr-auto:finished')
      resetState()
      return
    }

    createOcrChildWindow(imageWindow, null)

    waitForReady()
      .then(() => runAutomation())
      .catch((err) => {
        console.error('[ocr-auto] errore iterazione:', err)
        notifyViewer('ocr-auto:finished')
        resetState()
      })
  })

  ipcMain.on('ocr-auto:stop', () => {
    stopOcrAutomation()
  })

  ipcMain.on('ocr-auto:page-done', () => {
    if (autoState.doneResolve) {
      const resolve = autoState.doneResolve
      autoState.doneResolve = null
      resolve()
    }
  })

  ipcMain.on('ocr-auto:ready', () => {
    if (autoState.readyResolve) {
      const resolve = autoState.readyResolve
      autoState.readyResolve = null
      resolve()
    }
  })
}
