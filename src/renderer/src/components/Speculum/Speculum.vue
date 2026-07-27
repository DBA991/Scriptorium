<script setup>
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart, TreemapChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent
} from 'echarts/components'
import 'echarts-wordcloud'
import VChart from 'vue-echarts'
import { useXmlStore } from '@renderer/stores/xmlStore'
import { analyzeXml } from './modules/speculumAnalysis.js'
import { STOPWORD_MODES, getStopwordSet } from './modules/stopwords.js'

use([
  CanvasRenderer,
  BarChart,
  PieChart,
  TreemapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent
])

const xmlStore = useXmlStore()

const config = ref({
  caseSensitive: false,
  minLength: 2,
  excludeNumbers: true,
  excludePunctuation: true,
  language: 'romance',
  topN: 25,
  stopwordMode: 'it',
  customStopwords: '',
  ngramsEnabled: true
})

const analysis = shallowRef(null)
const isAnalyzing = ref(false)
const lastError = ref('')
const lastUpdatedAt = ref(null)
const highlightedWord = ref(null)

let debounceTimer = null

const hasXmlContent = computed(() => !!(xmlStore.xmlContent && xmlStore.xmlContent.trim()))

function runAnalysis() {
  if (!hasXmlContent.value) {
    analysis.value = null
    return
  }
  isAnalyzing.value = true
  lastError.value = ''
  try {
    const stopwordSet = getStopwordSet(config.value.stopwordMode, config.value.customStopwords)
    const result = analyzeXml(xmlStore.xmlContent, {
      caseSensitive: config.value.caseSensitive,
      minLength: config.value.minLength,
      excludeNumbers: config.value.excludeNumbers,
      excludePunctuation: config.value.excludePunctuation,
      language: config.value.language,
      topN: config.value.topN,
      stopwordSet,
      ngramsEnabled: config.value.ngramsEnabled
    })
    analysis.value = result
    lastUpdatedAt.value = new Date()
  } catch (e) {
    console.error('Speculum analysis error:', e)
    lastError.value = e.message || String(e)
  } finally {
    isAnalyzing.value = false
  }
}

function scheduleRun() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runAnalysis, 600)
}

watch(
  () => xmlStore.xmlContent,
  () => {
    if (hasXmlContent.value) scheduleRun()
    else analysis.value = null
  }
)

watch(
  config,
  () => {
    if (hasXmlContent.value) scheduleRun()
  },
  { deep: true }
)

onMounted(() => {
  if (hasXmlContent.value) runAnalysis()
})

const SAVE_AS_IMAGE = {
  type: 'png',
  title: 'Esporta PNG',
  pixelRatio: 2,
  name: 'chart'
}
const COMMON_TOOLBOX = {
  show: true,
  right: 10,
  feature: { saveAsImage: SAVE_AS_IMAGE, dataZoom: { yAxisIndex: 'none' }, restore: {} }
}
const AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#555' } },
  axisLabel: { color: '#bbb' },
  splitLine: { lineStyle: { color: '#333' } }
}

const wordcloudOption = computed(() => {
  const data = (analysis.value?.topWords || []).map((w) => ({
    name: w.word,
    value: w.count
  }))
  return {
    backgroundColor: 'transparent',
    tooltip: { show: true, formatter: (p) => `${p.name}: ${p.value}` },
    toolbox: { ...COMMON_TOOLBOX, feature: { saveAsImage: SAVE_AS_IMAGE } },
    series: [
      {
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '90%',
        height: '90%',
        sizeRange: [12, 60],
        rotationRange: [-45, 45],
        rotationStep: 15,
        gridSize: 8,
        drawOutOfBound: false,
        textStyle: {
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          color: () =>
            'rgb(' + [120, 160, 200].map((b) => b + Math.floor(Math.random() * 55)).join(',') + ')'
        },
        emphasis: { focus: 'self', textStyle: { textShadowBlur: 10, textShadowColor: '#333' } },
        data
      }
    ]
  }
})

function onWordcloudClick(params) {
  if (params && params.name) highlightedWord.value = params.name
}

