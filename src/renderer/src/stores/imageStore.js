import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createImageObject, createBlankPage } from '../components/Image/modules/imageUtils'
import { buildPdfPageDescriptors } from '../components/Image/modules/pdfExport'

export const useImageStore = defineStore('imageStore', () => {
  const images = ref([])
  const currentImageIndex = ref(-1)
  const missingImagePaths = ref([])

  const hasImages = computed(() => images.value.length > 0)
  const currentImage = computed(() => images.value[currentImageIndex.value] || null)

  async function save() {
    const serializableImages = images.value.map((img) => {
      if (img.isBlank) {
        return {
          id: img.id,
          width: img.width,
          height: img.height,
          isBlank: true,
          ...(img.missingSource ? { missingSource: true, originalPath: img.originalPath } : {})
        }
      }
      return {
        id: img.id,
        path: img.path,
        width: img.width,
        height: img.height,
        isLocal: true
      }
    })
    await window.electronAPI.storeSet('images', serializableImages)
    await window.electronAPI.storeSet('currentIndex', currentImageIndex.value)
  }

  async function addImages(files) {
    if (!files.length) return 0
    let failedCount = 0
    const newImages = await Promise.all(
      files.map(async (path) => {
        try {
          return await createImageObject(path)
        } catch {
          failedCount += 1
          missingImagePaths.value.push(path)
          const placeholder = createBlankPage('portrait')
          return { ...placeholder, missingSource: true, originalPath: path }
        }
      })
    )
    images.value.push(...newImages)
    if (currentImageIndex.value === -1) currentImageIndex.value = 0
    save()
    return failedCount
  }

  function addBlankPage(orientation) {
    const blankPage = createBlankPage(orientation)
    images.value.push(blankPage)
    currentImageIndex.value = images.value.length - 1
    save()
  }

  function removeImage(index) {
    if (index >= 0 && index < images.value.length) {
      images.value.splice(index, 1)
      if (images.value.length === 0) {
        currentImageIndex.value = -1
      } else if (currentImageIndex.value >= images.value.length) {
        currentImageIndex.value = images.value.length - 1
      }
      save()
    }
  }

  function removeCurrentImage() {
    if (currentImageIndex.value !== -1) removeImage(currentImageIndex.value)
  }

  function setCurrentImageIndex(index) {
    if (index >= -1 && index < images.value.length) {
      currentImageIndex.value = index
    }
    save()
  }

  function updateFiltersForImage({ index, filters }) {
    if (images.value[index]) {
      images.value[index].filters = { ...filters }
    }
  }

  function updateDimensionsForImage({ index, width, height }) {
    if (images.value[index]) {
      images.value[index].width = width
      images.value[index].height = height
      save()
    }
  }

  function updateRotationForImage({ index, angle }) {
    if (images.value[index]) {
      images.value[index].rotation = angle
    }
  }

  function setImages(newImages) {
    images.value = newImages
    save()
  }

  async function exportToPdf() {
    if (images.value.length === 0) return
    const pages = await buildPdfPageDescriptors(images.value)
    return await window.electronAPI.exportPdf(pages)
  }

  async function init() {
    const savedImages = (await window.electronAPI.storeGet('images')) || []
    missingImagePaths.value = []

    images.value = (
      await Promise.all(
        savedImages.map(async (img) => {
          if (!img) return null
          if (img.isBlank) {
            if (img.missingSource && img.originalPath) {
              try {
                const recovered = await createImageObject(img.originalPath)
                return { ...recovered, id: img.id || recovered.id }
              } catch {
                missingImagePaths.value.push(img.originalPath)
                const orientation =
                  (img.width || 595) > (img.height || 842) ? 'landscape' : 'portrait'
                const placeholder = createBlankPage(orientation)
                return {
                  ...placeholder,
                  id: img.id || placeholder.id,
                  width: img.width || placeholder.width,
                  height: img.height || placeholder.height,
                  missingSource: true,
                  originalPath: img.originalPath
                }
              }
            }
            const orientation = (img.width || 595) > (img.height || 842) ? 'landscape' : 'portrait'
            const newBlankPage = createBlankPage(orientation)
            return { ...newBlankPage, ...img, id: img.id || newBlankPage.id }
          }
          if (img.path) {
            try {
              const newImageObject = await createImageObject(img.path)
              return { ...newImageObject, ...img, id: img.id || newImageObject.id }
            } catch {
              missingImagePaths.value.push(img.path)
              const orientation =
                (img.width || 595) > (img.height || 842) ? 'landscape' : 'portrait'
              const placeholder = createBlankPage(orientation)
              return {
                ...placeholder,
                id: img.id || placeholder.id,
                width: img.width || placeholder.width,
                height: img.height || placeholder.height,
                missingSource: true,
                originalPath: img.path
              }
            }
          }
          return null
        })
      )
    ).filter(Boolean)

    const savedIndex = await window.electronAPI.storeGet('currentIndex')
    currentImageIndex.value = savedIndex ?? (images.value.length > 0 ? 0 : -1)
  }

  function regenerateImageUrls() {
    images.value = images.value.map((img) => ({
      ...img,
      url: img.path ? `file://${img.path}` : img.url,
      thumbnail: img.thumbnailPath ? `file://${img.thumbnailPath}` : img.thumbnail
    }))
  }

  return {
    images,
    currentImageIndex,
    missingImagePaths,

    hasImages,
    currentImage,

    init,
    save,
    addImages,
    addBlankPage,
    removeImage,
    removeCurrentImage,
    setCurrentImageIndex,
    updateFiltersForImage,
    updateDimensionsForImage,
    updateRotationForImage,
    setImages,
    exportToPdf,
    regenerateImageUrls
  }
})
