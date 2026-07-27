<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  title: {
    type: String,
    default: null
  },
  isVisible: {
    type: Boolean,
    default: false
  },
  sidebarClass: {
    type: String,
    default: ''
  },

  items: {
    type: Array,
    default: () => []
  },

  groups: {
    type: Array,
    default: () => []
  },

  listClass: {
    type: String,
    default: 'sidebar-list'
  },
  showItemId: {
    type: Boolean,
    default: true
  },
  showGroupSelectors: {
    type: Boolean,
    default: true
  },
  hasNavigation: {
    type: Boolean,
    default: true
  },

  emptyListMessage: {
    type: String,
    default: null
  },
  noGroupSelectedMessage: {
    type: String,
    default: null
  },

  navigationLabels: {
    type: Object,
    default: null
  },

  itemKeyField: {
    type: String,
    default: 'id'
  },
  itemDisplayField: {
    type: String,
    default: 'display'
  },
  itemIdField: {
    type: String,
    default: 'id'
  },
  activePageIndex: {
    type: [Number],
    default: -1
  }
})

const resolvedTitle = computed(() => props.title ?? t('sidebar.defaultTitle'))
const resolvedEmptyListMessage = computed(
  () => props.emptyListMessage ?? t('sidebar.defaultEmptyMessage')
)
const resolvedNoGroupSelectedMessage = computed(
  () => props.noGroupSelectedMessage ?? t('sidebar.defaultNoGroupMessage')
)
const resolvedNavigationLabels = computed(
  () =>
    props.navigationLabels ?? {
      previous: t('sidebar.prevGroup'),
      next: t('sidebar.nextGroup')
    }
)

const emit = defineEmits(['item-click', 'navigation-change'])

const activeGroupId = ref(null)
const currentIndex = ref(-1)

const hasGroups = computed(() => {
  return Array.isArray(props.groups) && props.groups.length > 0
})

const getCurrentGroupItems = () => {
  if (!hasGroups.value || activeGroupId.value === null) return []

  const group = props.groups.find(
    (g) => (g.slug || props.groups.indexOf(g)) === activeGroupId.value
  )
  return group ? group.items : []
}

const getEmptyGroupMessage = () => {
  if (!hasGroups.value || activeGroupId.value === null) return resolvedEmptyListMessage.value

  const group = props.groups.find(
    (g) => (g.slug || props.groups.indexOf(g)) === activeGroupId.value
  )
  return group ? `Nessun elemento in ${group.name.toLowerCase()}.` : resolvedEmptyListMessage.value
}

const getItemKey = (item) => {
  if (typeof item === 'object' && item !== null) {
    return item[props.itemKeyField] || item.id || JSON.stringify(item)
  }
  return item
}

const getItemDisplay = (item) => {
  if (typeof item === 'string') return item
  if (typeof item === 'object' && item !== null) {
    return (
      item[props.itemDisplayField] ||
      item.display ||
      item.name ||
      item.n ||
      item.title ||
      item.id ||
      item.text ||
      'Elemento'
    )
  }
  return String(item)
}

const getItemId = (item) => {
  if (typeof item === 'object' && item !== null) {
    return item[props.itemIdField] || item.id
  }
  return null
}

const getItemClass = (item, index) => {
  const classes = ['sidebar-item']

  if (typeof item === 'object' && item !== null) {
    if (item.type) classes.push(`item-type-${item.type}`)
    if (item.className) classes.push(item.className)
  }

  if (props.listClass === 'page-list' && index === props.activePageIndex) {
    classes.push('active-page')
  }

  return classes
}

const formatGroupLabel = (group) => {
  const name = group.name || 'Gruppo'
  const count = group.items ? group.items.length : 0
  const shortName = name.split(':')[0]

  return `${shortName} (${count})`
}

const setActiveGroup = (groupId) => {
  const oldGroupId = activeGroupId.value
  activeGroupId.value = groupId

  if (hasGroups.value) {
    const index = props.groups.findIndex((g) => (g.slug || props.groups.indexOf(g)) === groupId)
    currentIndex.value = index !== -1 ? index : 0
  }
}

const goToNext = () => {
  if (hasGroups.value && currentIndex.value < props.groups.length - 1) {
    const newIndex = currentIndex.value + 1
    const newGroup = props.groups[newIndex]
    const newGroupId = newGroup.slug || newIndex

    setActiveGroup(newGroupId)
    emit('navigation-change', { direction: 'next', index: newIndex, group: newGroup })
  }
}

const goToPrevious = () => {
  if (hasGroups.value && currentIndex.value > 0) {
    const newIndex = currentIndex.value - 1
    const newGroup = props.groups[newIndex]
    const newGroupId = newGroup.slug || newIndex

    setActiveGroup(newGroupId)
    emit('navigation-change', { direction: 'previous', index: newIndex, group: newGroup })
  }
}

const handleItemClick = (item, group = null) => {
  emit('item-click', {
    item,
    group,
    groupId: activeGroupId.value
  })
}

const initializeSidebar = () => {
  if (hasGroups.value && props.groups.length > 0) {
    if (activeGroupId.value === null) {
      const firstGroup = props.groups[0]
      const firstGroupId = firstGroup.slug || 0
      setActiveGroup(firstGroupId)
    } else {
      const currentGroup = props.groups.find(
        (g) => (g.slug || props.groups.indexOf(g)) === activeGroupId.value
      )
      if (!currentGroup) {
        const firstGroup = props.groups[0]
        const firstGroupId = firstGroup.slug || 0
        setActiveGroup(firstGroupId)
      }
    }
  } else {
    activeGroupId.value = null
    currentIndex.value = -1
  }
}