const freqBarOption = computed(() => {
  const data = (analysis.value?.topWords || []).slice(0, 15)
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p) => p.map((x) => `${x.name}: ${x.value}`).join('<br/>')
    },
    toolbox: { ...COMMON_TOOLBOX },
    xAxis: { type: 'value', ...AXIS_STYLE },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.word).reverse(),
      ...AXIS_STYLE,
      axisLabel: { ...AXIS_STYLE.axisLabel, fontSize: 11 }
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.count).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#0e639c' },
              { offset: 1, color: '#4ec9b0' }
            ]
          }
        },
        label: { show: true, position: 'right', color: '#eee', formatter: '{c}' }
      }
    ]
  }
})

const contentMarkupOption = computed(() => {
  const o = analysis.value?.overview
  if (!o) return {}
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#bbb' } },
    toolbox: { ...COMMON_TOOLBOX, top: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        label: { color: '#ddd' },
        itemStyle: { borderColor: '#1e1e1e', borderWidth: 2 },
        data: [
          { name: 'Contenuto', value: o.contentChars, itemStyle: { color: '#4ec9b0' } },
          { name: 'Markup', value: o.markupChars, itemStyle: { color: '#c586c0' } }
        ]
      }
    ]
  }
})

const contentStopwordOption = computed(() => {
  const o = analysis.value?.overview
  if (!o) return {}
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#bbb' } },
    toolbox: { ...COMMON_TOOLBOX, top: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        label: { color: '#ddd' },
        itemStyle: { borderColor: '#1e1e1e', borderWidth: 2 },
        data: [
          {
            name: 'Parole piene',
            value: o.contentWordOccurrences,
            itemStyle: { color: '#0e639c' }
          },
          { name: 'Parole vuote', value: o.stopwordOccurrences, itemStyle: { color: '#dcdcaa' } }
        ]
      }
    ]
  }
})

const tagBarOption = computed(() => {
  const data = (analysis.value?.tagStats || []).slice(0, 15)
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { ...COMMON_TOOLBOX },
    xAxis: { type: 'value', ...AXIS_STYLE },
    yAxis: {
      type: 'category',
      data: data.map((d) => `<${d.name}>`).reverse(),
      ...AXIS_STYLE
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.count).reverse(),
        itemStyle: { color: '#c586c0' },
        label: { show: true, position: 'right', color: '#eee', formatter: '{c}' }
      }
    ]
  }
})

const verseDistOption = computed(() => {
  const lens = analysis.value?.distributions?.verseWords || []
  if (lens.length === 0) return null
  const buckets = new Map()
  for (const n of lens) buckets.set(n, (buckets.get(n) || 0) + 1)
  const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { ...COMMON_TOOLBOX },
    xAxis: {
      type: 'category',
      name: 'parole/verso',
      nameTextStyle: { color: '#999' },
      data: sorted.map((s) => String(s[0])),
      ...AXIS_STYLE
    },
    yAxis: { type: 'value', name: 'versi', nameTextStyle: { color: '#999' }, ...AXIS_STYLE },
    series: [
      {
        type: 'bar',
        data: sorted.map((s) => s[1]),
        itemStyle: { color: '#4ec9b0' }
      }
    ]
  }
})

const syllableDistOption = computed(() => {
  const lens = analysis.value?.distributions?.verseSyllables || []
  if (lens.length === 0) return null
  const buckets = new Map()
  for (const n of lens) buckets.set(n, (buckets.get(n) || 0) + 1)
  const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { ...COMMON_TOOLBOX },
    xAxis: {
      type: 'category',
      name: 'sillabe (stima)',
      nameTextStyle: { color: '#999' },
      data: sorted.map((s) => String(s[0])),
      ...AXIS_STYLE
    },
    yAxis: { type: 'value', ...AXIS_STYLE },
    series: [
      {
        type: 'bar',
        data: sorted.map((s) => s[1]),
        itemStyle: { color: '#dcdcaa' },
        markLine: {
          symbol: 'none',
          data: [{ type: 'median', label: { color: '#eee' } }],
          lineStyle: { color: '#f8a5a5' }
        }
      }
    ]
  }
})

