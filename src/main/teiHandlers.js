import { ipcMain, BrowserWindow } from 'electron'
import { XMLValidator } from 'fast-xml-parser'
import saxParserLists from './saxParserLists.js'
import saxParserVocabulary from './saxParserVocabulary.js'
import { teiFileManager } from './filemanager.js'
import { teiStore } from './electronStore.js'

/**
 * Registra tutti gli IPC handler per le funzionalità TEI.
 * Ogni dialog viene aperto in modo autonomo dalla finestra che lo invoca
 * (Assembler / HeaderBuilder / Vocabulary), esattamente come già avviene
 * per Image: si usa la finestra del chiamante (event.sender), non più una
 * mainWindow fissata una volta per tutte all'avvio.
 *
 * @param {Map<string, BrowserWindow>} childWindows - mappa id -> finestra
 * secondaria (stessa istanza popolata in index.js), usata per capire da
 * quale component/finestra arriva la chiamata IPC senza introdurre alcun
 * parametro esplicito lato renderer/preload.
 */
export function registerTeiHandlers(childWindows) {
  teiFileManager.initializeWorkFiles().catch((err) => {
    console.error('Errore inizializzazione TEI workspace:', err)
  })

  /**
   * Risale all'id logico ('coder', 'assembler', ecc.) della finestra da cui
   * proviene l'evento IPC, riusando la stessa logica del canale
   * 'get-window-type' già presente in index.js.
   */
  function getCallerWindowId(event) {
    if (!childWindows) return 'unknown'
    for (const [id, win] of childWindows.entries()) {
      if (win.webContents === event.sender) return id
    }
    return 'unknown'
  }

  ipcMain.handle('dialog:openXmlFiles', async (event) => {
    try {
      const callerWindow = BrowserWindow.fromWebContents(event.sender)
      const callerWindowId = getCallerWindowId(event)
      const registerInCorpus = callerWindowId === 'assembler'
      return await teiFileManager.openXmlFilesDialog(callerWindow, registerInCorpus)
    } catch (error) {
      console.error('Errore apertura XML:', error)
      throw error
    }
  })

  ipcMain.handle('dialog:openJsonFile', async (event) => {
    try {
      const callerWindow = BrowserWindow.fromWebContents(event.sender)
      return await teiFileManager.openJsonFileDialog(callerWindow)
    } catch (error) {
      console.error('Errore apertura JSON:', error)
      throw error
    }
  })

  ipcMain.handle('dialog:saveFile', async (event, defaultPath, filters) => {
    try {
      const callerWindow = BrowserWindow.fromWebContents(event.sender)
      return await teiFileManager.saveFileDialog(callerWindow, defaultPath, filters)
    } catch (error) {
      console.error('Errore dialog salvataggio:', error)
      throw error
    }
  })

  ipcMain.handle('file:read', async (_event, filePath) => {
    try {
      return await teiFileManager.readFile(filePath)
    } catch (error) {
      console.error('Errore lettura file:', error)
      throw error
    }
  })

  ipcMain.handle('file:save', async (_event, filePath, content) => {
    try {
      return await teiFileManager.saveFile(filePath, content)
    } catch (error) {
      console.error('Errore salvataggio file:', error)
      throw error
    }
  })

  ipcMain.handle('file:info', async (_event, paths) => {
    try {
      return await teiFileManager.getFileInfo(paths)
    } catch (error) {
      console.error('Errore info file:', error)
      throw error
    }
  })

  ipcMain.on('file:showInFolder', (_event, filePath) => {
    teiFileManager.showInFolder(filePath)
  })

  ipcMain.handle('path:documents', () => {
    return teiFileManager.getDocumentsPath()
  })

  ipcMain.handle('json:load', async (_event, filePath) => {
    try {
      return await teiFileManager.loadJson(filePath)
    } catch (error) {
      console.error('Errore caricamento JSON:', error)
      throw error
    }
  })

  ipcMain.handle('json:save', async (_event, filePath, data, indent) => {
    try {
      return await teiFileManager.saveJson(filePath, data, indent)
    } catch (error) {
      console.error('Errore salvataggio JSON:', error)
      throw error
    }
  })

  ipcMain.handle('sax:extractTeiTerms', async (event, filePaths, options) => {
    try {
      const callerWindow = BrowserWindow.fromWebContents(event.sender)
      saxParserLists.setProgressCallback((progress, message) => {
        const win = callerWindow || BrowserWindow.getFocusedWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('sax:progress', progress, message)
        }
      })

      const xmlFiles = await teiFileManager.readXmlFiles(filePaths)

      const termLists = await saxParserLists.extractTeiTerms(xmlFiles, options)

      const workPath = teiFileManager.getWorkPath()
      const tempFilePath = `${workPath}/temp-termlists.json`
      await teiFileManager.saveJson(tempFilePath, termLists, 2)

      return termLists
    } catch (error) {
      console.error('Errore estrazione termini:', error)
      throw error
    }
  })

  ipcMain.handle('sax:generateTeiHeader', async (_event, termLists) => {
    try {
      return await saxParserLists.generateTeiHeader(termLists)
    } catch (error) {
      console.error('Errore generazione header:', error)
      throw error
    }
  })

  ipcMain.handle('sax:createVocabulary', async (event, filePaths, options) => {
    try {
      const callerWindow = BrowserWindow.fromWebContents(event.sender)
      saxParserVocabulary.setProgressCallback((progress, message) => {
        const win = callerWindow || BrowserWindow.getFocusedWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('sax:progress', progress, message)
        }
      })

      const xmlFiles = await teiFileManager.readXmlFiles(filePaths)

      const vocabulary = await saxParserVocabulary.createVocabulary(xmlFiles, options)

      const workPath = teiFileManager.getWorkPath()
      const tempFilePath = `${workPath}/temp-vocabulary.json`
      await teiFileManager.saveJson(tempFilePath, vocabulary, 2)

      const stats = saxParserVocabulary.getVocabularyStats(vocabulary)

      return { vocabulary, stats }
    } catch (error) {
      console.error('Errore creazione vocabolario:', error)
      throw error
    }
  })

  ipcMain.handle('validate:teiXml', async (_event, xmlContent) => {
    try {
      const validationResult = XMLValidator.validate(xmlContent, {
        allowBooleanAttributes: true
      })

      if (validationResult === true) {
        return { valid: true, errors: [] }
      } else {
        return {
          valid: false,
          errors: [`Errore alla linea ${validationResult.err.line}: ${validationResult.err.msg}`]
        }
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`Errore di validazione: ${error.message}`]
      }
    }
  })

  ipcMain.handle('validate:vocabulary', async (_event, vocabulary) => {
    try {
      return teiFileManager.validateVocabulary(vocabulary)
    } catch (error) {
      console.error('Errore validazione vocabolario:', error)
      throw error
    }
  })

  ipcMain.handle('settings:load', () => {
    try {
      return teiStore.exportConfig()
    } catch (error) {
      console.error('Errore caricamento settings:', error)
      throw error
    }
  })

  ipcMain.handle('settings:save', (_event, settings) => {
    try {
      teiStore.importConfig(settings)
      return true
    } catch (error) {
      console.error('Errore salvataggio settings:', error)
      throw error
    }
  })

  ipcMain.handle('workspace:reset', async () => {
    try {
      await teiFileManager.resetWorkFiles()
      return true
    } catch (error) {
      console.error('Errore reset workspace:', error)
      throw error
    }
  })
}
