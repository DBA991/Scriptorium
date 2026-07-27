export const getMousePosition = (canvas, e) => {
  if (!canvas) return { x: 0, y: 0 }

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  }
}

export const startDraw = (canvas, e, state) => {
  if (!state || !canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const pos = getMousePosition(canvas, e)

  state.drawingState = {
    active: true,
    x: pos.x,
    y: pos.y,
    ctx
  }

  ctx.strokeStyle = state.eraserMode ? 'rgba(0,0,0,1)' : state.drawColor
  ctx.lineWidth = state.drawLineWidth
  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = state.eraserMode ? 'destination-out' : 'source-over'
}

export const draw = (canvas, e, state) => {
  if (!state?.drawingState?.active || !canvas) return

  const { ctx, x: startX, y: startY } = state.drawingState
  if (!ctx) {
    console.error('Errore: Contesto disegno mancante nello stato!')
    return
  }
  const pos = getMousePosition(canvas, e)

  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(pos.x, pos.y)
  ctx.stroke()

  state.drawingState.x = pos.x
  state.drawingState.y = pos.y
}

export const stopDraw = (state) => {
  if (state?.drawingState) {
    state.drawingState.active = false
  }
}

export const clearCanvas = (canvas) => {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}
