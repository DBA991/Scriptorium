import { ref } from 'vue'

const DEFAULT_TIMEOUT_MS = 4000

export function useNotify(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const statusMessage = ref('')
  const statusType = ref('')

  function notify(message, type = 'info') {
    statusMessage.value = message
    statusType.value = type
    setTimeout(() => {
      if (statusMessage.value === message) statusMessage.value = ''
    }, timeoutMs)
  }

  return { statusMessage, statusType, notify }
}
