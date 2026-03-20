'use client'

import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileCode2, Loader2, Play, RotateCcw, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

export default function CodingPlayground({
  language = 'javascript',
  value = '',
  onChange,
  readOnly = false,
  title = 'Coding Playground',
  description = 'Edit the code and run it in the browser.',
  placeholder = '',
  resetLabel = 'Reset',
  onReset,
  showReset = false,
  onRunResult,
}) {
  const [isRunning, setIsRunning] = useState(false)
  const [hasExecuted, setHasExecuted] = useState(false)
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('idle')
  const [lastRunSource, setLastRunSource] = useState(null)
  const latestRunIdRef = useRef(0)

  const executor = EXECUTORS[language]
  const visualStatus = isRunning ? 'idle' : status
  const statusConfig = STATUS_STYLES[visualStatus] || STATUS_STYLES.idle
  const outputText = output || (isRunning ? 'Booting runtime...' : NO_OUTPUT_MESSAGE)
  const hasUnrunChanges = Boolean(lastRunSource !== null && value !== lastRunSource)

  const handleRun = async () => {
    if (!executor) {
      return
    }

    const sourceToRun = value
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
        }
      })

      if (latestRunIdRef.current !== currentRunId) {
        return
      }

      const finalOutput = result.output?.trim().length ? result.output : NO_OUTPUT_MESSAGE
      setOutput(finalOutput)
      setStatus(result.success ? 'success' : 'error')
      setLastRunSource(sourceToRun)
      onRunResult?.({
        output: finalOutput,
        status: result.success ? 'success' : 'error',
        source: sourceToRun
      })
    } catch (error) {
      if (latestRunIdRef.current !== currentRunId) {
        return
      }

      const message = formatExecutionError(error)
      setOutput(message)
      setStatus('error')
      setLastRunSource(sourceToRun)
      onRunResult?.({
        output: message,
        status: 'error',
        source: sourceToRun
      })
    } finally {
      if (latestRunIdRef.current === currentRunId) {
        setIsRunning(false)
      }
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border shadow-lg shadow-black/5 dark:shadow-black/30', statusConfig.panel)}>
      <div className="flex flex-col gap-3 border-b border-border/50 bg-background/90 px-4 py-4 md:flex-row md:items-center md:justify-between dark:bg-[#0b0f17]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Terminal className="h-4 w-4 text-primary" />
              <span>{title}</span>
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              {language}
            </span>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', statusConfig.dot)} />
            <span>
              {isRunning
                ? 'Running the current code...'
                : hasUnrunChanges
                  ? 'Code changed since the last run.'
                  : hasExecuted
                    ? `Last run: ${statusConfig.label}`
                    : 'Ready to run'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showReset && !readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-border/70 bg-background/80 text-foreground shadow-sm hover:bg-accent dark:bg-white/[0.04]"
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4" />
              {resetLabel}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-primary/25 bg-background/80 text-foreground shadow-sm hover:bg-primary/10 hover:text-primary dark:bg-white/[0.04] dark:hover:bg-primary/15"
            disabled={isRunning}
            onClick={handleRun}
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
            {isRunning ? 'Running...' : hasUnrunChanges ? 'Run changes' : hasExecuted ? 'Run again' : 'Run code'}
          </Button>
        </div>
      </div>

      <div className="border-b border-white/10 bg-zinc-950 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:bg-[#020409] dark:text-zinc-500">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-3.5 w-3.5 text-primary" />
            <span>{readOnly ? 'Submitted Code' : 'Editable Code'}</span>
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
            {status === 'error' ? 'Error' : isRunning ? 'Running' : 'Ready'}
          </span>
        </div>
      </div>

      <div className="bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_55%),linear-gradient(180deg,rgba(9,9,11,0.96),rgba(3,7,18,1))]">
        {readOnly ? (
          <pre className="min-h-[220px] w-full overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-xs leading-6 text-zinc-100 selection:bg-primary/30 selection:text-white">
            {value || placeholder || 'No code submitted.'}
          </pre>
        ) : (
          <textarea
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            spellCheck={false}
            className="min-h-[220px] w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-xs leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 selection:bg-primary/30 selection:text-white"
            placeholder={placeholder}
          />
        )}
      </div>

      {hasExecuted && (
        <>
          <div className="border-t border-white/10 bg-zinc-950 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:bg-[#020409] dark:text-zinc-500">
            Console
          </div>
          <div className="bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_55%),linear-gradient(180deg,rgba(9,9,11,0.96),rgba(3,7,18,1))]">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-xs leading-6 text-zinc-100 selection:bg-primary/30 selection:text-white">
              {outputText}
            </pre>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-background/90 px-3 py-2 text-[11px] text-muted-foreground dark:bg-[#0b0f17]">
            <span>{hasUnrunChanges ? 'Run the current code to refresh this output.' : 'Output shown exactly as returned by the runtime.'}</span>
            <span className="shrink-0 font-medium text-foreground/80">
              {outputText.split('\n').length} line{outputText.split('\n').length === 1 ? '' : 's'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
