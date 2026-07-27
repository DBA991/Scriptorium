import { ref, watch, computed, nextTick } from 'vue'
import {
  getMousePosition as getPos,
  draw as performDraw,
  startDraw as beginDraw,
  stopDraw as endDraw,
  clearCanvas as clear
} from './drawingTools'

export function useDrawing(naturalWidth, naturalHeight, canvasRef) {
  const drawing = ref(false)
  const drawColor = ref('#ff0000')
  const drawLineWidth = ref(3)
  const eraserMode = ref(false)

  const drawState = ref({
    drawingState: { active: false, x: 0, y: 0, ctx: null },
    drawColor: drawColor.value,
    drawLineWidth: drawLineWidth.value,
    eraserMode: eraserMode.value
  })

  watch([drawColor, drawLineWidth, eraserMode], () => {
    drawState.value = {
      ...drawState.value,
      drawColor: drawColor.value,
      drawLineWidth: drawLineWidth.value,
      eraserMode: eraserMode.value
    }
  })

  const canvasStyle = computed(() => ({
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${naturalWidth.value}px`,
    height: `${naturalHeight.value}px`
  }))

  const toggleDraw = () => {
    drawing.value = !drawing.value
    if (!drawing.value) {
      if (drawState.value.drawingState) {
        drawState.value.drawingState.active = false
      }
      drawState.value.drawingState.ctx = null
    }
  }

  const startDraw = (e) => {
    if (canvasRef.value && drawing.value) {
      beginDraw(canvasRef.value, e, drawState.value)
    }
  }

  const draw = (e) => {
    if (canvasRef.value && drawing.value) {
      performDraw(canvasRef.value, e, drawState.value)
    }
  }

  const stopDraw = () => {
    endDraw(drawState.value)
  }

  const clearCanvas = () => {
    if (canvasRef.value) {
      clear(canvasRef.value)
    }
  }

  return {
    drawing,
    drawColor,
    drawLineWidth,
    eraserMode,
    canvasStyle,
    toggleDraw,
    startDraw,
    draw,
    stopDraw,
    clearCanvas
  }
}
