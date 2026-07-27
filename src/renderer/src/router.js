import { createRouter, createWebHashHistory } from 'vue-router'

import Home from '../src/components/Home.vue'
import Image from './components/Image/Image.vue'
import Coder from './components/Coder/Coder.vue'
import Viewer from './components/Viewer/Viewer.vue'
import Assembler from './components/Assembler/Assembler.vue'
import HeaderBuilder from './components/HeaderBuilder/HeaderBuilder.vue'
import Vocabulary from './components/Vocabulary/Vocabulary.vue'
import Speculum from './components/Speculum/Speculum.vue'
import OcrModal from './components/Image/OcrModal.vue'
import Export from './components/Export.vue'

const routes = [
  {
    path: '/',
    component: Home,
    meta: { forMainWindow: true }
  },
  {
    path: '/coder',
    component: Coder,
    meta: { forChildWindow: true }
  },
  {
    path: '/image',
    component: Image,
    meta: { forChildWindow: true }
  },
  {
    path: '/viewer',
    component: Viewer,
    meta: { forChildWindow: true }
  },
  {
    path: '/assembler',
    component: Assembler,
    meta: { forChildWindow: true }
  },
  {
    path: '/headerbuilder',
    component: HeaderBuilder,
    meta: { forChildWindow: true }
  },
  {
    path: '/vocabulary',
    component: Vocabulary,
    meta: { forChildWindow: true }
  },
  {
    path: '/speculum',
    component: Speculum,
    meta: { forChildWindow: true }
  },
  {
    path: '/export',
    component: Export,
    meta: { forChildWindow: true }
  },
  {
    path: '/ocr',
    component: OcrModal,
    meta: { forChildWindow: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
