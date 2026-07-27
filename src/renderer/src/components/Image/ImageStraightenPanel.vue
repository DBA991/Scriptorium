<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  initialAngle: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'update-angle'])

const angle = ref(props.initialAngle)

watch(angle, (newAngle) => {
  emit('update-angle', parseFloat(newAngle) || 0)
})

watch(
  () => props.initialAngle,
  (newInitialAngle) => {
    angle.value = newInitialAngle
  }
)

function decreaseAngle() {
  const currentValue = parseFloat(angle.value) || 0
  angle.value = (currentValue - 0.1).toFixed(1)
}

function increaseAngle() {
  const currentValue = parseFloat(angle.value) || 0
  angle.value = (currentValue + 0.1).toFixed(1)
}

function resetAngle() {
  angle.value = 0
}

function closePanel() {
  emit('close')
}
</script>

<template>
  <div class="straighten-grid"></div>
  <div class="straighten-panel">
    <div class="header">
      <h3>{{ $t('imageStraightenPanel.title') }}</h3>
      <button @click="closePanel" class="close-btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="controls-container">
      <div class="control-item">
        <label>{{ $t('imageStraightenPanel.angleLabel') }}</label>

        <input type="range" min="-360" max="360" step="0.5" v-model="angle" class="slider" />

        <div class="input-group">
          <button class="btn" @click="decreaseAngle" aria-label="Diminuisci angolo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <input type="number" min="-45" max="45" step="0.1" v-model="angle" class="number-input" />

          <button class="btn" @click="increaseAngle" aria-label="Aumenta angolo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="presets">
        <button class="btn" @click="resetAngle">{{ $t('imageStraightenPanel.reset') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.straighten-panel {
  position: absolute;
  top: 80px;
  right: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  width: 320px;
}

.straighten-grid {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.1) 2px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 2px, transparent 1px),
    linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
  background-size:
    20px 20px,
    20px 20px,
    10px 10px,
    10px 10px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.controls-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  position: relative;
  z-index: 10;
}

.control-item label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}
.slider {
  width: 100%;
  margin-bottom: 10px;
}

.input-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.input-group .number-input {
  width: 70px;
  text-align: center;
}

.input-group .btn {
  padding: 6px;
  width: 34px;
  height: 34px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-group .btn svg {
  width: 18px;
  height: 18px;
}

.number-input {
  width: 70px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.presets {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
