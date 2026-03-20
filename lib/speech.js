'use client'

let activeSpeechSessionId = 0
let activeSpeechPlayback = null
const SPEECH_IGNORE_SELECTOR = 'code, pre, textarea, input, script, style, [data-speech-ignore="true"]'
const ACTIVE_SPEECH_TOKEN_CLASSES = [
  'inline-block',
  'rounded-md',
  'bg-amber-200',
  'dark:bg-amber-300',
  'text-slate-900',
  'dark:text-slate-950',
  'ring-1',
  'ring-amber-500/40',
  'px-1',
  'shadow-sm'
]
const SPEECH_CACHE_PREFIX = 'path-pro:tts-cache:v1:'
const SPEECH_CACHE_INDEX_KEY = `${SPEECH_CACHE_PREFIX}index`
const SPEECH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SPEECH_CACHE_MAX_ENTRIES = 12
const SPEECH_CACHE_MAX_TOTAL_CHARS = 4_000_000
const SPEECH_CACHE_MAX_ENTRY_CHARS = 1_500_000

function removeCodeFences(value) {
  return String(value || '').replace(/```([\s\S]*?)```/g, ' Code block omitted. ')
}

function removeInlineCode(value) {
  return value.replace(/`([^`]+)`/g, '$1')
}

function removeMarkdownLinks(value) {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
}

function hasLocalStorageSupport() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

function safeParseJson(value, fallbackValue) {
  try {
    return JSON.parse(value)
  } catch {
    return fallbackValue
  }
}

function createSpeechCacheHash(value) {
  let hash = 5381

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  }

  return (hash >>> 0).toString(36)
}

function createSpeechCacheKey({ text, voiceName, locale, route }) {
  const signature = JSON.stringify({
    text,
    voiceName: voiceName || '',
    locale: locale || '',
    route: route || '/api/tts'
  })

  return `${SPEECH_CACHE_PREFIX}${createSpeechCacheHash(signature)}:${text.length}`
}

function getSpeechCacheIndex() {
  if (!hasLocalStorageSupport()) {
    return []
  }

  return safeParseJson(window.localStorage.getItem(SPEECH_CACHE_INDEX_KEY) || '[]', [])
}

function setSpeechCacheIndex(index) {
  if (!hasLocalStorageSupport()) {
    return
  }

  window.localStorage.setItem(SPEECH_CACHE_INDEX_KEY, JSON.stringify(index))
}

function removeSpeechCacheEntry(cacheKey) {
  if (!hasLocalStorageSupport()) {
    return
  }

  try {
    window.localStorage.removeItem(cacheKey)
    const nextIndex = getSpeechCacheIndex().filter((entry) => entry?.key !== cacheKey)
    setSpeechCacheIndex(nextIndex)
  } catch {}
}

function pruneSpeechCache(extraCharacters = 0) {
  if (!hasLocalStorageSupport()) {
    return
  }

  const now = Date.now()
  let index = getSpeechCacheIndex()
    .filter((entry) => entry?.key && typeof entry.size === 'number')
    .filter((entry) => {
      const isExpired = now - Number(entry.updatedAt || 0) > SPEECH_CACHE_TTL_MS
      if (isExpired) {
        try {
          window.localStorage.removeItem(entry.key)
        } catch {}
      }
      return !isExpired
    })

  let totalSize = index.reduce((sum, entry) => sum + entry.size, 0)
  index.sort((first, second) => Number(first.updatedAt || 0) - Number(second.updatedAt || 0))

  while (
    index.length > SPEECH_CACHE_MAX_ENTRIES - 1
    || totalSize + extraCharacters > SPEECH_CACHE_MAX_TOTAL_CHARS
  ) {
    const oldest = index.shift()
    if (!oldest) {
      break
    }

    try {
      window.localStorage.removeItem(oldest.key)
    } catch {}
    totalSize -= oldest.size
  }

  setSpeechCacheIndex(index)
}

function loadSpeechPayloadFromCache(cacheKey) {
  if (!hasLocalStorageSupport()) {
    return null
  }

  try {
    const rawEntry = window.localStorage.getItem(cacheKey)
    if (!rawEntry) {
      return null
    }

    const entry = safeParseJson(rawEntry, null)
    if (!entry?.payload || (Date.now() - Number(entry.savedAt || 0)) > SPEECH_CACHE_TTL_MS) {
      removeSpeechCacheEntry(cacheKey)
      return null
    }

    const index = getSpeechCacheIndex()
    const nextIndex = [
      ...index.filter((item) => item?.key !== cacheKey),
      {
        key: cacheKey,
        size: rawEntry.length,
        updatedAt: Date.now()
      }
    ]
    setSpeechCacheIndex(nextIndex)

    return entry.payload
  } catch {
    removeSpeechCacheEntry(cacheKey)
    return null
  }
}

function saveSpeechPayloadToCache(cacheKey, payload) {
  if (!hasLocalStorageSupport()) {
    return
  }

  try {
    const rawEntry = JSON.stringify({
      savedAt: Date.now(),
      payload
    })

    if (rawEntry.length > SPEECH_CACHE_MAX_ENTRY_CHARS) {
      return
    }

    pruneSpeechCache(rawEntry.length)
    window.localStorage.setItem(cacheKey, rawEntry)

    const nextIndex = [
      ...getSpeechCacheIndex().filter((entry) => entry?.key !== cacheKey),
      {
        key: cacheKey,
        size: rawEntry.length,
        updatedAt: Date.now()
      }
    ]

    setSpeechCacheIndex(nextIndex)
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      try {
        pruneSpeechCache(SPEECH_CACHE_MAX_ENTRY_CHARS)
      } catch {}
    }
  }
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && typeof window.Audio !== 'undefined' && typeof window.fetch === 'function'
}

export function stopSpeechSynthesis() {
  activeSpeechSessionId += 1

  if (!activeSpeechPlayback) {
    return
  }

  const playback = activeSpeechPlayback
  activeSpeechPlayback = null

  if (playback.rafId) {
    window.cancelAnimationFrame(playback.rafId)
  }

  if (playback.audio) {
    playback.audio.pause()
    playback.audio.src = ''
  }

  if (playback.objectUrl) {
    URL.revokeObjectURL(playback.objectUrl)
  }

  if (playback.abortController) {
    playback.abortController.abort()
  }
}


export function clearSpeechHighlights(container) {
  if (!container) {
    return
  }

  const highlights = container.querySelectorAll('[data-tts-highlight="true"]')
  highlights.forEach((highlight) => {
    const parent = highlight.parentNode
    if (!parent) {
      return
    }

    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight)
    }

    parent.removeChild(highlight)
    parent.normalize()
  })
}

export function clearSpeechTokenHighlights(container) {
  if (!container) {
    return
  }

  const activeTokens = container.querySelectorAll('[data-tts-token-active="true"]')
  activeTokens.forEach((token) => {
    token.dataset.ttsTokenActive = 'false'
    token.classList.remove(...ACTIVE_SPEECH_TOKEN_CLASSES)
  })
}

function deactivateSpeechToken(tokenEntry) {
  if (!tokenEntry?.element) {
    return
  }

  tokenEntry.element.dataset.ttsTokenActive = 'false'
  tokenEntry.element.classList.remove(...ACTIVE_SPEECH_TOKEN_CLASSES)
}

export function clearSpeechTokenWrappers(container) {
  if (!container) {
    return
  }

  const tokens = [...container.querySelectorAll('[data-tts-token="true"]')]
  tokens.reverse().forEach((token) => {
    const parent = token.parentNode
    if (!parent) {
      return
    }

    parent.replaceChild(document.createTextNode(token.textContent || ''), token)
    parent.normalize()
  })
}

export function extractSpeechTextFromContainer(container) {
  if (!container) {
    return ''
  }

  const clone = container.cloneNode(true)
  clone.querySelectorAll(SPEECH_IGNORE_SELECTOR).forEach((node) => {
    node.remove()
  })

  return String(clone.innerText || clone.textContent || '').trim()
}

export function highlightSpeechRange(container, start, end) {
  if (!container || typeof start !== 'number' || typeof end !== 'number' || end <= start) {
    return
  }

  clearSpeechHighlights(container)

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent && node.textContent.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    }
  })

  const nodes = []
  let currentNode = walker.nextNode()
  let currentOffset = 0

  while (currentNode) {
    const length = currentNode.textContent.length
    nodes.push({
      node: currentNode,
      start: currentOffset,
      end: currentOffset + length
    })
    currentOffset += length
    currentNode = walker.nextNode()
  }

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const entry = nodes[index]
    const overlapStart = Math.max(start, entry.start)
    const overlapEnd = Math.min(end, entry.end)

    if (overlapEnd <= overlapStart) {
      continue
    }

    let targetNode = entry.node
    const startOffset = overlapStart - entry.start
    const endOffset = overlapEnd - entry.start

    if (startOffset > 0) {
      targetNode = targetNode.splitText(startOffset)
    }

    if (endOffset - startOffset < targetNode.textContent.length) {
      targetNode.splitText(endOffset - startOffset)
    }

    const marker = document.createElement('mark')
    marker.dataset.ttsHighlight = 'true'
    marker.className = 'rounded bg-amber-300/70 px-0.5 text-inherit dark:bg-amber-400/40'
    targetNode.parentNode.insertBefore(marker, targetNode)
    marker.appendChild(targetNode)
  }
}

export function normalizeTextForSpeech(value) {
  const withoutCodeBlocks = removeCodeFences(value)
  const withoutInlineCode = removeInlineCode(withoutCodeBlocks)
  const withoutLinks = removeMarkdownLinks(withoutInlineCode)

  return withoutLinks
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[\.\)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function buildSpeechIndexMap(value) {
  const source = String(value || '')
  const indexMap = []
  let normalized = ''
  let previousWasWhitespace = true

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const isWhitespace = /\s/.test(char)

    if (isWhitespace) {
      if (!previousWasWhitespace && normalized.length > 0) {
        indexMap.push(index)
        normalized += ' '
      }
      previousWasWhitespace = true
      continue
    }

    indexMap.push(index)
    normalized += char
    previousWasWhitespace = false
  }

  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    indexMap.pop()
  }

  return {
    text: normalized,
    indexMap
  }
}

function normalizeSpeechToken(value) {
  return String(value || '')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .toLowerCase()
}

export function buildSpeechWordMap(value) {
  const source = String(value || '')
  const pattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu
  const words = []
  let match

  while ((match = pattern.exec(source)) !== null) {
    words.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      normalized: normalizeSpeechToken(match[0])
    })
  }

  return words
}

export function findNextSpeechWordMatch(wordMap, targetWord, lastMatchedIndex = -1) {
  if (!Array.isArray(wordMap) || wordMap.length === 0) {
    return null
  }

  const normalizedTarget = normalizeSpeechToken(targetWord)
  if (!normalizedTarget) {
    return null
  }

  for (let index = Math.max(-1, lastMatchedIndex) + 1; index < wordMap.length; index += 1) {
    if (wordMap[index].normalized === normalizedTarget) {
      return {
        ...wordMap[index],
        index
      }
    }
  }

  return null
}

export function prepareSpeechTokenMap(container) {
  if (!container) {
    return []
  }

  clearSpeechTokenHighlights(container)
  clearSpeechTokenWrappers(container)

  const pattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement
      if (!node.textContent?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      if (parentElement?.closest(SPEECH_IGNORE_SELECTOR)) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes = []
  let node = walker.nextNode()
  while (node) {
    textNodes.push(node)
    node = walker.nextNode()
  }

  const tokens = []

  textNodes.forEach((textNode) => {
    const text = textNode.textContent || ''
    const matches = [...text.matchAll(pattern)]
    if (matches.length === 0 || !textNode.parentNode) {
      return
    }

    const fragment = document.createDocumentFragment()
    let cursor = 0

    matches.forEach((match) => {
      const matchIndex = match.index ?? 0
      const wordText = match[0]

      if (matchIndex > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, matchIndex)))
      }

      const span = document.createElement('span')
      span.textContent = wordText
      span.dataset.ttsToken = 'true'
      span.dataset.ttsTokenActive = 'false'
      span.dataset.ttsTokenNormalized = normalizeSpeechToken(wordText)
      fragment.appendChild(span)
      tokens.push(span)

      cursor = matchIndex + wordText.length
    })

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)))
    }

    textNode.parentNode.replaceChild(fragment, textNode)
  })

  return tokens.map((token, index) => ({
    element: token,
    index,
    normalized: token.dataset.ttsTokenNormalized || '',
    text: token.textContent || ''
  }))
}

export function activateSpeechToken(tokenEntry) {
  if (!tokenEntry?.element) {
    return
  }

  tokenEntry.element.dataset.ttsTokenActive = 'true'
  tokenEntry.element.classList.add(...ACTIVE_SPEECH_TOKEN_CLASSES)
}

export function mapSpeechRangeToSource(indexMap, start, end) {
  if (!Array.isArray(indexMap) || indexMap.length === 0) {
    return null
  }

  const safeStart = Math.max(0, Math.min(start, indexMap.length - 1))
  const safeEnd = Math.max(safeStart + 1, Math.min(end, indexMap.length))
  const rawStart = indexMap[safeStart]
  const rawEnd = indexMap[safeEnd - 1] + 1

  if (typeof rawStart !== 'number' || typeof rawEnd !== 'number') {
    return null
  }

  return {
    start: rawStart,
    end: rawEnd
  }
}

export function getSpeechWordRanges(text, start = 0, end = String(text || '').length) {
  const source = String(text || '')
  const safeStart = Math.max(0, start)
  const safeEnd = Math.max(safeStart, Math.min(end, source.length))
  const slice = source.slice(safeStart, safeEnd)
  const words = []
  const wordPattern = /\S+/g
  let match

  while ((match = wordPattern.exec(slice)) !== null) {
    words.push({
      start: safeStart + match.index,
      end: safeStart + match.index + match[0].length,
      text: match[0]
    })
  }

  return words
}

function getBoundaryEnd(boundaries, index, audioDurationMs) {
  const current = boundaries[index]
  if (!current) {
    return 0
  }

  const nextStart = boundaries[index + 1]?.audioOffsetMs
  const explicitEnd = current.durationMs > 0
    ? current.audioOffsetMs + current.durationMs
    : current.audioOffsetMs + 260

  if (typeof nextStart === 'number') {
    return Math.min(explicitEnd, nextStart)
  }

  if (typeof audioDurationMs === 'number' && Number.isFinite(audioDurationMs)) {
    return Math.min(explicitEnd, audioDurationMs)
  }

  return explicitEnd
}

export function speakText(text, options = {}) {
  if (!isSpeechSynthesisSupported()) {
    return null
  }

  const preparedText = String(text || '').replace(/\s+/g, ' ').trim()
  if (!preparedText) {
    return null
  }

  stopSpeechSynthesis()
  const sessionId = activeSpeechSessionId
  const abortController = new AbortController()
  const playback = {
    abortController,
    audio: null,
    objectUrl: null,
    rafId: 0,
    activeBoundaryIndex: -1,
    currentSegmentIndex: -1,
    started: false
  }

  activeSpeechPlayback = playback

  const failPlayback = (error) => {
    if (sessionId !== activeSpeechSessionId) {
      return
    }

    stopSpeechSynthesis()
    if (typeof options.onError === 'function') {
      options.onError(error)
    }
  }

  ;(async () => {
    try {
      const route = options.route || '/api/tts'
      const voiceName = options.voiceName || ''
      const locale = options.lang || ''
      const cacheKey = createSpeechCacheKey({
        text: preparedText,
        voiceName,
        locale,
        route
      })

      let payload = loadSpeechPayloadFromCache(cacheKey)

      if (!payload) {
        const response = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: preparedText,
            voiceName,
            locale
          }),
          signal: abortController.signal
        })

        payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || 'Speech playback failed.')
        }

        saveSpeechPayloadToCache(cacheKey, payload)
      }

      if (sessionId !== activeSpeechSessionId) {
        return
      }

      const segments = Array.isArray(payload.segments)
        ? payload.segments.filter((segment) => segment?.audioBase64)
        : []

      if (segments.length === 0) {
        throw new Error('Speech playback failed because no audio segments were returned.')
      }

      const emitBoundaryStart = (boundary, index) => {
        if (!boundary) {
          return
        }

        if (typeof options.onChunkStart === 'function') {
          options.onChunkStart({
            index,
            start: boundary.textOffset,
            end: boundary.textOffset + boundary.wordLength,
            text: boundary.text
          })
        }

        if (typeof options.onBoundary === 'function') {
          options.onBoundary({
            charIndex: boundary.textOffset,
            length: boundary.wordLength,
            name: 'WordBoundary'
          })
        }
      }

      const emitBoundaryEnd = (boundary, index) => {
        if (!boundary || typeof options.onChunkEnd !== 'function') {
          return
        }

        options.onChunkEnd({
          index,
          start: boundary.textOffset,
          end: boundary.textOffset + boundary.wordLength,
          text: boundary.text
        })
      }

      const step = (boundaries) => {
        if (sessionId !== activeSpeechSessionId || !playback.audio) {
          return
        }

        const currentMs = playback.audio.currentTime * 1000
        const durationMs = Number.isFinite(playback.audio.duration) ? playback.audio.duration * 1000 : undefined

        const activeIndex = boundaries.findIndex((boundary, index) => {
          const boundaryEnd = getBoundaryEnd(boundaries, index, durationMs)
          return currentMs >= boundary.audioOffsetMs && currentMs < boundaryEnd
        })

        if (activeIndex !== playback.activeBoundaryIndex) {
          if (playback.activeBoundaryIndex >= 0) {
            emitBoundaryEnd(boundaries[playback.activeBoundaryIndex], playback.activeBoundaryIndex)
          }

          playback.activeBoundaryIndex = activeIndex

          if (activeIndex >= 0) {
            emitBoundaryStart(boundaries[activeIndex], activeIndex)
          }
        }

        playback.rafId = window.requestAnimationFrame(() => step(boundaries))
      }

      const playSegment = async (segmentIndex) => {
        if (sessionId !== activeSpeechSessionId) {
          return
        }

        const segment = segments[segmentIndex]
        if (!segment) {
          stopSpeechSynthesis()

          if (typeof options.onEnd === 'function') {
            options.onEnd()
          }
          return
        }

        if (playback.objectUrl) {
          URL.revokeObjectURL(playback.objectUrl)
          playback.objectUrl = null
        }

        const boundaries = Array.isArray(segment.boundaries)
          ? segment.boundaries
              .filter((item) => typeof item?.textOffset === 'number' && typeof item?.wordLength === 'number')
              .sort((first, second) => first.audioOffsetMs - second.audioOffsetMs)
          : []

        const binary = Uint8Array.from(atob(segment.audioBase64 || ''), (char) => char.charCodeAt(0))
        const blob = new Blob([binary], { type: segment.contentType || 'audio/mpeg' })
        const objectUrl = URL.createObjectURL(blob)
        const audio = new Audio(objectUrl)

        playback.audio = audio
        playback.objectUrl = objectUrl
        playback.activeBoundaryIndex = -1
        playback.currentSegmentIndex = segmentIndex

        audio.addEventListener('play', () => {
          if (sessionId !== activeSpeechSessionId) {
            return
          }

          if (!playback.started && typeof options.onStart === 'function') {
            playback.started = true
            options.onStart()
          }

          playback.rafId = window.requestAnimationFrame(() => step(boundaries))
        }, { once: true })

        audio.addEventListener('ended', async () => {
          if (sessionId !== activeSpeechSessionId) {
            return
          }

          if (playback.activeBoundaryIndex >= 0) {
            emitBoundaryEnd(boundaries[playback.activeBoundaryIndex], playback.activeBoundaryIndex)
          }

          playback.activeBoundaryIndex = -1
          await playSegment(segmentIndex + 1)
        }, { once: true })

        audio.addEventListener('error', () => {
          failPlayback(new Error('Audio playback failed.'))
        }, { once: true })

        await audio.play()
      }

      await playSegment(0)
    } catch (error) {
      if (abortController.signal.aborted) {
        return
      }

      failPlayback(error)
    }
  })()

  return {
    sessionId,
    stop: () => stopSpeechSynthesis()
  }
}

export function playSpeechWithInlineHighlight(text, options = {}) {
  const {
    container = null,
    autoScroll = true,
    onStart,
    onEnd,
    onError,
    onStop,
    ...speechOptions
  } = options

  const preparedText = String(text || '').trim()
  if (!preparedText) {
    return null
  }

  let tokenEntries = container ? prepareSpeechTokenMap(container) : []
  let activeTokenEntry = null
  let lastMatchedTokenIndex = -1
  let isFinished = false

  const clearActiveToken = () => {
    if (activeTokenEntry) {
      deactivateSpeechToken(activeTokenEntry)
      activeTokenEntry = null
    } else if (container) {
      clearSpeechTokenHighlights(container)
    }
  }

  const cleanup = () => {
    clearActiveToken()

    if (container) {
      clearSpeechTokenWrappers(container)
    }
  }

  const refreshTokenEntries = () => {
    if (!container) {
      return []
    }

    const hasDisconnectedToken = tokenEntries.some((entry) => !entry?.element?.isConnected)
    if (tokenEntries.length === 0 || hasDisconnectedToken) {
      tokenEntries = prepareSpeechTokenMap(container)
    }

    return tokenEntries
  }

  const highlightSpokenWord = (spokenWord) => {
    if (!container) {
      return
    }

    const availableTokens = refreshTokenEntries()
    if (availableTokens.length === 0) {
      return
    }

    const nextToken = findNextSpeechWordMatch(availableTokens, spokenWord, lastMatchedTokenIndex)
    if (!nextToken) {
      return
    }

    clearActiveToken()
    activateSpeechToken(nextToken)
    activeTokenEntry = nextToken
    lastMatchedTokenIndex = nextToken.index

    if (autoScroll) {
      nextToken.element.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth'
      })
    }
  }

  const finalize = (callback, payload) => {
    if (isFinished) {
      return
    }

    isFinished = true
    cleanup()
    callback?.(payload)
  }

  const playback = speakText(preparedText, {
    ...speechOptions,
    onStart: () => {
      onStart?.()
    },
    onChunkStart: (boundary) => {
      highlightSpokenWord(boundary?.text)
      speechOptions.onChunkStart?.(boundary)
    },
    onChunkEnd: (boundary) => {
      clearActiveToken()
      speechOptions.onChunkEnd?.(boundary)
    },
    onEnd: () => {
      finalize(onEnd)
    },
    onError: (error) => {
      finalize(onError, error)
    }
  })

  if (!playback) {
    cleanup()
    return null
  }

  return {
    ...playback,
    stop: () => {
      stopSpeechSynthesis()
      finalize(onStop)
    }
  }
}