const wordLengthOption = computed(() => {
  const data = analysis.value?.distributions?.wordLength || []
  if (data.length === 0) return null
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { ...COMMON_TOOLBOX },
    xAxis: {
      type: 'category',
      name: 'lettere',
      nameTextStyle: { color: '#999' },
      data: data.map((d) => String(d.length)),
      ...AXIS_STYLE
    },
    yAxis: { type: 'value', ...AXIS_STYLE },
    series: [{ type: 'bar', data: data.map((d) => d.count), itemStyle: { color: '#9cdcfe' } }]
  }
})

const entityTreemapOption = computed(() => {
  const entities = analysis.value?.entities || {}
  const groups = []
  const palette = {
    person: '#4ec9b0',
    place: '#9cdcfe',
    organization: '#dcdcaa',
    name: '#c586c0',
    title: '#ce9178',
    date: '#f8a5a5',
    term: '#b5cea8',
    bibliography: '#d16969',
    quote: '#6a9955',
    note: '#569cd6'
  }
  for (const [type, list] of Object.entries(entities)) {
    if (!list || list.length === 0) continue
    groups.push({
      name: type,
      itemStyle: { color: palette[type] || '#888' },
      children: list.map((e) => ({ name: e.term || e.id, value: e.count }))
    })
  }
  if (groups.length === 0) return null
  return {
    backgroundColor: 'transparent',
    tooltip: { formatter: (p) => `${p.name}: ${p.value}` },
    toolbox: { ...COMMON_TOOLBOX },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: { show: false },
        label: { color: '#111', show: true, formatter: '{b}' },
        upperLabel: { show: true, height: 22, color: '#eee' },
        data: groups
      }
    ]
  }
})

