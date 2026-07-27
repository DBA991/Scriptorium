<script setup>
defineProps({
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info'
  }
})
</script>

<template>
  <Teleport to="body">
    <transition name="status-toast-fade">
      <div v-if="message" :class="['status-toast', type]">{{ message }}</div>
    </transition>
  </Teleport>
</template>

<style scoped>
.status-toast {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2000;
  max-width: min(24rem, calc(100vw - 1.5rem));
  padding: 0.6rem 0.9rem;
  border-radius: 6px;
  font-size: 0.85rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  word-break: break-word;
}
.status-toast.success {
  background: #1b4332;
  color: #95d5b2;
}
.status-toast.error {
  background: #4a1e1e;
  color: #f8a5a5;
}
.status-toast.info {
  background: #1e3a5f;
  color: #a5c8f8;
}

.status-toast-fade-enter-active,
.status-toast-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.status-toast-fade-enter-from,
.status-toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
