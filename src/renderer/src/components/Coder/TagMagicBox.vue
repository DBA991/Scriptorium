<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Taggers } from '@renderer/shared/tei/tags.js'

const emit = defineEmits(['apply-tag'])

const categories = [
  {
    label: 'Entità nominate',
    icon: '👤',
    items: [
      { key: 'person', label: 'Persona', tag: Taggers.person },
      { key: 'place', label: 'Luogo', tag: Taggers.place },
      { key: 'organization', label: 'Organizzazione', tag: Taggers.organization },
      { key: 'thing', label: 'Oggetto', tag: Taggers.thing }
    ]
  },
  {
    label: 'Riferimenti',
    icon: '🔖',
    items: [
      { key: 'bibliography', label: 'Bibliografia', tag: Taggers.bibliography },
      { key: 'date', label: 'Data', tag: Taggers.date },
      { key: 'keyword', label: 'Parola chiave', tag: Taggers.keyword },
      { key: 'link', label: 'Link', tag: Taggers.link }
    ]
  },
  {
    label: 'Annotazioni',
    icon: '✎',
    items: [
      { key: 'reference', label: 'Riferimento', tag: Taggers.reference },
      { key: 'note', label: 'Nota', tag: Taggers.note },
      { key: 'quote', label: 'Citazione', tag: Taggers.quote },
      { key: 'correction', label: 'Correzione', tag: Taggers.correction },
      { key: 'translation', label: 'Traduzione', tag: Taggers.translation }
    ]
  },
  {
    label: 'Selfclosed',
    icon: '🛑',
    items: [
      { key: 'page', label: 'Pagina', tag: Taggers.page },
      { key: 'break', label: 'Interruzione', tag: Taggers.break },
      { key: 'ruler', label: 'Linea orizzontale', tag: Taggers.ruler },
      { key: 'lineBreak', label: 'Interruzione di riga', tag: Taggers.lineBreak }
    ]
  }
]

const openMenu = ref(false)
const openSubmenu = ref(null)
const root = ref(null)

function toggleMenu() {
  openMenu.value = !openMenu.value
  if (!openMenu.value) openSubmenu.value = null
}

function toggleSubmenu(idx) {
  openSubmenu.value = openSubmenu.value === idx ? null : idx
}

function applyTag(tagFn) {
  emit('apply-tag', tagFn)
  openMenu.value = false
  openSubmenu.value = null
}

function handleClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) {
    openMenu.value = false
    openSubmenu.value = null
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="tag-magic-box" ref="root">
    <button
      class="magic-btn"
      :class="{ active: openMenu }"
      @click="toggleMenu"
      :title="$t('tagMagicBox.buttonTitle')"
    >
      <span class="magic-icon">🏷</span>
      <span class="magic-label">{{ $t('tagMagicBox.buttonLabel') }}</span>
      <span class="magic-arrow" :class="{ rotated: openMenu }">▾</span>
    </button>

    <transition name="slide">
      <div v-if="openMenu" class="magic-menu">
        <div
          v-for="(cat, idx) in categories"
          :key="cat.label"
          class="menu-item"
          @click="toggleSubmenu(idx)"
        >
          <div class="menu-row">
            <span class="menu-icon">{{ cat.icon }}</span>
            <span class="menu-text">{{ cat.label }}</span>
            <span class="menu-arrow" :class="{ rotated: openSubmenu === idx }">▸</span>
          </div>

          <transition name="expand">
            <div v-if="openSubmenu === idx" class="submenu">
              <button
                v-for="item in cat.items"
                :key="item.key"
                class="submenu-btn"
                @click.stop="applyTag(item.tag)"
              >
                {{ item.label }}
              </button>
            </div>
          </transition>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.tag-magic-box {
  position: relative;
  display: inline-block;
}

.magic-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: #3a3d41;
  border: none;
  color: #fff;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.magic-btn:hover,
.magic-btn.active {
  background: #0e639c;
}

.magic-icon {
  font-size: 0.95rem;
}
.magic-arrow {
  font-size: 0.7rem;
  transition: transform 0.2s;
}
.magic-arrow.rotated {
  transform: rotate(180deg);
}

.magic-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 200px;
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  z-index: 100;
  padding: 0.3rem;
}

.menu-item {
  border-radius: 4px;
}
.menu-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.82rem;
}
.menu-row:hover {
  background: #2d2d2d;
}
.menu-icon {
  font-size: 0.9rem;
}
.menu-text {
  flex: 1;
}
.menu-arrow {
  font-size: 0.65rem;
  color: #888;
  transition: transform 0.2s;
}
.menu-arrow.rotated {
  transform: rotate(90deg);
}

.submenu {
  padding: 0.2rem 0 0.2rem 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.submenu-btn {
  text-align: left;
  background: transparent;
  border: none;
  color: #ccc;
  padding: 0.35rem 0.5rem;
  font-size: 0.78rem;
  border-radius: 3px;
  cursor: pointer;
}
.submenu-btn:hover {
  background: #0e639c;
  color: #fff;
}

.slide-enter-active,
.slide-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.15s;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}
</style>