function pct(n) {
  if (n == null || !isFinite(n)) return '—'
  return (n * 100).toFixed(1) + '%'
}
function num(n) {
  if (n == null || !isFinite(n)) return '—'
  return Number(n).toLocaleString('it-IT')
}
function fixed(n, d = 2) {
  if (n == null || !isFinite(n)) return '—'
  return Number(n).toFixed(d)
}
function formatTime(d) {
  if (!d) return ''
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const entityTypes = computed(() => {
  const entities = analysis.value?.entities || {}
  return Object.keys(entities)
    .filter((k) => entities[k] && entities[k].length > 0)
    .map((k) => ({ type: k, items: entities[k] }))
})

const showCustomStopwords = computed(() => config.value.stopwordMode === 'custom')
</script>

<template>
  <div class="speculum">
    <transition name="fade">
      <div v-if="lastError" class="status-bar error">⚠ {{ lastError }}</div>
    </transition>
    <transition name="fade">
      <div v-if="lastUpdatedAt && !lastError" class="status-bar info">
        {{
          $t('speculum.updatedAt', {
            time: formatTime(lastUpdatedAt),
            tokens: num(analysis?.overview?.tokens)
          })
        }}
      </div>
    </transition>

    <div class="card config-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">{{ $t('speculum.title') }}</h3>
          <p class="text-sm text-secondary">
            {{ $t('speculum.sourceDescPart1') }}
            <strong>{{ $t('speculum.sourceDescPart2') }}</strong>
            <span v-if="!hasXmlContent" class="warning-inline">
              {{ $t('speculum.noDocumentWarning') }}</span
            >
          </p>
        </div>
        <div class="config-actions">
          <button
            class="btn btn-primary"
            :disabled="!hasXmlContent || isAnalyzing"
            @click="runAnalysis"
          >
            {{ isAnalyzing ? $t('speculum.analyzingInProgress') : $t('speculum.update') }}
          </button>
        </div>
      </div>

      <div class="config-grid">
        <div class="form-group">
          <label class="form-label">{{ $t('speculum.tokenizationLanguageLabel') }}</label>
          <select v-model="config.language" class="form-select">
            <option value="romance">{{ $t('speculum.languageRomance') }}</option>
            <option value="saxon">{{ $t('speculum.languageSaxon') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('speculum.stopwordsLabel') }}</label>
          <select v-model="config.stopwordMode" class="form-select">
            <option v-for="m in STOPWORD_MODES" :key="m.value" :value="m.value">
              {{ m.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('speculum.minLengthLabel') }}</label>
          <input v-model.number="config.minLength" type="number" min="1" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('speculum.topNLabel') }}</label>
          <input v-model.number="config.topN" type="number" min="5" class="form-input" />
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-row">
            <input v-model="config.caseSensitive" type="checkbox" />
            <span>{{ $t('speculum.caseSensitive') }}</span>
          </label>
          <label class="checkbox-row">
            <input v-model="config.excludeNumbers" type="checkbox" />
            <span>{{ $t('speculum.excludeNumbers') }}</span>
          </label>
          <label class="checkbox-row">
            <input v-model="config.excludePunctuation" type="checkbox" />
            <span>{{ $t('speculum.excludePunctuation') }}</span>
          </label>
          <label class="checkbox-row">
            <input v-model="config.ngramsEnabled" type="checkbox" />
            <span>{{ $t('speculum.ngrams') }}</span>
          </label>
        </div>
      </div>

      <div v-if="showCustomStopwords" class="custom-stopwords">
        <label class="form-label">{{ $t('speculum.customStopwordsLabel') }}</label>
        <textarea
          v-model="config.customStopwords"
          class="form-textarea"
          rows="2"
          :placeholder="$t('speculum.customStopwordsPlaceholder')"
        ></textarea>
      </div>
    </div>

    <div v-if="!analysis && hasXmlContent" class="card empty-state">
      <p class="text-secondary">
        {{ $t('speculum.emptyStatePrompt') }} <strong>{{ $t('speculum.emptyStateAction') }}</strong>
        {{ $t('speculum.emptyStateSuffix') }}
      </p>
    </div>
    <div v-else-if="!hasXmlContent" class="card empty-state">
      <p class="text-secondary">{{ $t('speculum.noDocumentTitle') }}</p>
      <p class="text-xs text-secondary">
        {{ $t('speculum.noDocumentHint') }}
      </p>
    </div>

    <template v-if="analysis">
      <div class="card stats-card">
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.tokens) }}</span
          ><span class="stat-label">{{ $t('speculum.statTokens') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.types) }}</span
          ><span class="stat-label">{{ $t('speculum.statTypes') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ fixed(analysis.overview.ttr, 3) }}</span
          ><span class="stat-label">{{ $t('speculum.statTtr') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.hapaxCount) }}</span
          ><span class="stat-label">{{ $t('speculum.statHapax') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ fixed(analysis.overview.averageWordLength, 2) }}</span
          ><span class="stat-label">{{ $t('speculum.statAvgWordLength') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.verses) }}</span
          ><span class="stat-label">{{ $t('speculum.statVerses') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.paragraphs) }}</span
          ><span class="stat-label">{{ $t('speculum.statParagraphs') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.stanzas) }}</span
          ><span class="stat-label">{{ $t('speculum.statStanzas') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.sentences) }}</span
          ><span class="stat-label">{{ $t('speculum.statSentences') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.elements) }}</span
          ><span class="stat-label">{{ $t('speculum.statElements') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.attributes) }}</span
          ><span class="stat-label">{{ $t('speculum.statAttributes') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ pct(analysis.overview.contentRatio) }}</span
          ><span class="stat-label">{{ $t('speculum.statContent') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ pct(analysis.overview.markupRatio) }}</span
          ><span class="stat-label">{{ $t('speculum.statMarkup') }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ num(analysis.overview.characters) }}</span
          ><span class="stat-label">{{ $t('speculum.statCharacters') }}</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="card chart-card">
          <div class="card-header">
            <h3 class="card-title">{{ $t('speculum.wordcloudTitle') }}</h3>
            <span v-if="highlightedWord" class="chip">{{
              $t('speculum.wordcloudSelected', { word: highlightedWord })
            }}</span>
          </div>
          <v-chart
            v-if="analysis.topWords.length"
            class="chart"
            :option="wordcloudOption"
            autoresize
            @click="onWordcloudClick"
          />
          <p v-else class="empty-mini">{{ $t('speculum.wordcloudEmpty') }}</p>
        </div>

        <div class="card chart-card">
          <div class="card-header">
            <h3 class="card-title">{{ $t('speculum.topWordsTitle') }}</h3>
          </div>
          <v-chart class="chart" :option="freqBarOption" autoresize />
        </div>
      </div>

      <div class="grid-3">
        <div class="card chart-card">
          <h3 class="card-title">{{ $t('speculum.contentVsMarkupTitle') }}</h3>
          <v-chart class="chart" :option="contentMarkupOption" autoresize />
        </div>
        <div class="card chart-card">
          <h3 class="card-title">{{ $t('speculum.fullVsEmptyWordsTitle') }}</h3>
          <v-chart class="chart" :option="contentStopwordOption" autoresize />
        </div>
        <div class="card chart-card">
          <h3 class="card-title">{{ $t('speculum.topTagsTitle') }}</h3>
          <v-chart class="chart" :option="tagBarOption" autoresize />
        </div>
      </div>

      <div class="grid-3">
        <div v-if="verseDistOption" class="card chart-card">
          <h3 class="card-title">{{ $t('speculum.wordsPerVerseTitle') }}</h3>
          <v-chart class="chart" :option="verseDistOption" autoresize />
        </div>
        <div v-if="syllableDistOption" class="card chart-card">
          <h3 class="card-title">
            {{ $t('speculum.syllablesPerVerseTitle') }}
            <span class="tag-estim">{{ $t('speculum.estimateTag') }}</span>
          </h3>
          <v-chart class="chart" :option="syllableDistOption" autoresize />
        </div>
        <div v-if="wordLengthOption" class="card chart-card">
          <h3 class="card-title">{{ $t('speculum.wordLengthTitle') }}</h3>
          <v-chart class="chart" :option="wordLengthOption" autoresize />
        </div>
      </div>

      <div v-if="entityTreemapOption" class="card chart-card">
        <div class="card-header">
          <h3 class="card-title">{{ $t('speculum.entitiesTitle') }}</h3>
          <span class="text-xs text-secondary">{{ $t('speculum.entitiesHint') }}</span>
        </div>
        <v-chart class="chart tall" :option="entityTreemapOption" autoresize />
      </div>

      <div class="grid-2">
        <div class="card list-card">
          <div class="card-header">
            <h3 class="card-title">
              {{ $t('speculum.hapaxTitle', { count: analysis.hapax.length }) }}
            </h3>
            <span class="text-xs text-secondary">{{
              $t('speculum.hapaxRatio', { ratio: pct(analysis.overview.hapaxRatio) })
            }}</span>
          </div>
          <div class="tag-cloud">
            <span v-for="w in analysis.hapax.slice(0, 300)" :key="w" class="tag-chip hapax">{{
              w
            }}</span>
          </div>
        </div>

        <div class="card list-card" v-if="config.ngramsEnabled">
          <div class="card-header">
            <h3 class="card-title">{{ $t('speculum.bigramsTitle') }}</h3>
          </div>
          <ol class="ranked-list">
            <li v-for="(g, i) in analysis.bigrams.slice(0, 20)" :key="'b' + i">
              <span class="rank">{{ i + 1 }}</span>
              <span class="rank-term">{{ g.name }}</span>
              <span class="rank-count">{{ g.count }}</span>
            </li>
          </ol>
          <div class="card-header sub">
            <h3 class="card-title">{{ $t('speculum.trigramsTitle') }}</h3>
          </div>
          <ol class="ranked-list">
            <li v-for="(g, i) in analysis.trigrams.slice(0, 15)" :key="'t' + i">
              <span class="rank">{{ i + 1 }}</span>
              <span class="rank-term">{{ g.name }}</span>
              <span class="rank-count">{{ g.count }}</span>
            </li>
          </ol>
        </div>
      </div>

      <div v-if="entityTypes.length" class="card list-card">
        <div class="card-header">
          <h3 class="card-title">{{ $t('speculum.entitiesByTypeTitle') }}</h3>
        </div>
        <div class="entity-grid">
          <div v-for="group in entityTypes" :key="group.type" class="entity-block">
            <h4 class="entity-type">{{ group.type }} ({{ group.items.length }})</h4>
            <ol class="ranked-list">
              <li v-for="(item, i) in group.items.slice(0, 20)" :key="group.type + i">
                <span class="rank">{{ i + 1 }}</span>
                <span class="rank-term">{{ item.term }}</span>
                <span class="rank-count">{{ item.count }}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.speculum {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #fff;
  padding: 1rem;
  box-sizing: border-box;
  overflow-y: auto;
  gap: 0.75rem;
}

