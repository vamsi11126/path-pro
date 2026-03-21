'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ROLE_ALIASES = {
  tutor: ['tutor', 'teacher', 'coach', 'mentor', 'guide', 'instructor'],
  learner: ['learner', 'student', 'you'],
  narrator: ['narrator', 'host', 'summary']
}

function normalizeText(value) {
  return String(value || '').replace(/\r/g, '').trim()
}

function stripMarkdown(text) {
  return normalizeText(text)
    .replace(/^>\s?/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
}

function normalizeRole(rawRole) {
  const normalized = normalizeText(rawRole).toLowerCase()
  for (const [role, aliases] of Object.entries(ROLE_ALIASES)) {
    if (aliases.includes(normalized)) {
      return role
    }
  }
  return normalized || 'narrator'
}

function extractTurnsFromText(content) {
  const clean = stripMarkdown(content)
  if (!clean) return []

  const lines = clean
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const turns = []
  let currentRole = null
  let currentParts = []

  const pushCurrent = () => {
    if (currentParts.length === 0) return
    turns.push({
      role: currentRole || 'narrator',
      text: currentParts.join(' ').trim()
    })
    currentParts = []
  }

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z\s/-]{1,30}):\s*(.+)$/)
    if (match) {
      pushCurrent()
      currentRole = normalizeRole(match[1])
      currentParts.push(match[2])
      continue
    }

    currentParts.push(line)
  }

  pushCurrent()

  if (turns.length > 0) {
    return turns
  }

  return [{
    role: 'narrator',
    text: lines.join(' ')
  }]
}

function buildRoleVoiceMap(voices) {
  if (!Array.isArray(voices) || voices.length === 0) {
    return {}
  }

  const englishVoices = voices.filter((voice) => /^en(-|_|$)/i.test(voice.lang || ''))
  const pool = englishVoices.length > 0 ? englishVoices : voices

  const distinct = []
  for (const voice of pool) {
    if (!distinct.some((entry) => entry.name === voice.name)) {
      distinct.push(voice)
    }
  }

  return {
    tutor: distinct[0] || null,
    learner: distinct[1] || distinct[0] || null,
    narrator: distinct[2] || distinct[0] || null
  }
}

function roleLabel(role) {
  if (role === 'tutor') return 'Tutor'
  if (role === 'learner') return 'Learner'
  if (role === 'narrator') return 'Narrator'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function AuditoryVoicePlayer({
  title,
  content,
  className = ''
}) {
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activeTurnIndex, setActiveTurnIndex] = useState(-1)
  const queueRef = useRef([])
  const currentUtteranceRef = useRef(null)
  const turns = useMemo(() => extractTurnsFromText(content), [content])
  const roleVoiceMap = useMemo(() => buildRoleVoiceMap(voices), [voices])
  const canPlay = supported && turns.length > 1

  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!synth) {
      setSupported(false)
      return
    }

    setSupported(true)

    const loadVoices = () => {
      const nextVoices = synth.getVoices()
      if (nextVoices.length > 0) {
        setVoices(nextVoices)
      }
    }

    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices)
      synth.cancel()
    }
  }, [])

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const stopPlayback = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    queueRef.current = []
    currentUtteranceRef.current = null
    setIsPlaying(false)
    setIsPaused(false)
    setActiveTurnIndex(-1)
  }

  const speakNext = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const synth = window.speechSynthesis
    const next = queueRef.current.shift()

    if (!next) {
      setIsPlaying(false)
      setIsPaused(false)
      setActiveTurnIndex(-1)
      currentUtteranceRef.current = null
      return
    }

    const utterance = new SpeechSynthesisUtterance(next.text)
    const roleVoice = roleVoiceMap[next.role] || roleVoiceMap.narrator || null
    if (roleVoice) {
      utterance.voice = roleVoice
      utterance.lang = roleVoice.lang
    }
    utterance.rate = next.role === 'learner' ? 0.98 : 1.02
    utterance.pitch = next.role === 'learner' ? 1.08 : 0.94
    utterance.onend = () => {
      currentUtteranceRef.current = null
      speakNext()
    }
    utterance.onerror = () => {
      currentUtteranceRef.current = null
      speakNext()
    }

    currentUtteranceRef.current = utterance
    setActiveTurnIndex(next.index)
    synth.speak(utterance)
  }

  const startPlayback = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis || turns.length === 0) return

    const synth = window.speechSynthesis
    synth.cancel()

    queueRef.current = turns.map((turn, index) => ({
      ...turn,
      index
    }))
    setIsPlaying(true)
    setIsPaused(false)
    speakNext()
  }

  const togglePause = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !isPlaying) return

    const synth = window.speechSynthesis
    if (isPaused) {
      synth.resume()
      setIsPaused(false)
    } else {
      synth.pause()
      setIsPaused(true)
    }
  }

  if (turns.length === 0) {
    return null
  }

  const distinctRoles = [...new Set(turns.map((turn) => turn.role))]

  return (
    <div className={cn('rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-amber-300" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              Multi-Voice Playback
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {canPlay
              ? 'Listen to this conversation with distinct voices for each speaker when supported by your browser.'
              : 'Playback controls are unavailable here, but the conversation transcript is still shown below.'}
          </p>
          {title ? (
            <div className="mt-2 break-words text-sm font-medium text-foreground">{title}</div>
          ) : null}
        </div>
        {canPlay ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button size="sm" onClick={startPlayback} disabled={isPlaying && !isPaused} className="flex-1 sm:flex-none">
              {isPlaying && !isPaused ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Play
            </Button>
            <Button size="sm" variant="outline" onClick={togglePause} disabled={!isPlaying} className="flex-1 sm:flex-none">
              <Pause className="h-4 w-4" />
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={stopPlayback}
              disabled={!isPlaying && activeTurnIndex === -1}
              className="flex-1 sm:flex-none"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {distinctRoles.map((role) => (
          <Badge key={role} variant="outline" className="border-amber-500/20 bg-background/70 text-amber-100">
            {roleLabel(role)} voice
          </Badge>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {turns.map((turn, index) => (
          <div
            key={`${turn.role}-${index}`}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm leading-6 transition-colors break-words',
              activeTurnIndex === index
                ? 'border-amber-400/40 bg-amber-400/10 text-foreground'
                : 'border-white/8 bg-background/40 text-muted-foreground'
            )}
          >
            <span className="mr-2 font-semibold text-foreground">{roleLabel(turn.role)}:</span>
            <span>{turn.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
