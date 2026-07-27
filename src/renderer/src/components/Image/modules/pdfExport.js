export const getNaturalWidth = (url) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = url
    img.onload = () => resolve(img.naturalWidth)
  })
}

export const getNaturalHeight = (url) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = url
    img.onload = () => resolve(img.naturalHeight)
  })
}

export const buildPdfPageDescriptors = (images) => {
  return images.map((imgObj) => {
    const isBlank = !!imgObj.isBlank

    if (isBlank) {
      return {
        width: imgObj.width || 595,
        height: imgObj.height || 842,
        isBlank: true
      }
    }

    return {
      width: imgObj.width || null,
      height: imgObj.height || null,
      isBlank: false,
      path: imgObj.path
    }
  })
}