.status-bar {
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
  flex-shrink: 0;
}
.status-bar.success {
  background: #1b4332;
  color: #95d5b2;
}
.status-bar.error {
  background: #4a1e1e;
  color: #f8a5a5;
}
.status-bar.info {
  background: #1e3a5f;
  color: #a5c8f8;
}

.card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 1rem;
  flex-shrink: 0;
}
.card-title {
  margin: 0 0 0.4rem 0;
  font-size: 0.95rem;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.card-header.sub {
  margin-top: 0.75rem;
}

.config-card {
  flex-shrink: 0;
}
.config-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
  margin: 0.5rem 0;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.form-label {
  font-size: 0.75rem;
  color: #ccc;
}
.form-input,
.form-select {
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}
.form-textarea {
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.4rem;
  font-size: 0.8rem;
  width: 100%;
  box-sizing: border-box;
}
.checkbox-group {
  justify-content: center;
  gap: 0.5rem;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
}
.config-actions {
  display: flex;
  gap: 0.5rem;
}
.custom-stopwords {
  margin-top: 0.5rem;
}
.warning-inline {
  color: #f5d98a;
}

.stats-card {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem 2rem;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 70px;
}
.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #4ec9b0;
}
.stat-label {
  font-size: 0.68rem;
  color: #999;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.chart-card {
  display: flex;
  flex-direction: column;
}
.chart {
  width: 100%;
  height: 320px;
}
.chart.tall {
  height: 360px;
}
.empty-mini {
  color: #888;
  font-size: 0.82rem;
  padding: 1rem 0;
}
.chip {
  background: #0e639c;
  color: #fff;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
}
.tag-estim {
  font-size: 0.62rem;
  background: #4a3a1e;
  color: #f5d98a;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  margin-left: 0.3rem;
}

