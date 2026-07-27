<script setup>
import { reactive, onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../stores/store'
import { setLocale } from '../i18n'
import BrandButton from '../shared/brand/BrandButton.vue'

const project = useProjectStore()
const { t, locale } = useI18n()

const availableLocales = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' }
]

function onLocaleChange(event) {
  setLocale(event.target.value)
}

const state = reactive({
  image: false,
  viewer: false,
  coder: false,
  export: false,
  assembler: false,
  headerbuilder: false,
  vocabulary: false,
  speculum: false
})

const toolIds = [
  'image',
  'coder',
  'viewer',
  'assembler',
  'headerbuilder',
  'vocabulary',
  'speculum',
  'export'
]

const tools = computed(() =>
  toolIds.map((id) => ({
    id,
    label: t(`home.tools.${id}.label`),
    description: t(`home.tools.${id}.description`)
  }))
)

function toggle(id) {
  if (!state[id]) {
    window.electronAPI.openWindow(id)
    state[id] = true
  } else {
    window.electronAPI.closeWindow(id)
    state[id] = false
  }
}

async function saveSession() {
  await project.saveSession()
}

async function loadSession() {
  await project.loadSession()
}

async function resetSession() {
  await project.resetSession()
}

const clipboardHistory = ref([])
const copiedFeedbackId = ref(null)

async function loadClipboardHistory() {
  try {
    clipboardHistory.value = await window.electronAPI.getClipboardHistory()
  } catch (error) {
    console.error('Errore caricamento cronologia clipboard:', error)
  }
}

async function useClipboardItem(entry) {
  try {
    await window.electronAPI.copyClipboardItem(entry.text)
    copiedFeedbackId.value = entry.id
    setTimeout(() => {
      if (copiedFeedbackId.value === entry.id) copiedFeedbackId.value = null
    }, 1200)
  } catch (error) {
    console.error('Errore copia voce clipboard:', error)
  }
}

async function removeClipboardItem(entry) {
  try {
    clipboardHistory.value = await window.electronAPI.removeClipboardItem(entry.id)
  } catch (error) {
    console.error('Errore rimozione voce clipboard:', error)
  }
}

async function clearClipboardHistory() {
  try {
    clipboardHistory.value = await window.electronAPI.clearClipboardHistory()
  } catch (error) {
    console.error('Errore pulizia cronologia clipboard:', error)
  }
}

function formatClipboardTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

const clipboardCount = computed(() => clipboardHistory.value.length)

onMounted(() => {
  window.electronAPI.onWindowClosed((id) => {
    state[id] = false
  })

  loadClipboardHistory()
  window.electronAPI.onClipboardUpdated((history) => {
    clipboardHistory.value = history
  })
})
</script>

<template>
  <div class="home">
    <header class="home-header">
      <div class="home-header-top">
        <h1 class="header-title">{{ $t('home.title') }}</h1>
        <div class="home-header-actions">
          <div class="language-switcher">
            <label for="language-select" class="language-switcher-label">{{
              $t('home.languageSwitcher.label')
            }}</label>
            <select
              id="language-select"
              :value="locale"
              class="language-select"
              @change="onLocaleChange"
            >
              <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
                {{ loc.label }}
              </option>
            </select>
          </div>
          <BrandButton />
        </div>
      </div>
      <p class="header-subtitle">
        {{ $t('home.quote') }}
      </p>
      <p class="header-subtitle">{{ $t('home.quoteAuthor') }}</p>
    </header>

    <div class="home-body">
      <section class="tools-panel">
        <div class="tools-grid">
          <button
            v-for="tool in tools"
            :key="tool.id"
            class="tool-card"
            :class="{ active: state[tool.id] }"
            @click="toggle(tool.id)"
          >
            <div class="tool-card-header">
              <span class="tool-label">{{ tool.label }}</span>
              <span v-if="state[tool.id]" class="tool-badge">{{ $t('home.toolOpenBadge') }}</span>
            </div>
            <p class="tool-desc">{{ tool.description }}</p>
          </button>
        </div>

        <div class="card session-card">
          <div class="card-header">
            <h3 class="card-title">{{ $t('home.session.title') }}</h3>
            <p class="card-desc">
              {{ $t('home.session.description') }}
            </p>
          </div>
          <div class="session-actions">
            <button class="btn btn-primary" @click="saveSession">
              {{ $t('home.session.save') }}
            </button>
            <button class="btn btn-outline" @click="loadSession">
              {{ $t('home.session.load') }}
            </button>
            <button class="btn btn-outline btn-danger" @click="resetSession">
              {{ $t('home.session.reset') }}
            </button>
          </div>
        </div>
      </section>

      <aside class="side-panel">
        <div class="card clipboard-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">{{ $t('home.clipboard.title') }}</h3>
              <p class="card-desc">
                {{ $t('home.clipboard.description', { count: clipboardCount }) }}
              </p>
            </div>
            <button
              class="btn btn-sm btn-outline"
              :disabled="clipboardCount === 0"
              @click="clearClipboardHistory"
              :title="$t('home.clipboard.clearTitle')"
            >
              {{ $t('home.clipboard.clear') }}
            </button>
          </div>

          <div v-if="clipboardCount === 0" class="empty-state">
            <p>{{ $t('home.clipboard.emptyTitle') }}</p>
            <p class="text-xs text-secondary">
              {{ $t('home.clipboard.emptyHint') }}
            </p>
          </div>

          <div v-else class="clipboard-list">
            <div
              v-for="entry in clipboardHistory"
              :key="entry.id"
              class="clipboard-item"
              :class="{ copied: copiedFeedbackId === entry.id }"
              :title="entry.text"
              @click="useClipboardItem(entry)"
            >
              <span class="clipboard-text">{{ entry.text }}</span>
              <div class="clipboard-meta">
                <span class="clipboard-time">{{ formatClipboardTime(entry.timestamp) }}</span>
                <button
                  class="clipboard-remove"
                  :title="$t('home.clipboard.removeTitle')"
                  @click.stop="removeClipboardItem(entry)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card ai-companion-card">
          <span class="ai-icon">✦</span>
          <h3 class="card-title">{{ $t('home.aiCompanion.title') }}</h3>
          <p class="text-xs text-secondary">
            {{ $t('home.aiCompanion.description') }}
          </p>
          <span class="ai-soon-badge">{{ $t('home.aiCompanion.badge') }}</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  background: #1e1e1e;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: auto;
}

