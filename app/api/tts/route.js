import { NextResponse } from 'next/server'
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'

export const runtime = 'nodejs'

const DEFAULT_VOICE = process.env.AZURE_SPEECH_VOICE || 'en-US-JennyNeural'
const MAX_TTS_CHARACTERS = 60000
const MAX_SEGMENT_CHARACTERS = 2800

function ticksToMilliseconds(ticks) {
  return Math.max(0, Math.round(Number(ticks || 0) / 10000))
}

function closeSynthesizer(synthesizer) {
  if (!synthesizer) {
    return
  }

  try {
    synthesizer.close()
  } catch {}
}

function splitTextIntoSegments(text, maxSegmentLength = MAX_SEGMENT_CHARACTERS) {
  const normalized = String(text || '').trim()
  if (!normalized) {
    return []
  }

  const segments = []
  let cursor = 0

  while (cursor < normalized.length) {
    let end = Math.min(cursor + maxSegmentLength, normalized.length)

    if (end < normalized.length) {
      const slice = normalized.slice(cursor, end)
      const sentenceBreaks = [...slice.matchAll(/[.!?]\s+/g)]
      const lastSentenceBreak = sentenceBreaks[sentenceBreaks.length - 1]

      if (lastSentenceBreak) {
        end = cursor + lastSentenceBreak.index + lastSentenceBreak[0].length
      } else {
        const whitespaceIndex = slice.lastIndexOf(' ')
        if (whitespaceIndex > Math.floor(maxSegmentLength * 0.6)) {
          end = cursor + whitespaceIndex
        }
      }
    }

    const textSegment = normalized.slice(cursor, end).trim()
    if (textSegment) {
      const start = normalized.indexOf(textSegment, cursor)
      segments.push({
        text: textSegment,
        start,
        end: start + textSegment.length
      })
      cursor = start + textSegment.length
    } else {
      cursor = end
    }

    while (cursor < normalized.length && /\s/.test(normalized[cursor])) {
      cursor += 1
    }
  }

  return segments
}

function synthesizeText({ text, voiceName, locale }) {
  return new Promise((resolve, reject) => {
    const subscriptionKey = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION

    if (!subscriptionKey || !region) {
      reject(new Error('Azure Speech credentials are not configured.'))
      return
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region)
    speechConfig.speechSynthesisVoiceName = voiceName || DEFAULT_VOICE

    if (locale) {
      speechConfig.speechSynthesisLanguage = locale
    }

    speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3

    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig)
    const boundaries = []

    synthesizer.wordBoundary = (_, event) => {
      if (event.boundaryType !== SpeechSDK.SpeechSynthesisBoundaryType.Word) {
        return
      }

      boundaries.push({
        audioOffsetMs: ticksToMilliseconds(event.audioOffset),
        durationMs: ticksToMilliseconds(event.duration),
        textOffset: Number(event.textOffset || 0),
        wordLength: Number(event.wordLength || 0),
        text: event.text || ''
      })
    }

    synthesizer.speakTextAsync(
      text,
      (result) => {
        try {
          if (!result?.audioData || result.audioData.byteLength === 0) {
            reject(new Error('Azure Speech did not return audio data.'))
            return
          }

          resolve({
            audioBase64: Buffer.from(result.audioData).toString('base64'),
            contentType: 'audio/mpeg',
            boundaries
          })
        } finally {
          closeSynthesizer(synthesizer)
        }
      },
      (error) => {
        closeSynthesizer(synthesizer)
        reject(new Error(String(error || 'Azure Speech synthesis failed.')))
      }
    )
  })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const text = String(body?.text || '').replace(/\s+/g, ' ').trim()
    const voiceName = body?.voiceName ? String(body.voiceName).trim() : ''
    const locale = body?.locale ? String(body.locale).trim() : ''

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
    }

    if (text.length > MAX_TTS_CHARACTERS) {
      return NextResponse.json(
        { error: `Text is too long for speech playback. Limit is ${MAX_TTS_CHARACTERS} characters.` },
        { status: 400 }
      )
    }

    const textSegments = splitTextIntoSegments(text)
    if (textSegments.length === 0) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
    }

    const segments = []

    for (const textSegment of textSegments) {
      const result = await synthesizeText({
        text: textSegment.text,
        voiceName,
        locale
      })

      segments.push({
        text: textSegment.text,
        textStart: textSegment.start,
        textEnd: textSegment.end,
        contentType: result.contentType,
        audioBase64: result.audioBase64,
        boundaries: result.boundaries.map((boundary) => ({
          ...boundary,
          textOffset: boundary.textOffset + textSegment.start
        }))
      })
    }

    return NextResponse.json({
      text,
      segments
    })
  } catch (error) {
    const message = String(error?.message || error || 'Speech synthesis failed.')
    const status = message.includes('credentials') ? 503 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
