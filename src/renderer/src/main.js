import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useXmlStore } from './stores/xmlStore'
import { useProjectStore } from './stores/store'
import { useImageStore } from './stores/imageStore'
import { useHtmlStore } from './stores/htmlStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')

const xmlStore = useXmlStore()
xmlStore.init()

const projectStore = useProjectStore()

const imageStore = useImageStore()

const htmlStore = useHtmlStore()

const loadingScreen = document.getElementById('loading-initial')
if (loadingScreen) {
  loadingScreen.style.display = 'none'
}

const appCheck = document.getElementById('app')
if (appCheck) {
  appCheck.style.display = 'block'
  appCheck.style.opacity = 1
  appCheck.style.width = '100vw'
  appCheck.style.height = '100vh'
}
