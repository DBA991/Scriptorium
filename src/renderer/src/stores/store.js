import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useProjectStore = defineStore('project', () => {
  const data = ref({
    name: '',
    items: [],
    metadata: {}
  })
  const undoStack = ref([])
  const redoStack = ref([])

  function undo() {
    if (undoStack.value.length === 0) return
    const snapshot = undoStack.value.pop()
    redoStack.value.push(JSON.parse(JSON.stringify(data.value)))
    data.value = snapshot
  }

  function redo() {
    if (redoStack.value.length === 0) return
    const snapshot = redoStack.value.pop()
    undoStack.value.push(JSON.parse(JSON.stringify(data.value)))
    data.value = snapshot
  }

  async function saveSession() {
    const storeData = await window.electronAPI.storeGetAll()
    if (!storeData) return
    await window.electronAPI.saveSessionToFile(storeData)
  }

  async function loadSession() {
    await window.electronAPI.loadSessionFromFile()
  }

  async function resetSession() {
    await window.electronAPI.resetWithReload()
  }

  return {
    data,
    undoStack,
    redoStack,

    undo,
    redo,
    saveSession,
    loadSession,
    resetSession
  }
})
