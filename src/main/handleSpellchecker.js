import { app, ipcMain } from 'electron'

let defaultSystemLanguage = null

ipcMain.handle('spellchecker:setLanguage', (event, language) => {
  const webContents = event.sender
  const languageMap = {
    ita: 'it-IT',
    lat: 'it-IT',
    eng: 'en-GB',
    fra: 'fr-FR',
    spa: 'es-ES',
    por: 'pt-PT',
    deu: 'de-DE',
    jpn: 'en-GB',
    rus: 'ru-RU',
    ara: 'en-GB',
    chi_sim: 'en-GB',
    ell: 'el-GR'
  }
  const electronLang = languageMap[language] || language
  webContents.session.setSpellCheckerLanguages([electronLang])
  return { success: true, language: electronLang }
})

ipcMain.handle('spellchecker:restoreDefault', (event) => {
  const webContents = event.sender
  const systemLang = defaultSystemLanguage || app.getLocale()
  webContents.session.setSpellCheckerLanguages([systemLang])
  return { success: true, language: systemLang }
})