.home-header {
  flex-shrink: 0;
}
.home-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.home-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.header-title {
  margin: 0 0 0.3rem 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.language-switcher {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.language-switcher-label {
  font-size: 0.78rem;
  color: #999;
}
.language-select {
  background: #252526;
  color: #fff;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
}
.language-select:hover {
  border-color: #555;
}
.header-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #999;
  max-width: 60ch;
}

.home-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1rem;
  min-height: 0;
}

.tools-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  overflow-y: auto;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.tool-card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: left;
  cursor: pointer;
  color: #fff;
  font-family: inherit;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s;
}
.tool-card:hover {
  border-color: #555;
  background: #2d2d2d;
  transform: translateY(1px);
}
.tool-card.active {
  border-color: #0e639c;
  background: #1e2f3f;
}

.tool-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.tool-label {
  font-weight: 600;
  font-size: 0.95rem;
}
.tool-badge {
  margin-left: auto;
  background: #0e639c;
  color: #fff;
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 8px;
  font-weight: 600;
}
.tool-desc {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #999;
}
.tool-card.active .tool-desc {
  color: #a5c8f8;
}

.card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 1rem;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.card-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
}
.card-desc {
  margin: 0;
  font-size: 0.78rem;
  color: #999;
}

.session-card {
  flex-shrink: 0;
}
.session-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.clipboard-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.clipboard-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.clipboard-item {
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 0.45rem 0.6rem;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.clipboard-item:hover {
  border-color: #555;
}
.clipboard-item.copied {
  border-color: #2d7a3e;
  background: #1b4332;
}
.clipboard-text {
  font-size: 0.8rem;
  color: #eee;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.clipboard-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.clipboard-time {
  font-size: 0.68rem;
  color: #777;
}
.clipboard-remove {
  background: transparent;
  border: none;
  color: #777;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}
.clipboard-remove:hover {
  color: #f8a5a5;
  background: #3a1e1e;
}

.empty-state {
  text-align: center;
  padding: 1.5rem 0.5rem;
  color: #888;
  font-size: 0.82rem;
}

.ai-companion-card {
  flex-shrink: 0;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  text-align: center;
  border-style: dashed;
  color: #777;
}
.ai-icon {
  font-size: 1.4rem;
  color: #555;
}
.ai-soon-badge {
  margin-top: 0.2rem;
  font-size: 0.65rem;
  background: #3a3d41;
  color: #ccc;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
}

.text-xs {
  font-size: 0.72rem;
}
.text-secondary {
  color: #999;
}

.btn {
  background: #3a3d41;
  border: none;
  color: #fff;
  padding: 0.5rem 0.9rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.btn:hover:not(:disabled) {
  background: #55595e;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
}
.btn-primary {
  background: #0e639c;
}
.btn-primary:hover:not(:disabled) {
  background: #1177bb;
}
.btn-outline {
  background: transparent;
  border: 1px solid #555;
}
.btn-outline:hover:not(:disabled) {
  background: #333;
}
.btn-danger:hover:not(:disabled) {
  background: #4a1e1e;
  border-color: #f8a5a5;
  color: #f8a5a5;
}
</style>

<style>
body {
  margin: 0;
  display: block;
  justify-content: initial;
  align-items: initial;
  background-color: #1e1e1e;
}
</style>
