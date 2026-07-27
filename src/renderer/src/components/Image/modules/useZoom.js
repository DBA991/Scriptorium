import { ref, computed, watch, nextTick } from 'vue'

export function useZoom(wrapperRef, naturalWidth, naturalHeight) {
  const zoom = ref(1)
  const zoomInput = ref(100)
  const showZoomModal = ref(false)

  const centerImage = () => {
    nextTick(() => {
      if (wrapperRef.value) {
        wrapperRef.value.scrollLeft =
          (wrapperRef.value.scrollWidth - wrapperRef.value.clientWidth) / 2
        wrapperRef.value.scrollTop =
          (wrapperRef.value.scrollHeight - wrapperRef.value.clientHeight) / 2
      }
    })
  }

  const zoomIn = () => {
    zoom.value = Math.min(zoom.value + 0.1, 3)
    centerImage()
  }

  const zoomOut = () => {
    zoom.value = Math.max(zoom.value - 0.1, 0.2)
    centerImage()
  }

  const resetZoom = () => {
    zoom.value = 1
    centerImage()
  }

  const updateZoomFromInput = () => {
    const parsed = parseInt(zoomInput.value)
    zoom.value = Math.min(Math.max(parsed || 100, 20), 300) / 100
    centerImage()
  }

  const toggleZoom = () => (showZoomModal.value = !showZoomModal.value)

  watch(zoom, (val) => (zoomInput.value = Math.round(val * 100)))

  const containerStyle = computed(() => ({
    position: 'relative',
    width: `${naturalWidth.value}px`,
    height: `${naturalHeight.value}px`,
    transform: `scale(${zoom.value})`,
    transformOrigin: '0 0'
  }))

  return {
    zoom,
    zoomInput,
    showZoomModal,
    containerStyle,
    toggleZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    updateZoomFromInput,
    centerImage
  }
}