.list-card {
  max-height: none;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.tag-chip {
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  color: #ccc;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.78rem;
}
.tag-chip.hapax {
  color: #dcdcaa;
  border-color: #4a3a1e;
}

.ranked-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.ranked-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.3rem;
  border-bottom: 1px solid #2d2d2d;
  font-size: 0.82rem;
}
.rank {
  color: #888;
  width: 24px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rank-term {
  flex: 1;
  color: #ddd;
}
.rank-count {
  background: #3c3c3c;
  color: #4ec9b0;
  padding: 0.1rem 0.45rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
}

.entity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.entity-block h4.entity-type {
  margin: 0 0 0.4rem 0;
  font-size: 0.85rem;
  color: #c586c0;
  text-transform: capitalize;
}

.empty-state {
  text-align: center;
  padding: 1.5rem 0.5rem;
  font-size: 0.88rem;
}
.text-xs {
  font-size: 0.72rem;
}
.text-sm {
  font-size: 0.82rem;
}
.text-secondary {
  color: #999;
}

.btn {
  background: #3a3d41;
  border: none;
  color: #fff;
  padding: 0.4rem 0.7rem;
  font-size: 0.82rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) {
  background: #55595e;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-primary {
  background: #0e639c;
}
.btn-primary:hover:not(:disabled) {
  background: #1177bb;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style>
body {
  display: block;
  justify-content: initial;
  align-items: initial;
  background-color: #1e1e1e;
}
</style>
