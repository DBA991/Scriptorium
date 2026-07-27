import { BrowserWindow, ipcMain, dialog, app, shell } from 'electron'
import { promises as fs } from 'fs'
import fsSync from 'fs'
import path from 'path'
import crypto from 'crypto'
import mime from 'mime-types'
import PDFDocument from 'pdfkit'
import { store, teiStore } from './electronStore'

const WORKSPACE_DIR = 'Scriptorium'
function getWorkspacePath() {
  return path.join(app.getPath('documents'), WORKSPACE_DIR)
}
async function ensureWorkspace() {
  try {
    await fs.mkdir(getWorkspacePath(), { recursive: true })
  } catch (error) {
    console.error('Errore creazione workspace:', error)
  }
}

export function registerFileManagerHandlers() {
  ipcMain.handle('dialog:openImages', () => openImageDialog())
  ipcMain.handle('image:read', (_, path) => readImageFile(path))

  ipcMain.handle('export-pdf', async (_, pages) => {
    const defaultProjectName = store.get('project') || 'documento'

    const result = await dialog.showSaveDialog({
      title: 'Salva PDF',
      defaultPath: `${defaultProjectName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    const { default: sizeOf } = await import('image-size')

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false, margin: 0 })
      const writeStream = fsSync.createWriteStream(result.filePath)

      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
      doc.on('error', reject)

      doc.pipe(writeStream)

      ;(async () => {
        for (const pageInfo of pages) {
          const { isBlank, path: imgPath } = pageInfo
          let { width, height } = pageInfo

          if (isBlank) {
            width = width || 595
            height = height || 842
            doc.addPage({ size: [width, height], margin: 0 })
            continue
          }

          const fileBuffer = await fs.readFile(imgPath)

          if (!width || !height) {
            const dims = sizeOf(fileBuffer)
            width = dims.width
            height = dims.height
          }

          doc.addPage({ size: [width, height], margin: 0 })
          doc.image(fileBuffer, 0, 0, { width, height })
        }
        doc.end()
      })().catch(reject)
    })

    return { success: true, path: result.filePath }
  })

  /**
   * Gestisce l'esportazione di file generici (XML, HTML) recuperando i contenuti dallo store e salvandoli su disco.
   * @param {string} fileName - Il nome del progetto, usato come nome predefinito del file.
   * @param {string} type - Il tipo di file da esportare ('xml' o 'html').
   */
  ipcMain.handle('export:file', async (event, { fileName, type }) => {
    store.set('project', fileName)

    let content
    let defaultPath
    let filters

    switch (type) {
      case 'xml':
        content = store.get('xmlContent')
        if (!content) {
          dialog.showErrorBox('Esporta XML', 'Nessun contenuto XML da esportare.')
          return false
        }
        defaultPath = `${fileName}.xml`
        filters = [{ name: 'XML Documents', extensions: ['xml'] }]
        break

      case 'html':
        content = store.get('htmlContent')
        if (!content) {
          dialog.showErrorBox('Esporta HTML', 'Nessun contenuto HTML da esportare.')
          return false
        }
        defaultPath = `${fileName}.html`
        filters = [{ name: 'HTML Documents', extensions: ['html'] }]
        break

      default:
        dialog.showErrorBox('Esporta file', `Tipo di file non supportato: ${type}.`)
        return false
    }

    const window = BrowserWindow.fromWebContents(event.sender)
    const { filePath, canceled } = await dialog.showSaveDialog(window, {
      defaultPath: defaultPath,
      filters: filters
    })

    if (canceled || !filePath) {
      return false
    }

    try {
      await fs.writeFile(filePath, content)
      return true
    } catch (error) {
      dialog.showErrorBox('Errore di salvataggio', `Impossibile salvare il file: ${error.message}`)
      return false
    }
  })
}
async function openImageDialog() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }]
  })
  return result.filePaths
}

async function readImageFile(path) {
  const data = await fs.readFile(path)
  const base64 = data.toString('base64')
  const mimeType = mime.lookup(path) || 'image/jpeg'

  return {
    name: path.split('/').pop(),
    path,
    dataUrl: `data:${mimeType};base64,${base64}`,
    type: mimeType
  }
}

export const teiFileManager = {
  async initializeWorkFiles() {
    await ensureWorkspace()
    const termListsPath = path.join(getWorkspacePath(), 'temp-termlists.json')
    const vocabularyPath = path.join(getWorkspacePath(), 'temp-vocabulary.json')
    if (!(await this.fileExists(termListsPath))) await this.saveJson(termListsPath, {}, 2)
    if (!(await this.fileExists(vocabularyPath))) await this.saveJson(vocabularyPath, {}, 2)
  },

  async resetWorkFiles() {
    const termListsPath = path.join(getWorkspacePath(), 'temp-termlists.json')
    const vocabularyPath = path.join(getWorkspacePath(), 'temp-vocabulary.json')
    await this.saveJson(termListsPath, {}, 2)
    await this.saveJson(vocabularyPath, {}, 2)
  },

  getDocumentsPath() {
    return app.getPath('documents')
  },

  getWorkPath() {
    return getWorkspacePath()
  },

  /**
   * @param {BrowserWindow} parentWindow
   * @param {boolean} registerInCorpus - se true (default, comportamento storico)
   * i file scelti vengono aggiunti anche a xmlCorpora (usato dall'Assembler).
   * Il Coder passa false: vuole solo il path/contenuto del file per popolare
   * il proprio editor, senza inquinare il corpus dell'Assembler.
   */
  async openXmlFilesDialog(parentWindow, registerInCorpus = true) {
    const result = await dialog.showOpenDialog(parentWindow, {
      title: 'Seleziona file XML-TEI',
      defaultPath: teiStore.getSettings().lastXmlPath || getWorkspacePath(),
      filters: [
        { name: 'File XML', extensions: ['xml'] },
        { name: 'Tutti i file', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      teiStore.updateSettings({ lastXmlPath: path.dirname(result.filePaths[0]) })
      const filesInfo = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const stats = await fs.stat(filePath)
          return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            lastModified: stats.mtimeMs
          }
        })
      )
      if (registerInCorpus) {
        teiStore.addXmlFiles(filesInfo)
      }
      return filesInfo
    }
    return []
  },

  async openJsonFileDialog(parentWindow) {
    const result = await dialog.showOpenDialog(parentWindow, {
      title: 'Seleziona file JSON',
      defaultPath: teiStore.getSettings().lastJsonPath || getWorkspacePath(),
      filters: [{ name: 'File JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      teiStore.updateSettings({ lastJsonPath: path.dirname(filePath) })
      const stats = await fs.stat(filePath)
      teiStore.setCurrentVocabulary({
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        lastModified: stats.mtimeMs
      })
      return filePath
    }
    return null
  },

  async saveFileDialog(parentWindow, defaultName, filters = []) {
    const result = await dialog.showSaveDialog(parentWindow, {
      title: 'Salva file',
      defaultPath: path.join(getWorkspacePath(), defaultName),
      filters: filters.length ? filters : [{ name: 'Tutti i file', extensions: ['*'] }]
    })
    if (!result.canceled && result.filePath) return result.filePath
    return null
  },

  async readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch (error) {
      throw new Error(`Errore lettura file ${filePath}: ${error.message}`)
    }
  },

  async readXmlFiles(filePaths) {
    try {
      return await Promise.all(
        filePaths.map(async (filePath) => ({
          path: filePath,
          name: path.basename(filePath),
          content: await this.readFile(filePath)
        }))
      )
    } catch (error) {
      throw new Error(`Errore lettura file XML: ${error.message}`)
    }
  },

  async saveFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content, 'utf8')
      return true
    } catch (error) {
      throw new Error(`Errore salvataggio file ${filePath}: ${error.message}`)
    }
  },

  async loadJson(filePath) {
    try {
      const content = await this.readFile(filePath)
      return JSON.parse(content)
    } catch (error) {
      throw new Error(`Errore caricamento JSON ${filePath}: ${error.message}`)
    }
  },

  async saveJson(filePath, data, indent = 2) {
    try {
      const content = JSON.stringify(data, null, indent)
      await this.saveFile(filePath, content)
      return true
    } catch (error) {
      throw new Error(`Errore salvataggio JSON ${filePath}: ${error.message}`)
    }
  },

  async getFileInfo(paths) {
    const pathArray = Array.isArray(paths) ? paths : [paths]
    try {
      const info = await Promise.all(
        pathArray.map(async (filePath) => {
          const stats = await fs.stat(filePath)
          return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            lastModified: stats.mtimeMs,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory()
          }
        })
      )
      return Array.isArray(paths) ? info : info[0]
    } catch (error) {
      throw new Error(`Errore ottenimento info file: ${error.message}`)
    }
  },

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  },

  async getFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath)
      return crypto.createHash('md5').update(content).digest('hex')
    } catch (error) {
      throw new Error(`Errore calcolo hash: ${error.message}`)
    }
  },

  showInFolder(filePath) {
    shell.showItemInFolder(filePath)
  },

  validateVocabulary(vocabulary) {
    const errors = []
    if (typeof vocabulary !== 'object' || vocabulary === null) {
      errors.push('Il vocabolario deve essere un oggetto')
      return { valid: errors.length === 0, errors }
    }
    for (const [word, data] of Object.entries(vocabulary)) {
      if (!data || typeof data !== 'object') {
        errors.push(`"${word}": valore non valido`)
        continue
      }
      if (!Array.isArray(data.occurrences)) {
        errors.push(`"${word}": manca array occurrences`)
        continue
      }
      data.occurrences.forEach((occ, idx) => {
        if (!occ.file) errors.push(`"${word}".occurrences[${idx}]: manca campo 'file'`)
        if (typeof occ.position !== 'string' && typeof occ.position !== 'number') {
          errors.push(
            `"${word}".occurrences[${idx}]: 'position' deve essere una stringa o un numero`
          )
        }
      })
    }
    return { valid: errors.length === 0, errors }
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
