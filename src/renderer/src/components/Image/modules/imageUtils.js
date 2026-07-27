import { v4 as uuidv4 } from 'uuid'

export const defaultFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0
}

export const generateId = () => uuidv4()

export const createBlankPage = (orientation) => {
  const dims =
    orientation === 'portrait' ? { width: 595, height: 842 } : { width: 842, height: 595 }

  return {
    id: uuidv4(),
    ...dims,
    isBlank: true,
    filters: { ...defaultFilters },
    url: createBlankDataUrl(dims),
    thumbnail: createBlankDataUrl({ ...dims, scale: 0.25 })
  }
}

export const createBlankDataUrl = ({ width, height }) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL()
}

export const generateDataUrl = async (path) => {
  const imageData = await window.electronAPI.readImageFile(path)
  const base64 = Buffer.from(imageData.data).toString('base64')
  return `data:${imageData.type};base64,${base64}`
}

export const createImageObject = async (path) => {
  const imageData = await window.electronAPI.readImageFile(path)
  return {
    id: uuidv4(),
    url: imageData.dataUrl,
    thumbnail: imageData.dataUrl,
    path,
    filters: { ...defaultFilters },
    isLocal: true
  }
}
