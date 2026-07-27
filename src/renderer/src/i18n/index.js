import { createI18n } from 'vue-i18n'
import it from './locales/it.json'
import en from './locales/en.json'

const STORAGE_KEY = 'scriptorium-locale'

function getInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'it' || saved === 'en') return saved
  } catch {}
  return 'it'
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'it',
  globalInjection: true,
  messages: { it, en }
})

export function setLocale(locale) {
  if (locale !== 'it' && locale !== 'en') return
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {}
}

export default i18n
