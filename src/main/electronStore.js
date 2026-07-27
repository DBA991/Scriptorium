import { BrowserWindow, ipcMain, screen, dialog } from 'electron'
import Store from 'electron-store'
import { promises as fs } from 'fs'

export const defaults = {
  project: '',
  xmlContent: '',
  htmlContent: '',
  images: [],
  windowBounds: {
    main: { width: 1200, height: 800, x: undefined, y: undefined }
  },
  teiSettings: {
    lastXmlPath: '',
    lastJsonPath: '',
    autoSave: true,
    theme: 'dark'
  },
  xmlCorpora: [],
  currentVocabulary: null,
  teiTermsCache: {},
  extractionConfig: {
    selectedElements: ['persName', 'placeName', 'orgName']
  },
  vocabularyConfig: {
    caseSensitive: false,
    minLength: 3,
    excludeNumbers: true,
    excludePunctuation: true,
    sortBy: 'alphabetical'
  },
  recentProjects: [],
  clipboardHistory: []
}

function validateBounds(bounds) {
  const displayBounds = screen.getAllDisplays().map((d) => d.bounds)
  const isVisible = displayBounds.some(
    (d) =>
      bounds.x + bounds.width > d.x &&
      bounds.y + bounds.height > d.y &&
      bounds.x < d.x + d.width &&
      bounds.y < d.y + d.height
  )
  return isVisible ? bounds : { width: 800, height: 600, x: undefined, y: undefined }
}

export function saveWindowBounds(win, id = 'main') {
  if (!win) return
  store.set(`windowBounds.${id}`, win.getBounds())
}

export function restoreWindowBounds(id = 'main') {
  let bounds = store.get(`windowBounds.${id}`) || { width: 800, height: 600 }
  return validateBounds(bounds)
}

export const store = new Store({ name: 'app-store', defaults })

function reloadAllWindows(excludeSenderId = null) {
  const windows = BrowserWindow.getAllWindows()

  windows.forEach((win) => {
    if (excludeSenderId && win.webContents.id === excludeSenderId) return
    win.webContents.reload()
  })
}

function reloadWindowsByType(windowTypes = []) {
  const windows = BrowserWindow.getAllWindows()

  windows.forEach((win) => {
    const windowTitle = win.getTitle().toLowerCase()
    const shouldReload = windowTypes.some((type) => windowTitle.includes(type.toLowerCase()))
    if (shouldReload) {
      win.webContents.reload()
    }
  })
}

export function registerStoreHandlers() {
  ipcMain.handle('store:get', (event, key) => store.get(key))
  ipcMain.handle('store:getAll', () => store.store)

  ipcMain.handle('store:set', (event, { key, value }) => {
    const oldValue = store.get(key)
    if (oldValue === value) return

    store.set(key, value)

    BrowserWindow.getAllWindows().forEach((win) => {
      const wc = win.webContents
      if (wc.id === event.sender.id) return
      wc.send(`${key}:updated`, value)
      wc.send('store:updated', key, value)
    })
  })

  ipcMain.handle('store:setAll', (event, data) => {
    store.clear()
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        store.set(key, data[key])
      }
    }

    setTimeout(() => {
      reloadAllWindows(event.sender.id)
    }, 100)

    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.webContents.id === event.sender.id) return
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          try {
            win.webContents.send('store:updated', key, data[key])
          } catch {}
        }
      }
    })
  })

  ipcMain.handle('store:clear', (event, key) => {
    store.delete(key)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(`${key}:updated`, null)
      win.webContents.send('store:updated', key, null)
    })
  })

  ipcMain.handle('store:reinitialize', (event, key) => {
    const value = store.get(key)
    event.sender.send('store:reinitialized', key, value)
    return value
  })

  ipcMain.handle('store:saveSessionToFile', async (event, data) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Salva Sessione Progetto',
      buttonLabel: 'Salva',
      filters: [{ name: 'File di Sessione', extensions: ['json'] }]
    })

    if (canceled || !filePath) {
      return { success: false, error: 'Salvataggio annullato' }
    }

    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
      return { success: true, filePath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('store:loadSessionFromFile', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Carica Sessione Progetto',
      buttonLabel: 'Carica',
      properties: ['openFile'],
      filters: [{ name: 'File di Sessione', extensions: ['json'] }]
    })

    if (canceled || !filePaths || filePaths.length === 0) return null
    const filePath = filePaths[0]

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      store.clear()
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          store.set(key, data[key])
        }
      }

      setTimeout(() => {
        reloadAllWindows(event.sender.id)
      }, 200)

      return data
    } catch {
      dialog.showErrorBox('Errore di Caricamento', 'Impossibile caricare il file di sessione.')
      return null
    }
  })

  ipcMain.handle('store:reloadWindows', (event, options = {}) => {
    const { windowTypes = [], excludeCurrentWindow = true } = options

    if (windowTypes.length > 0) {
      reloadWindowsByType(windowTypes)
    } else {
      const excludeId = excludeCurrentWindow ? event.sender.id : null
      reloadAllWindows(excludeId)
    }
  })

  ipcMain.handle('store:resetWithReload', (event) => {
    store.clear()
    for (const key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        store.set(key, defaults[key])
      }
    }

    setTimeout(() => {
      reloadAllWindows(event.sender.id)
    }, 100)
  })
}