watch(
  () => props.groups,
  () => {
    nextTick(initializeSidebar)
  },
  { immediate: true, deep: true }
)

defineExpose({
  setActiveGroup,
  goToNext,
  goToPrevious,
  getCurrentGroupItems,
  activeGroupId: computed(() => activeGroupId.value),
  currentIndex: computed(() => currentIndex.value)
})
</script>

<template>
  <aside class="sidebar" :class="[sidebarClass, { 'is-visible': isVisible }]">
    <div class="sidebar-header">
      <h3>{{ resolvedTitle }}</h3>

      <slot name="controls"></slot>

      <div v-if="hasNavigation" class="sidebar-navigation">
        <div class="navigation-buttons" v-if="groups.length > 1">
          <button
            @click="goToPrevious"
            :disabled="currentIndex === 0"
            :title="resolvedNavigationLabels.previous"
          >
            ←
          </button>
          <span class="navigation-info"> {{ currentIndex + 1 }} / {{ groups.length }} </span>
          <button
            @click="goToNext"
            :disabled="currentIndex === groups.length - 1"
            :title="resolvedNavigationLabels.next"
          >
            →
          </button>
        </div>

        <div v-if="showGroupSelectors && groups.length > 0" class="group-selectors">
          <button
            v-for="(group, index) in groups"
            :key="group.slug || index"
            @click="setActiveGroup(group.slug || index)"
            :class="{ active: activeGroupId === (group.slug || index) }"
            :title="group.name"
          >
            {{ formatGroupLabel(group) }}
          </button>
        </div>
      </div>
    </div>

    <div class="sidebar-content">
      <template v-if="!hasGroups">
        <ul :class="listClass">
          <li
            v-for="(item, index) in items"
            :key="getItemKey(item)"
            @click="handleItemClick(item)"
            :class="getItemClass(item, index)"
          >
            <slot name="item" :item="item" :index="items.indexOf(item)">
              <strong>{{ getItemDisplay(item) }}</strong>
              <span v-if="showItemId && getItemId(item)" class="item-id">
                {{ $t('sidebar.idLabel', { id: getItemId(item) }) }}
              </span>
            </slot>
          </li>
        </ul>
        <p v-if="items.length === 0" class="empty-message">
          {{ resolvedEmptyListMessage }}
        </p>
      </template>

      <template v-else>
        <template v-for="group in groups" :key="group.slug || group.name">
          <ul
            v-if="activeGroupId === (group.slug || groups.indexOf(group))"
            :class="[listClass, group.listClass]"
          >
            <li
              v-for="(item, index) in group.items"
              :key="getItemKey(item)"
              @click="handleItemClick(item, group)"
              :class="getItemClass(item, index)"
            >
              <slot name="item" :item="item" :group="group" :index="group.items.indexOf(item)">
                <strong>{{ getItemDisplay(item) }}</strong>
                <span v-if="showItemId && getItemId(item)" class="item-id">
                  {{ $t('sidebar.idLabel', { id: getItemId(item) }) }}
                </span>
              </slot>
            </li>
          </ul>
        </template>

        <p v-if="activeGroupId && !getCurrentGroupItems().length" class="empty-message">
          {{ getEmptyGroupMessage() }}
        </p>

        <p v-else-if="!activeGroupId && hasGroups" class="empty-message">
          {{ resolvedNoGroupSelectedMessage }}
        </p>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 0;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  overflow-y: auto;
  transition: width 0.3s ease-in-out;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
}

.sidebar.is-visible {
  width: 280px;
  padding: 1rem;
}

.sidebar-header {
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  text-align: center;
}

.sidebar-header h3 {
  margin: 0;
  color: #007bff;
  font-size: 1.2em;
}

.sidebar-navigation {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.navigation-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 5px;
}

.navigation-buttons button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 1em;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.navigation-buttons button:hover:not(:disabled) {
  background-color: #0056b3;
}

.navigation-buttons button:disabled {
  background-color: #adb5bd;
  cursor: not-allowed;
  opacity: 0.7;
}

.navigation-info {
  font-size: 0.9em;
  color: #6c757d;
}

.group-selectors {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}

.group-selectors button {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.85em;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
}

.group-selectors button:hover:not(.active) {
  background-color: #5a6268;
  transform: translateY(-1px);
}

.group-selectors button.active {
  background-color: #28a745;
  font-weight: bold;
  cursor: default;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.sidebar-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-item {
  padding: 8px 0;
  border-bottom: 1px dashed #eee;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 0.95em;
}

.sidebar-item:hover {
  background-color: #e2f0ff;
}

.sidebar-item:last-child {
  border-bottom: none;
}

.sidebar-item strong {
  color: #333;
}

.item-id {
  font-size: 0.8em;
  color: #666;
  margin-left: 5px;
}

.empty-message {
  padding: 1rem 0;
  color: #6c757d;
  text-align: center;
  font-style: italic;
  margin: 0;
}

.sidebar.page-sidebar {
  border-right: 1px solid #e0e0e0;
  border-left: none;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
  order: 1;
}

.sidebar.metadata-sidebar {
  border-left: 1px solid #e0e0e0;
  border-right: none;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.05);
  order: 3;
}

.sidebar.page-sidebar.is-visible {
  width: 150px;
}

.item-type-person strong {
  color: #8b0000;
}

.item-type-place strong {
  color: #0f5132;
}

.item-type-org strong {
  color: #6f42c1;
}

.item-type-event strong {
  color: #fd7e14;
}

.page-list .active-page {
  background-color: #e0f7fa;
  font-weight: bold;
  border-left: 3px solid #00bcd4;
  padding-left: 10px;
}
</style>
