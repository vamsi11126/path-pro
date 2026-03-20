'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { formatIst } from '@/lib/classrooms/format'
import CodingPlayground from '@/components/classrooms/CodingPlayground'

function isCodingQuestion(question) {
  return question?.display_question_type === 'coding'
}

function buildAnswerState(questions = []) {
  return questions.reduce((accumulator, question) => {
    const answer = question.answer

    if (isCodingQuestion(question)) {
      accumulator[question.id] = {
        answerText: answer?.answer_text || question.starter_code || '',
        answerJson: answer?.answer_json || {}
      }
      return accumulator
    }

    if (question.question_type === 'mcq' || question.question_type === 'true_false') {
      accumulator[question.id] = {
        selectedOptionId: answer?.selected_option_ids?.[0] || ''
      }
      return accumulator
    }

    if (question.question_type === 'multi_select') {
      accumulator[question.id] = {
        selectedOptionIds: answer?.selected_option_ids || []
      }
      return accumulator
    }

    if (question.question_type === 'numeric') {
      accumulator[question.id] = {
        numericAnswer: answer?.numeric_answer ?? ''
      }
      return accumulator
    }

    if (question.question_type === 'match') {
      accumulator[question.id] = {
        answerJson: answer?.answer_json || {}
      }
      return accumulator
    }

    accumulator[question.id] = {
      answerText: answer?.answer_text || ''
    }
    return accumulator
  }, {})
}