class TeiStoreManager {
  constructor(storeInstance) {
    this.store = storeInstance
  }

  getSettings() {
    return this.store.get('teiSettings', defaults.teiSettings)
  }

  updateSettings(settings) {
    const current = this.getSettings()
    this.store.set('teiSettings', { ...current, ...settings })
  }

  getXmlCorpora() {
    return this.store.get('xmlCorpora', [])
  }

  addXmlFiles(files) {
    const corpora = this.getXmlCorpora()
    const newFiles = files.map((file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified || Date.now()
    }))
    const paths = new Set(corpora.map((f) => f.path))
    const unique = newFiles.filter((f) => !paths.has(f.path))
    this.store.set('xmlCorpora', [...corpora, ...unique])
    return this.getXmlCorpora()
  }

  removeXmlFile(filePath) {
    const corpora = this.getXmlCorpora()
    this.store.set(
      'xmlCorpora',
      corpora.filter((f) => f.path !== filePath)
    )
  }

  clearXmlCorpora() {
    this.store.set('xmlCorpora', [])
  }

  getCurrentVocabulary() {
    return this.store.get('currentVocabulary', null)
  }

  setCurrentVocabulary(vocabularyInfo) {
    this.store.set('currentVocabulary', vocabularyInfo)
  }

  clearCurrentVocabulary() {
    this.store.set('currentVocabulary', null)
  }

  getTeiTermsCache(fileHash) {
    const cache = this.store.get('teiTermsCache', {})
    return cache[fileHash] || null
  }

  setTeiTermsCache(fileHash, terms) {
    const cache = this.store.get('teiTermsCache', {})
    cache[fileHash] = { terms, timestamp: Date.now() }
    this.store.set('teiTermsCache', cache)
  }

  clearTeiTermsCache() {
    this.store.set('teiTermsCache', {})
  }

  getExtractionConfig() {
    return this.store.get('extractionConfig', defaults.extractionConfig)
  }

  updateExtractionConfig(config) {
    const current = this.getExtractionConfig()
    this.store.set('extractionConfig', { ...current, ...config })
  }

  getVocabularyConfig() {
    return this.store.get('vocabularyConfig', defaults.vocabularyConfig)
  }

  updateVocabularyConfig(config) {
    const current = this.getVocabularyConfig()
    this.store.set('vocabularyConfig', { ...current, ...config })
  }

  getRecentProjects() {
    return this.store.get('recentProjects', [])
  }

  addRecentProject(project) {
    const projects = this.getRecentProjects()
    const filtered = projects.filter((p) => p.name !== project.name)
    const updated = [{ ...project, lastAccessed: Date.now() }, ...filtered].slice(0, 10)
    this.store.set('recentProjects', updated)
  }

  removeRecentProject(projectName) {
    const projects = this.getRecentProjects()
    this.store.set(
      'recentProjects',
      projects.filter((p) => p.name !== projectName)
    )
  }

  exportConfig() {
    return {
      settings: this.getSettings(),
      xmlCorpora: this.getXmlCorpora(),
      currentVocabulary: this.getCurrentVocabulary(),
      extractionConfig: this.getExtractionConfig(),
      vocabularyConfig: this.getVocabularyConfig(),
      recentProjects: this.getRecentProjects()
    }
  }

  importConfig(config) {
    if (config.settings) this.store.set('teiSettings', config.settings)
    if (config.xmlCorpora) this.store.set('xmlCorpora', config.xmlCorpora)
    if (config.currentVocabulary) this.store.set('currentVocabulary', config.currentVocabulary)
    if (config.extractionConfig) this.store.set('extractionConfig', config.extractionConfig)
    if (config.vocabularyConfig) this.store.set('vocabularyConfig', config.vocabularyConfig)
    if (config.recentProjects) this.store.set('recentProjects', config.recentProjects)
  }
}

export const teiStore = new TeiStoreManager(store)
