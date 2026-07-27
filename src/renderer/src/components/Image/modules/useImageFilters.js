import { ref } from 'vue'

export function useImageFilters(initialFilters) {
  const filtersDefinition = [
    { name: 'brightness', label: 'Luminosità', min: 0, max: 200, default: 100 },
    { name: 'contrast', label: 'Contrasto', min: 0, max: 200, default: 100 },
    { name: 'saturation', label: 'Saturazione', min: 0, max: 200, default: 100 },
    { name: 'hue', label: 'Tonalità', min: -180, max: 180, default: 0 },
    { name: 'grayscale', label: 'Scala di grigi', min: 0, max: 100, default: 0 },
    { name: 'sepia', label: 'Seppia', min: 0, max: 100, default: 0 },
    { name: 'invert', label: 'Inverti colori', min: 0, max: 100, default: 0 }
  ]

  const filterValues = ref({ ...initialFilters })

  function updateFilter(filterName, value) {
    filterValues.value[filterName] = Number(value)
  }

  function resetFilters() {
    filtersDefinition.forEach((filter) => {
      filterValues.value[filter.name] = filter.default
    })
  }

  function applyNegative() {
    const newValue = filterValues.value.invert === 100 ? 0 : 100
    updateFilter('invert', newValue)
  }

  return {
    filtersDefinition,
    filterValues,
    updateFilter,
    resetFilters,
    applyNegative
  }
}
