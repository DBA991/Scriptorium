const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openWindow: (id) => ipcRenderer.invoke('open-window', id),
  closeWindow: (id) => ipcRenderer.invoke('close-window', id),
  onWindowClosed: (callback) => ipcRenderer.on('window-closed', (_, id) => callback(id)),

  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', { key, value }),
  storeClear: (key) => ipcRenderer.invoke('store:clear', key),
  reinitializeStore: (key) => ipcRenderer.invoke('store:reinitialize', key),

  onStoreUpdated: (callback) =>
    ipcRenderer.on('store:updated', (_e, key, value) => callback(key, value)),
  onXmlUpdated: (callback) =>
    ipcRenderer.on('xmlContent:updated', (_e, content) => callback(content)),
  onHtmlUpdated: (callback) =>
    ipcRenderer.on('htmlContent:updated', (_e, content) => callback(content)),
  onImagesUpdated: (callback) => {
    ipcRenderer.on('images:updated', (_e, images) => callback(images))
  },
  onStoreReinitialized: (callback) =>
    ipcRenderer.on('store:reinitialized', (_e, key, value) => callback(key, value)),
  openImagesDialog: () => ipcRenderer.invoke('dialog:openImages'),
  readImageFile: (path) => ipcRenderer.invoke('image:read', path),
  exportPdf: (pages) => ipcRenderer.invoke('export-pdf', pages),
  setSpellCheckerLanguage: (language) => ipcRenderer.invoke('spellchecker:setLanguage', language),
  restoreDefaultSpellChecker: () => ipcRenderer.invoke('spellchecker:restoreDefault'),
  openOcrWindow: (imageData) => ipcRenderer.send('open-ocr-window', imageData),
  closeOcrWindow: () => ipcRenderer.send('close-ocr-window'),
  onOcrImageData: (callback) => ipcRenderer.on('ocr-image-data', (event, data) => callback(data)),
  sendTextToEditor: (text) => ipcRenderer.send('send-text-to-editor', text),
  onReceiveTextFromOcr: (callback) =>
    ipcRenderer.on('receive-text-from-ocr', (event, data) => callback(data)),
  startOcrAutomation: (config) => ipcRenderer.send('ocr-auto:start', config),
  stopOcrAutomation: () => ipcRenderer.send('ocr-auto:stop'),
  sendOcrAutoPageDone: () => ipcRenderer.send('ocr-auto:page-done'),
  sendOcrAutoReady: () => ipcRenderer.send('ocr-auto:ready'),
  onOcrAutoProgress: (callback) =>
    ipcRenderer.on('ocr-auto:progress', (_e, progress) => callback(progress)),
  onOcrAutoFinished: (callback) => ipcRenderer.on('ocr-auto:finished', () => callback()),
  onOcrAutoPage: (callback) => ipcRenderer.on('ocr-auto:page', (_e, data) => callback(data)),
  saveSessionToFile: (data) => ipcRenderer.invoke('store:saveSessionToFile', data),
  loadSessionFromFile: () => ipcRenderer.invoke('store:loadSessionFromFile'),
  storeGetAll: () => ipcRenderer.invoke('store:getAll'),
  storeSetAll: (data) => ipcRenderer.invoke('store:setAll', data),
  exportFile: (fileName, type) => ipcRenderer.invoke('export:file', { fileName, type }),
  resetWithReload: () => ipcRenderer.invoke('store:resetWithReload'),
  reloadWindows: (options) => ipcRenderer.invoke('store:reloadWindows', options),

  openXmlFiles: () => ipcRenderer.invoke('dialog:openXmlFiles'),
  openJsonFile: () => ipcRenderer.invoke('dialog:openJsonFile'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),
  saveFileDialog: (defaultName, filters) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, filters),
  getFileInfo: (paths) => ipcRenderer.invoke('file:info', paths),
  showInFolder: (filePath) => ipcRenderer.send('file:showInFolder', filePath),
  getDocumentsPath: () => ipcRenderer.invoke('path:documents'),
  loadJson: (filePath) => ipcRenderer.invoke('json:load', filePath),
  saveJson: (filePath, data, indent) => ipcRenderer.invoke('json:save', filePath, data, indent),

  extractTeiTerms: (filePaths, options) =>
    ipcRenderer.invoke('sax:extractTeiTerms', filePaths, options),
  generateTeiHeader: (termLists) => ipcRenderer.invoke('sax:generateTeiHeader', termLists),
  createVocabulary: (filePaths, options) =>
    ipcRenderer.invoke('sax:createVocabulary', filePaths, options),
  onSaxProgress: (callback) => {
    const handler = (event, progress, message) => callback(progress, message)
    ipcRenderer.on('sax:progress', handler)
    return () => ipcRenderer.removeListener('sax:progress', handler)
  },

  validateTeiXml: (xmlContent) => ipcRenderer.invoke('validate:teiXml', xmlContent),
  validateVocabulary: (vocabulary) => ipcRenderer.invoke('validate:vocabulary', vocabulary),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetWorkspace: () => ipcRenderer.invoke('workspace:reset'),

  openDelta2Studio: () => ipcRenderer.invoke('brand:openDelta2Studio'),

  getClipboardHistory: () => ipcRenderer.invoke('clipboard:getHistory'),
  onClipboardUpdated: (callback) =>
    ipcRenderer.on('clipboard:updated', (_e, history) => callback(history)),
  copyClipboardItem: (text) => ipcRenderer.invoke('clipboard:copyItem', text),
  removeClipboardItem: (id) => ipcRenderer.invoke('clipboard:removeItem', id),
  clearClipboardHistory: () => ipcRenderer.invoke('clipboard:clearHistory')
})