function formatRemainingTime(remainingMs) {
  const safeMs = Math.max(0, remainingMs)
  const totalSeconds = Math.floor(safeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

export default function ClassroomAssessmentAttemptPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingQuestionId, setSavingQuestionId] = useState(null)
  const [session, setSession] = useState(null)
  const [answers, setAnswers] = useState({})
  const [remainingMs, setRemainingMs] = useState(null)
  const [warnings, setWarnings] = useState([])
  const autoSubmittedRef = useRef(false)
  const saveTimersRef = useRef({})

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/classrooms/${params.classroomId}/assessments/${params.assessmentId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load assessment')
      }

      setSession(data)
      setAnswers(buildAnswerState(data.questions || []))
      if (data.currentAttempt?.expires_at) {
        setRemainingMs(new Date(data.currentAttempt.expires_at).getTime() - Date.now())
      } else {
        setRemainingMs(null)
      }
    } catch (error) {
      toast.error(error.message)
      router.push(`/classrooms/${params.classroomId}/assessments`)
    } finally {
      setLoading(false)
    }
  }, [params.assessmentId, params.classroomId, router])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const currentAttempt = session?.currentAttempt || null
  const isStrictMode = Boolean(session?.assessment?.strict_mode && currentAttempt)

  useEffect(() => {
    autoSubmittedRef.current = false
  }, [currentAttempt?.id])
  const questionProgress = useMemo(() => {
    const questions = session?.questions || []
      const answered = questions.filter((question) => {
        const answer = answers[question.id]
        if (!answer) return false
        if (isCodingQuestion(question)) return Boolean(answer.answerText?.trim())
        if (question.question_type === 'mcq' || question.question_type === 'true_false') return Boolean(answer.selectedOptionId)
        if (question.question_type === 'multi_select') return (answer.selectedOptionIds || []).length > 0
        if (question.question_type === 'numeric') return answer.numericAnswer !== '' && answer.numericAnswer !== null && answer.numericAnswer !== undefined
      if (question.question_type === 'match') return Object.keys(answer.answerJson || {}).length > 0
      return Boolean(answer.answerText?.trim())
    }).length

    return {
      total: questions.length,
      answered,
      percentage: questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0
    }
  }, [answers, session?.questions])

  const persistAnswer = useCallback(async (question, nextValue) => {
    if (!currentAttempt) {
      return
    }

    setSavingQuestionId(question.id)

    try {
      const response = await fetch(`/api/classrooms/${params.classroomId}/assessments/${params.assessmentId}/attempts/${currentAttempt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: question.id,
          ...nextValue
        })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save answer')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingQuestionId(null)
    }
  }, [currentAttempt, params.assessmentId, params.classroomId])

  const handleSubmit = useCallback(async (isAutomatic = false) => {
    if (!currentAttempt) {
      return
    }

    setSubmitting(true)

    try {
      const pendingTimers = { ...saveTimersRef.current }
      Object.values(pendingTimers).forEach((timerId) => clearTimeout(timerId))
      saveTimersRef.current = {}

      await Promise.all((session?.questions || []).map((question) => {
        const answer = answers[question.id]
        if (!answer || !(isCodingQuestion(question) || question.question_type === 'short_answer' || question.question_type === 'long_answer')) {
          return Promise.resolve()
        }

        return persistAnswer(question, answer)
      }))

      const response = await fetch(`/api/classrooms/${params.classroomId}/assessments/${params.assessmentId}/attempts/${currentAttempt.id}`, {
        method: 'POST'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit assessment')
      }

      if (!isAutomatic) {
        toast.success('Assessment submitted')
      }

      setSession(data)
      setAnswers(buildAnswerState(data.questions || []))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }, [answers, currentAttempt, params.assessmentId, params.classroomId, persistAnswer, session?.questions])

  const logIntegrityEvent = useCallback(async (eventType, severity = 'medium', details = {}) => {
    if (!currentAttempt) {
      return
    }

    try {
      const response = await fetch(`/api/classrooms/${params.classroomId}/assessments/${params.assessmentId}/attempts/${currentAttempt.id}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventType,
          severity,
          details
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to log integrity event')
      }

      setWarnings((current) => [...current, { eventType, severity }].slice(-8))

      if (data.riskScore >= 10 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        toast.error('Assessment was auto-submitted due to repeated integrity violations')
        await handleSubmit(true)
      }
    } catch (error) {
      console.error(error)
    }
  }, [currentAttempt, handleSubmit, params.assessmentId, params.classroomId])

  useEffect(() => {
    if (!currentAttempt?.expires_at) {
      return undefined
    }

    const timer = window.setInterval(() => {
      const delta = new Date(currentAttempt.expires_at).getTime() - Date.now()
      setRemainingMs(delta)

      if (delta <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        toast.error('Time is up. Submitting your assessment now.')
        handleSubmit(true)
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentAttempt, handleSubmit])

  useEffect(() => {
    if (!isStrictMode) {
      return undefined
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        logIntegrityEvent('tab_hidden', 'high')
      }
    }

    const onBlur = () => logIntegrityEvent('window_blur', 'medium')
    const onCopy = () => logIntegrityEvent('copy_attempt', 'medium')
    const onPaste = () => logIntegrityEvent('paste_attempt', 'medium')
    const onContextMenu = (event) => {
      event.preventDefault()
      logIntegrityEvent('context_menu', 'low')
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logIntegrityEvent('fullscreen_exit', 'high')
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [isStrictMode, logIntegrityEvent])

  const startAssessment = async () => {
    setStarting(true)

    try {
      if (session?.assessment?.strict_mode && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {})
      }

      const response = await fetch(`/api/classrooms/${params.classroomId}/assessments/${params.assessmentId}`, {
        method: 'POST'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start assessment')
      }

      toast.success('Assessment started')
      await loadSession()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setStarting(false)
    }
  }

  const updateAnswer = async (question, nextValue) => {
    setAnswers((current) => ({
      ...current,
      [question.id]: {
        ...(current[question.id] || {}),
        ...nextValue
      }
    }))

    const shouldDebounceSave = isCodingQuestion(question) || question.question_type === 'short_answer' || question.question_type === 'long_answer'

    if (!shouldDebounceSave) {
      await persistAnswer(question, nextValue)
      return
    }

    if (saveTimersRef.current[question.id]) {
      clearTimeout(saveTimersRef.current[question.id])
    }

    saveTimersRef.current[question.id] = setTimeout(() => {
      persistAnswer(question, nextValue)
      delete saveTimersRef.current[question.id]
    }, 500)
  }

  useEffect(() => () => {
    Object.values(saveTimersRef.current).forEach((timerId) => clearTimeout(timerId))
  }, [])

  if (loading || !session) {
    return <div className="text-muted-foreground">Loading assessment...</div>
  }

  const canStart = !currentAttempt
  const latestAttempt = session.latestAttempt
  const latestResult = session.latestResult

  return (
    <div className="space-y-8 pb-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-primary/10 via-background to-emerald-500/10 px-6 py-7 shadow-[0_24px_80px_-48px_rgba(34,197,94,0.35)] md:px-8 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-6">
          <div className="max-w-3xl">
            <Button variant="ghost" className="mb-4 -ml-2 w-fit text-muted-foreground" onClick={() => router.push(`/classrooms/${params.classroomId}/assessments`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assessments
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-primary" />
              {session.assessment.delivery_mode === 'coding'
                ? `${session.assessment.coding_language} coding assignment`
                : `${session.assessment.assessment_type} assessment`}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{session.assessment.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              {session.assessment.description || 'No description provided.'}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{session.assessment.instructions || 'Follow the instructions and submit before the timer expires.'}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Questions</CardDescription>
                <CardTitle className="text-3xl">{session.questions.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Progress</CardDescription>
                <CardTitle className="text-3xl">{questionProgress.answered}/{questionProgress.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Timer</CardDescription>
                <CardTitle className="text-xl">{remainingMs !== null ? formatRemainingTime(remainingMs) : (session.assessment.duration_minutes ? `${session.assessment.duration_minutes} min` : 'Untimed')}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-xl">{currentAttempt ? currentAttempt.status : latestAttempt?.status || 'Ready'}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {!currentAttempt ? (
        <Card className="rounded-[24px] border-white/10 bg-black/10">
          <CardHeader>
            <CardTitle>{latestResult ? 'Latest result' : 'Start assessment'}</CardTitle>
            <CardDescription>
              {latestResult
                ? latestResult.published_to_student || session.assessment.show_results_immediately
                  ? `Your latest score is ${latestResult.percentage}%.`
                  : 'Your last submission is waiting for teacher review.'
                : 'Begin this assessment when you are ready.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestResult && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Latest submission
                </div>
                <p className="mt-2">Answered {latestResult.answered_questions}/{latestResult.total_questions} questions</p>
                <p className="mt-1">Score: {latestResult.total_score}/{latestResult.max_score} ({latestResult.percentage}%)</p>
              </div>
            )}

            {session.assessment.strict_mode && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Secure mode requires focused assessment behavior. Fullscreen exits, tab changes, copy, paste, and similar actions are logged.
              </div>
            )}

            <Button className="h-11" onClick={startAssessment} disabled={starting}>
              {starting ? 'Starting...' : latestAttempt ? 'Start New Attempt' : 'Start Assessment'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
          <div className="space-y-6">
            <Card className="rounded-[24px] border-white/10 bg-black/10">
              <CardHeader>
                <CardTitle>Assessment runner</CardTitle>
                <CardDescription>Answers are autosaved after every interaction.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{questionProgress.answered} of {questionProgress.total} answered</span>
                    <span>{questionProgress.percentage}% complete</span>
                  </div>
                  <Progress value={questionProgress.percentage} className="h-2 bg-white/10" />
                </div>

                {session.questions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Question {index + 1}</div>
                          <div className="mt-2 font-medium text-foreground">{question.prompt}</div>
                        </div>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">{question.points} pt</span>
                      </div>

                      {(question.question_type === 'mcq' || question.question_type === 'true_false') && (
                        <div className="space-y-2">
                          {(question.options || []).map((option) => (
                            <label key={option.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                checked={answers[question.id]?.selectedOptionId === option.id}
                                onChange={() => updateAnswer(question, { selectedOptionId: option.id })}
                              />
                              <span>{option.option_text}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {question.question_type === 'multi_select' && (
                        <div className="space-y-2">
                          {(question.options || []).map((option) => {
                            const selectedOptionIds = answers[question.id]?.selectedOptionIds || []
                            const checked = selectedOptionIds.includes(option.id)

                            return (
                              <label key={option.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    const nextValues = event.target.checked
                                      ? [...selectedOptionIds, option.id]
                                      : selectedOptionIds.filter((value) => value !== option.id)
                                    updateAnswer(question, { selectedOptionIds: nextValues })
                                  }}
                                />
                                <span>{option.option_text}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}

                      {question.question_type === 'numeric' && (
                        <Input
                          type="number"
                          value={answers[question.id]?.numericAnswer ?? ''}
                          onChange={(event) => updateAnswer(question, { numericAnswer: event.target.value })}
                        />
                      )}

                      {question.question_type === 'match' && (
                        <div className="space-y-3">
                          {[...new Set((question.options || []).map((option) => option.match_key).filter(Boolean))].map((leftPrompt) => (
                            <div key={leftPrompt} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                              <div className="text-sm text-foreground">{leftPrompt}</div>
                              <select
                                value={answers[question.id]?.answerJson?.[leftPrompt] || ''}
                                onChange={(event) => updateAnswer(question, {
                                  answerJson: {
                                    ...(answers[question.id]?.answerJson || {}),
                                    [leftPrompt]: event.target.value
                                  }
                                })}
                                className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                              >
                                <option value="">Select match</option>
                                {(question.options || []).map((option) => (
                                  <option key={`${leftPrompt}-${option.id}`} value={option.option_text}>{option.option_text}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}

                      {isCodingQuestion(question) && (
                        <CodingPlayground
                          language={question.coding_language || session.assessment.coding_language || 'javascript'}
                          value={answers[question.id]?.answerText || ''}
                          onChange={(nextCode) => updateAnswer(question, {
                            answerText: nextCode,
                            answerJson: {
                              ...(answers[question.id]?.answerJson || {}),
                              language: question.coding_language || session.assessment.coding_language || 'javascript'
                            }
                          })}
                          onReset={() => updateAnswer(question, {
                            answerText: question.starter_code || '',
                            answerJson: {
                              ...(answers[question.id]?.answerJson || {}),
                              language: question.coding_language || session.assessment.coding_language || 'javascript'
                            }
                          })}
                          onRunResult={(result) => {
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: {
                                ...(current[question.id] || {}),
                                answerJson: {
                                  ...(current[question.id]?.answerJson || {}),
                                  language: question.coding_language || session.assessment.coding_language || 'javascript',
                                  lastRunOutput: result.output,
                                  lastRunStatus: result.status
                                }
                              }
                            }))
                          }}
                          title="Code editor"
                          description="Edit the code, run it in the browser, and submit the version you want graded."
                          placeholder={question.starter_code || 'Write your solution here...'}
                          showReset
                          resetLabel="Reset starter"
                        />
                      )}

                      {!isCodingQuestion(question) && (question.question_type === 'short_answer' || question.question_type === 'long_answer') && (
                        <Textarea
                          value={answers[question.id]?.answerText || ''}
                          onChange={(event) => updateAnswer(question, { answerText: event.target.value })}
                          className="min-h-[120px]"
                        />
                      )}

                      <div className="text-xs text-muted-foreground">
                        {savingQuestionId === question.id ? 'Saving answer...' : 'Autosaved'}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-[24px] border-white/10 bg-black/10">
              <CardHeader>
                <CardTitle>Assessment controls</CardTitle>
                <CardDescription>Keep moving steadily and submit only when ready.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Remaining time
                  </div>
                  <div className="mt-2 text-lg font-semibold text-foreground">
                    {remainingMs !== null ? formatRemainingTime(remainingMs) : 'Untimed'}
                  </div>
                </div>

                {isStrictMode && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Strict malpractice restrictions active
                    </div>
                    <p className="mt-2 text-sm">Stay in fullscreen and avoid switching tabs, copying, or opening menus.</p>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                    <div className="flex items-center gap-2 text-rose-100">
                      <AlertTriangle className="h-4 w-4" />
                      Recent integrity warnings
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-rose-100/80">
                      {warnings.slice(-4).map((warning, index) => (
                        <div key={`${warning.eventType}-${index}`}>{warning.eventType} ({warning.severity})</div>
                      ))}
                    </div>
                  </div>
                )}

                <Button className="w-full h-11" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
