'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileCode2, Loader2, PencilLine, Play, RotateCcw, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getRunnableLanguageLabel, getRuntimeLabel } from '@/lib/code-runtime/languages'
import { formatExecutionError } from '@/lib/code-runtime/shared'
import { runJavaScriptInWebContainer } from '@/lib/code-runtime/webcontainer'
import { runPythonInPyodide } from '@/lib/code-runtime/pyodide'

const NO_OUTPUT_MESSAGE = 'Program finished with no output.'

const EXECUTORS = {
  javascript: runJavaScriptInWebContainer,
  python: runPythonInPyodide,
}

const STATUS_STYLES = {
  idle: {
    badge: 'border-border/60 bg-background/70 text-muted-foreground',
    panel: 'border-border/70 shadow-black/5 dark:shadow-black/30',
    dot: 'bg-muted-foreground/70',
    label: 'Ready',
  },
  success: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    panel: 'border-emerald-500/30 shadow-emerald-500/10 dark:shadow-emerald-500/10',
    dot: 'bg-emerald-500',
    label: 'Success',
  },
  error: {
    badge: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    panel: 'border-red-500/30 shadow-red-500/10 dark:shadow-red-500/10',
    dot: 'bg-red-500',
    label: 'Error',
  },
}

export default function RunnableCodePanel({ code, language }) {
  const [editableCode, setEditableCode] = useState(code)
  const [isRunning, setIsRunning] = useState(false)
  const [hasExecuted, setHasExecuted] = useState(false)
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('idle')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [lastRunSource, setLastRunSource] = useState(null)
  const latestRunIdRef = useRef(0)

  const languageLabel = getRunnableLanguageLabel(language)
  const runtimeLabel = getRuntimeLabel(language)

  useEffect(() => {
    setEditableCode(code)
    setIsRunning(false)
    setHasExecuted(false)
    setOutput('')
    setStatus('idle')
    setIsEditorOpen(false)
    setLastRunSource(null)
    latestRunIdRef.current += 1
  }, [code])

  if (!languageLabel || !runtimeLabel) {
    return null
  }

  const visualStatus = isRunning ? 'idle' : status
  const statusConfig = STATUS_STYLES[visualStatus] || STATUS_STYLES.idle
  const isEdited = editableCode !== code
  const hasUnrunChanges = Boolean(lastRunSource !== null && editableCode !== lastRunSource)
  const outputText = output || (isRunning ? 'Booting runtime...' : NO_OUTPUT_MESSAGE)
  const outputLineCount = outputText.split('\n').length

  const activityText = isRunning
    ? 'Running the current buffer...'
    : hasUnrunChanges
      ? 'Code changed since the last run.'
      : hasExecuted
        ? `Last run: ${statusConfig.label}`
        : isEditorOpen
          ? 'Edit the snippet, then run it here.'
          : 'Ready to run'

  const executeSnippet = async () => {
    const executor = EXECUTORS[language]

    if (!executor) {
      return
    }

    const sourceToRun = editableCode

    latestRunIdRef.current += 1
    const currentRunId = latestRunIdRef.current

    setHasExecuted(true)
    setIsRunning(true)
    setOutput('')
    setStatus('idle')

    try {
      const result = await executor(sourceToRun, {
        onOutput: (chunk) => {
          if (latestRunIdRef.current !== currentRunId) {
            return
          }

          setOutput((previous) => previous + chunk)
        },
      })

      if (latestRunIdRef.current !== currentRunId) {
        return
      }

      const finalOutput = result.output?.trim().length ? result.output : NO_OUTPUT_MESSAGE
      setOutput(finalOutput)
      setStatus(result.success ? 'success' : 'error')
      setLastRunSource(sourceToRun)
    } catch (error) {
      if (latestRunIdRef.current !== currentRunId) {
        return
      }

      setOutput(formatExecutionError(error))
      setStatus('error')
      setLastRunSource(sourceToRun)
    } finally {
      if (latestRunIdRef.current === currentRunId) {
        setIsRunning(false)
      }
    }
  }

  const handleResetCode = () => {
    setEditableCode(code)
  }

  return (
    <div className="border-t border-border/70 bg-gradient-to-b from-zinc-100/80 via-zinc-50/70 to-white/70 dark:from-white/[0.06] dark:via-white/[0.03] dark:to-[#05070c]">
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Terminal className="h-4 w-4 text-primary" />
              <span>Run {languageLabel}</span>
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              {runtimeLabel}
            </span>
            <span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground dark:bg-white/[0.04]">
              Playground
            </span>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            Run the snippet as-is, or open the editor to tweak it and test your own changes.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', statusConfig.dot)} />
            <span>{activityText}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-border/70 bg-background/80 text-foreground shadow-sm hover:bg-accent dark:bg-white/[0.04]"
            onClick={() => setIsEditorOpen((previous) => !previous)}
          >
            <PencilLine className="h-4 w-4" />
            {isEditorOpen ? 'Hide editor' : 'Edit code'}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-primary/25 bg-background/80 text-foreground shadow-sm hover:bg-primary/10 hover:text-primary dark:bg-white/[0.04] dark:hover:bg-primary/15"
            disabled={isRunning}
            onClick={executeSnippet}
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
            {isRunning ? 'Running...' : hasUnrunChanges ? 'Run changes' : hasExecuted ? 'Run again' : 'Run code'}
          </Button>
        </div>
      </div>

      {isEditorOpen && (
        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 shadow-lg shadow-black/5 dark:border-white/10 dark:shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:bg-[#020409] dark:text-zinc-500">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-3.5 w-3.5 text-primary" />
                <span>Editable Copy</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2 py-1 text-[10px] tracking-[0.18em]',
                    isEdited
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-border/60 bg-background/70 text-muted-foreground'
                  )}
                >
                  {isEdited ? 'Edited' : 'Original'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                  disabled={!isEdited}
                  onClick={handleResetCode}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_55%),linear-gradient(180deg,rgba(9,9,11,0.96),rgba(3,7,18,1))]">
              <div className="border-b border-white/5 px-3 py-2 text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-200">{languageLabel}</span>
                <span className="mx-2 text-zinc-600">/</span>
                <span>Editable sandbox</span>
              </div>
              <textarea
                value={editableCode}
                onChange={(event) => setEditableCode(event.target.value)}
                spellCheck={false}
                className="min-h-[220px] w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-xs leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 selection:bg-primary/30 selection:text-white"
                placeholder={`Write ${languageLabel} here...`}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-background/90 px-3 py-2 text-[11px] text-muted-foreground dark:bg-[#0b0f17]">
              <span>{hasUnrunChanges ? 'The editor has changes that have not been executed yet.' : 'Edits stay local to this playground and do not change the lesson content.'}</span>
              <span className="shrink-0 font-medium text-foreground/80">
                {editableCode.split('\n').length} line{editableCode.split('\n').length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      )}

      {hasExecuted && (
        <div className="px-4 pb-4">
          <div
            className={cn(
              'overflow-hidden rounded-2xl border shadow-lg backdrop-blur-sm',
              statusConfig.panel
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:bg-[#020409] dark:text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                </span>
                <span>Console</span>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] tracking-[0.18em]',
                  statusConfig.badge
                )}
              >
                {status === 'error' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : status === 'success' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Loader2 className={cn('h-3 w-3', isRunning && 'animate-spin')} />
                )}
                {status === 'error' ? 'Error' : isRunning ? 'Running' : 'Complete'}
              </span>
            </div>

            <div className="bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_55%),linear-gradient(180deg,rgba(9,9,11,0.96),rgba(3,7,18,1))]">
              <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 text-[11px] text-zinc-400">
                <div>
                  <span className="font-medium text-zinc-200">{languageLabel}</span>
                  <span className="mx-2 text-zinc-600">/</span>
                  <span>{runtimeLabel}</span>
                </div>
                {hasUnrunChanges && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold tracking-[0.18em] text-amber-300">
                    Output stale
                  </span>
                )}
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-xs leading-6 text-zinc-100 selection:bg-primary/30 selection:text-white">
                {outputText}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-background/90 px-3 py-2 text-[11px] text-muted-foreground dark:bg-[#0b0f17]">
              <span>{hasUnrunChanges ? 'Run the current editor contents to refresh this output.' : status === 'error' ? 'The runtime reported an error.' : 'Output shown exactly as returned by the runtime.'}</span>
              <span className="shrink-0 font-medium text-foreground/80">
                {outputLineCount} line{outputLineCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
