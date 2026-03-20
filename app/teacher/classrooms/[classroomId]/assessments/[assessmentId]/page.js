'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Code2,
  Eye,
  Plus,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatIst } from '@/lib/classrooms/format'
import CodingPlayground from '@/components/classrooms/CodingPlayground'

function createInitialQuestionForm(detail = null) {
  const assessment = detail?.assessment
  const codingLanguage = assessment?.coding_language || 'javascript'
  const defaultTopicId = detail?.availableTopics?.[0]?.id || ''
  const isCodingAssessment = assessment?.delivery_mode === 'coding'

  return {
    questionType: isCodingAssessment ? 'coding' : 'mcq',
    codingLanguage,
    starterCode: '',
    topicId: '',
    prompt: '',
    points: '1',
    difficulty: '3',
    answerExplanation: '',
    optionsText: '',
    correctAnswers: '',
    numericAnswer: '',
    numericTolerance: '0',
    rubricText: '',
    evaluationNotes: '',
    ...(defaultTopicId ? { topicId: defaultTopicId } : {})
  }
}

function formatAttemptScore(attempt) {
  if (attempt.result?.percentage !== null && attempt.result?.percentage !== undefined) {
    return `${attempt.result.percentage}%`
  }

  if (attempt.percentage !== null && attempt.percentage !== undefined) {
    return `${attempt.percentage}%`
  }

  return 'Pending'
}

function formatStudentAnswer(question) {
  const answer = question.answer
  if (!answer) return 'No answer'

  if (question.display_question_type === 'coding') {
    return answer.answer_text || 'No code submitted'
  }

  if (question.question_type === 'mcq' || question.question_type === 'true_false') {
    return (question.options || [])
      .filter((option) => (answer.selected_option_ids || []).includes(option.id))
      .map((option) => option.option_text)
      .join(', ') || 'No answer'
  }

  if (question.question_type === 'multi_select') {
    return (question.options || [])
      .filter((option) => (answer.selected_option_ids || []).includes(option.id))
      .map((option) => option.option_text)
      .join(', ') || 'No answer'
  }

  if (question.question_type === 'numeric') {
    return answer.numeric_answer ?? 'No answer'
  }

  if (question.question_type === 'match') {
    return JSON.stringify(answer.answer_json || {})
  }

  return answer.answer_text || 'No answer'
}

function getRubricItems(question) {
  const rubricSource = question?.rubric?.rubric_json || question?.rubric || []
  return Array.isArray(rubricSource) ? rubricSource : []
}

function getCorrectOptionTexts(question) {
  return (question.options || [])
    .filter((option) => option.is_correct)
    .map((option) => option.option_text)
}

function buildTeacherReference(question) {
  const rubricItems = getRubricItems(question)
  const answerKey = question.answer_key || {}
  const explanation = question.answer_explanation || ''

  if (question.display_question_type === 'coding') {
    return {
      title: 'Teacher guide',
      details: [
        question.metadata?.evaluationNotes ? `Evaluation notes: ${question.metadata.evaluationNotes}` : null,
        explanation ? `Explanation: ${explanation}` : null
      ].filter(Boolean),
      code: question.starter_code || '',
      codeLabel: question.starter_code ? 'Starter code' : '',
      rubricItems
    }
  }

  if (question.question_type === 'mcq' || question.question_type === 'multi_select' || question.question_type === 'true_false') {
    const correctOptions = getCorrectOptionTexts(question)
    const correctValue = answerKey.correctValue

    return {
      title: 'Expected answer',
      details: [
        correctOptions.length > 0
          ? `Correct option${correctOptions.length > 1 ? 's' : ''}: ${correctOptions.join(', ')}`
          : correctValue !== undefined && correctValue !== null
            ? `Correct answer: ${String(correctValue)}`
            : null,
        explanation ? `Explanation: ${explanation}` : null
      ].filter(Boolean),
      rubricItems
    }
  }

  if (question.question_type === 'short_answer') {
    const acceptedAnswers = Array.isArray(answerKey.acceptedAnswers) ? answerKey.acceptedAnswers : []
    return {
      title: 'Expected answer',
      details: [
        acceptedAnswers.length > 0 ? `Accepted answers: ${acceptedAnswers.join(', ')}` : null,
        explanation ? `Explanation: ${explanation}` : null
      ].filter(Boolean),
      rubricItems
    }
  }

  if (question.question_type === 'numeric') {
    const numericAnswer = answerKey.numericAnswer
    const tolerance = answerKey.tolerance

    return {
      title: 'Expected answer',
      details: [
        numericAnswer !== undefined && numericAnswer !== null ? `Expected value: ${numericAnswer}` : null,
        tolerance !== undefined && tolerance !== null ? `Tolerance: ${tolerance}` : null,
        explanation ? `Explanation: ${explanation}` : null
      ].filter(Boolean),
      rubricItems
    }
  }

  if (question.question_type === 'match') {
    const matches = answerKey.matches && typeof answerKey.matches === 'object'
      ? Object.entries(answerKey.matches).map(([left, right]) => `${left} -> ${right}`)
      : []

    return {
      title: 'Expected answer',
      details: [
        ...matches,
        ...(explanation ? [`Explanation: ${explanation}`] : [])
      ].filter(Boolean),
      rubricItems
    }
  }

  return {
    title: 'Teacher guide',
    details: explanation ? [`Explanation: ${explanation}`] : [],
    rubricItems
  }
}

function buildQuestionPayload(form) {
  const base = {
    questionType: form.questionType,
    topicId: form.topicId || null,
    prompt: form.prompt,
    points: Number(form.points || 1),
    difficulty: Number(form.difficulty || 3),
    answerExplanation: form.answerExplanation
  }

  if (form.questionType === 'coding') {
    return {
      ...base,
      rubric: form.rubricText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [criterion, points] = line.split('|').map((value) => value.trim())
          return {
            criterion: criterion || 'Criterion',
            points: Number(points || 1),
            description: criterion || 'Evaluate this criterion'
          }
        }),
      metadata: {
        interactionType: 'coding',
        language: form.codingLanguage,
        starterCode: form.starterCode,
        evaluationNotes: form.evaluationNotes
      }
    }
  }

  if (form.questionType === 'numeric') {
    return {
      ...base,
      answerKey: {
        numericAnswer: Number(form.numericAnswer || 0),
        tolerance: Number(form.numericTolerance || 0)
      }
    }
  }

  if (form.questionType === 'short_answer') {
    return {
      ...base,
      answerKey: {
        acceptedAnswers: form.correctAnswers.split(',').map((value) => value.trim()).filter(Boolean)
      }
    }
  }

  if (form.questionType === 'long_answer') {
    return {
      ...base,
      rubric: form.rubricText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [criterion, points] = line.split('|').map((value) => value.trim())
          return {
            criterion: criterion || 'Criterion',
            points: Number(points || 1),
            description: criterion || 'Evaluate this criterion'
          }
        })
    }
  }

  if (form.questionType === 'match') {
    const pairs = form.optionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [left, right] = line.split('=>').map((value) => value.trim())
        return {
          label: String(index + 1),
          left,
          right
        }
      })
      .filter((pair) => pair.left && pair.right)

    return {
      ...base,
      options: pairs.map((pair, index) => ({
        label: String(index + 1),
        optionText: pair.right,
        isCorrect: true,
        matchKey: pair.left
      })),
      answerKey: {
        matches: pairs.reduce((accumulator, pair) => {
          accumulator[pair.left] = pair.right
          return accumulator
        }, {})
      }
    }
  }

  const options = form.optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((optionText, index) => ({
      label: String.fromCharCode(65 + index),
      optionText
    }))

  const correctTokens = form.correctAnswers
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    ...base,
    options: options.map((option) => ({
      ...option,
      isCorrect: correctTokens.includes(option.label) || correctTokens.includes(option.optionText)
    })),
    answerKey: {
      correctLabels: correctTokens
    }
  }
}

export default function TeacherAssessmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [detail, setDetail] = useState(null)
  const [questionForm, setQuestionForm] = useState(createInitialQuestionForm())
  const [isQuestionOpen, setIsQuestionOpen] = useState(false)
  const [reviewDialog, setReviewDialog] = useState({ open: false, attemptId: null, loading: false, data: null })
  const [reviewPayload, setReviewPayload] = useState({})
  const [teacherFeedback, setTeacherFeedback] = useState('')

  const loadDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/assessments/${params.assessmentId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load assessment')
      }

      setDetail(data)
      setQuestionForm((current) => ({
        ...createInitialQuestionForm(data),
        ...current,
        questionType: data.assessment?.delivery_mode === 'coding' ? 'coding' : current.questionType,
        codingLanguage: data.assessment?.coding_language || current.codingLanguage || 'javascript',
        topicId: current.topicId || data.availableTopics?.[0]?.id || ''
      }))
    } catch (error) {
      toast.error(error.message)
      router.push(`/teacher/classrooms/${params.classroomId}/assessments`)
    } finally {
      setLoading(false)
    }
  }, [params.assessmentId, params.classroomId, router])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const summary = useMemo(() => ({
    questions: detail?.questions?.length || 0,
    attempts: detail?.attempts?.length || 0,
    pendingReview: detail?.assessment?.pendingReviewCount || 0,
    averageScore: detail?.assessment?.averageScore ?? 'N/A'
  }), [detail])
  const isCodingAssessment = detail?.assessment?.delivery_mode === 'coding'

  const handlePublish = async () => {
    setPublishing(true)

    try {
      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/assessments/${params.assessmentId}/publish`, {
        method: 'POST'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish assessment')
      }

      toast.success('Assessment published')
      setDetail(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setPublishing(false)
    }
  }

  const handleAddQuestion = async () => {
    if (!questionForm.prompt.trim()) {
      toast.error('Question prompt is required')
      return
    }

    setSavingQuestion(true)

    try {
      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/assessments/${params.assessmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add-question',
          question: buildQuestionPayload(questionForm)
        })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add question')
      }

      toast.success('Question added')
      setDetail(data)
      setQuestionForm(createInitialQuestionForm(data))
      setIsQuestionOpen(false)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingQuestion(false)
    }
  }

  const openAttemptReview = async (attemptId) => {
    setReviewDialog({ open: true, attemptId, loading: true, data: null })

    try {
      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/assessments/${params.assessmentId}/attempts/${attemptId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load attempt review')
      }

      const initialReviewPayload = {}
      data.questions.forEach((question) => {
        initialReviewPayload[question.id] = {
          score: question.answer?.teacher_score ?? 0,
          feedback: question.answer?.feedback || ''
        }
      })

      setReviewPayload(initialReviewPayload)
      setTeacherFeedback(data.result?.teacher_feedback || '')
      setReviewDialog({ open: true, attemptId, loading: false, data })
    } catch (error) {
      toast.error(error.message)
      setReviewDialog({ open: false, attemptId: null, loading: false, data: null })
    }
  }

  const submitReview = async () => {
    if (!reviewDialog.data) {
      return
    }

    setReviewing(true)

    try {
      const reviews = reviewDialog.data.questions
        .filter((question) => question.answer)
        .map((question) => ({
          questionId: question.id,
          score: Number(reviewPayload[question.id]?.score || 0),
          feedback: reviewPayload[question.id]?.feedback || ''
        }))

      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/assessments/${params.assessmentId}/attempts/${reviewDialog.attemptId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reviews,
          teacherFeedback,
          publishToStudent: true
        })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to finalize review')
      }

      toast.success('Attempt review saved')
      setReviewDialog({ open: false, attemptId: null, loading: false, data: null })
      await loadDetail()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setReviewing(false)
    }
  }

  if (loading || !detail) {
    return <div className="text-muted-foreground">Loading assessment...</div>
  }

  return (
    <>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-primary/15 via-background to-emerald-500/10 px-6 py-7 shadow-[0_24px_80px_-48px_rgba(59,130,246,0.45)] md:px-8 md:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <Button variant="ghost" className="mb-4 -ml-2 w-fit text-muted-foreground" onClick={() => router.push(`/teacher/classrooms/${params.classroomId}/assessments`)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Assessments
                </Button>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  {isCodingAssessment ? <Code2 className="h-3.5 w-3.5 text-primary" /> : <ClipboardList className="h-3.5 w-3.5 text-primary" />}
                  {isCodingAssessment ? `${detail.assessment.coding_language} coding assignment` : `${detail.assessment.assessment_type} assessment`}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{detail.assessment.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  {detail.assessment.description || 'No description provided.'}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {detail.assessment.instructions || 'No custom instructions configured yet.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Dialog open={isQuestionOpen} onOpenChange={setIsQuestionOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-11 border-white/10 bg-white/5">
                      <Plus className="mr-2 h-4 w-4" />
                      {isCodingAssessment ? 'Add Coding Prompt' : 'Add Question'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add question</DialogTitle>
                      <DialogDescription>
                        {isCodingAssessment
                          ? 'Create a coding prompt with starter code in Python or JavaScript.'
                          : 'Build manual questions and attach them directly to the classroom assessment.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="question-prompt">Prompt</Label>
                        <Textarea id="question-prompt" value={questionForm.prompt} onChange={(event) => setQuestionForm((current) => ({ ...current, prompt: event.target.value }))} />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {!isCodingAssessment && (
                          <div className="space-y-2">
                            <Label htmlFor="question-type">Type</Label>
                            <select
                              id="question-type"
                              value={questionForm.questionType}
                              onChange={(event) => setQuestionForm((current) => ({ ...current, questionType: event.target.value }))}
                              className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                            >
                              <option value="mcq">MCQ</option>
                              <option value="multi_select">Multi Select</option>
                              <option value="true_false">True / False</option>
                              <option value="short_answer">Short Answer</option>
                              <option value="long_answer">Long Answer</option>
                              <option value="numeric">Numeric</option>
                              <option value="match">Match</option>
                            </select>
                          </div>
                        )}

                        {isCodingAssessment && (
                          <div className="space-y-2">
                            <Label htmlFor="coding-language">Language</Label>
                            <select
                              id="coding-language"
                              value={questionForm.codingLanguage}
                              onChange={(event) => setQuestionForm((current) => ({ ...current, codingLanguage: event.target.value }))}
                              className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                            >
                              <option value="javascript">JavaScript</option>
                              <option value="python">Python</option>
                            </select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="question-topic">Topic</Label>
                          <select
                            id="question-topic"
                            value={questionForm.topicId}
                            onChange={(event) => setQuestionForm((current) => ({ ...current, topicId: event.target.value }))}
                            className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                          >
                            <option value="">General</option>
                            {detail.availableTopics.map((topic) => (
                              <option key={topic.id} value={topic.id}>{topic.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="question-points">Points</Label>
                          <Input id="question-points" type="number" value={questionForm.points} onChange={(event) => setQuestionForm((current) => ({ ...current, points: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="question-difficulty">Difficulty</Label>
                          <Input id="question-difficulty" type="number" min="1" max="5" value={questionForm.difficulty} onChange={(event) => setQuestionForm((current) => ({ ...current, difficulty: event.target.value }))} />
                        </div>
                      </div>

                      {isCodingAssessment && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="coding-starter-code">Starter code</Label>
                            <Textarea
                              id="coding-starter-code"
                              value={questionForm.starterCode}
                              onChange={(event) => setQuestionForm((current) => ({ ...current, starterCode: event.target.value }))}
                              className="min-h-[180px] font-mono text-sm"
                              placeholder={questionForm.codingLanguage === 'python'
                                ? 'def solve():\n    # write your answer here\n    print("hello")'
                                : 'function solve() {\n  // write your answer here\n  console.log("hello")\n}'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="coding-evaluation-notes">Evaluation notes</Label>
                            <Textarea
                              id="coding-evaluation-notes"
                              value={questionForm.evaluationNotes}
                              onChange={(event) => setQuestionForm((current) => ({ ...current, evaluationNotes: event.target.value }))}
                              placeholder="What should a strong solution demonstrate?"
                            />
                          </div>
                        </>
                      )}

                      {(questionForm.questionType === 'mcq' || questionForm.questionType === 'multi_select' || questionForm.questionType === 'true_false' || questionForm.questionType === 'match') && (
                        <div className="space-y-2">
                          <Label htmlFor="question-options">
                            {questionForm.questionType === 'match' ? 'Match pairs (one "left => right" pair per line)' : 'Options (one per line)'}
                          </Label>
                          <Textarea id="question-options" value={questionForm.optionsText} onChange={(event) => setQuestionForm((current) => ({ ...current, optionsText: event.target.value }))} />
                        </div>
                      )}

                      {(questionForm.questionType === 'mcq' || questionForm.questionType === 'multi_select' || questionForm.questionType === 'short_answer') && (
                        <div className="space-y-2">
                          <Label htmlFor="question-correct">
                            {questionForm.questionType === 'short_answer' ? 'Accepted answers (comma separated)' : 'Correct answers (labels like A,B or exact option text)'}
                          </Label>
                          <Input id="question-correct" value={questionForm.correctAnswers} onChange={(event) => setQuestionForm((current) => ({ ...current, correctAnswers: event.target.value }))} />
                        </div>
                      )}

                      {questionForm.questionType === 'numeric' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="numeric-answer">Numeric answer</Label>
                            <Input id="numeric-answer" type="number" value={questionForm.numericAnswer} onChange={(event) => setQuestionForm((current) => ({ ...current, numericAnswer: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="numeric-tolerance">Tolerance</Label>
                            <Input id="numeric-tolerance" type="number" value={questionForm.numericTolerance} onChange={(event) => setQuestionForm((current) => ({ ...current, numericTolerance: event.target.value }))} />
                          </div>
                        </div>
                      )}

                      {(questionForm.questionType === 'long_answer' || questionForm.questionType === 'coding') && (
                        <div className="space-y-2">
                          <Label htmlFor="rubric-text">Rubric lines (&quot;Criterion | Points&quot;)</Label>
                          <Textarea id="rubric-text" value={questionForm.rubricText} onChange={(event) => setQuestionForm((current) => ({ ...current, rubricText: event.target.value }))} />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="question-explanation">Answer explanation</Label>
                        <Textarea id="question-explanation" value={questionForm.answerExplanation} onChange={(event) => setQuestionForm((current) => ({ ...current, answerExplanation: event.target.value }))} />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setIsQuestionOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddQuestion} disabled={savingQuestion}>
                        {savingQuestion ? 'Saving...' : 'Add Question'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {detail.assessment.status !== 'published' && (
                  <Button className="h-11" onClick={handlePublish} disabled={publishing}>
                    {publishing ? 'Publishing...' : 'Publish Assessment'}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-white/10 bg-white/[0.04] shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>Questions</CardDescription>
                  <CardTitle className="text-3xl">{summary.questions}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-white/10 bg-white/[0.04] shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>Attempts</CardDescription>
                  <CardTitle className="text-3xl">{summary.attempts}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-white/10 bg-white/[0.04] shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>Pending review</CardDescription>
                  <CardTitle className="text-3xl">{summary.pendingReview}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-white/10 bg-white/[0.04] shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>Average score</CardDescription>
                  <CardTitle className="text-3xl">{summary.averageScore}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <Card className="rounded-[24px] border-white/10 bg-black/10">
            <CardHeader>
              <CardTitle>Question bank inside this assessment</CardTitle>
              <CardDescription>Manual and AI-authored questions currently attached to this assessment.</CardDescription>
            </CardHeader>
            <CardContent>
              {detail.questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-muted-foreground">
                  No questions yet. Add manual questions or generate an AI draft before publishing.
                </div>
              ) : (
                <div className="space-y-4">
                  {detail.questions.map((question, index) => (
                    <div key={question.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Question {index + 1}</div>
                          <div className="mt-2 font-medium text-foreground">{question.prompt}</div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{question.display_question_type}</span>
                            {question.coding_language && <span>{question.coding_language}</span>}
                            <span>{question.points} pt</span>
                            <span>Difficulty {question.difficulty}/5</span>
                            <span>{question.topic?.title || 'General'}</span>
                          </div>
                        </div>
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {question.display_question_type === 'coding'
                            ? 'Manual review'
                            : `${question.options?.length || 0} options`}
                        </span>
                      </div>
                      {question.display_question_type === 'coding' && question.starter_code && (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Starter code</div>
                          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-200">
                            {question.starter_code}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="rounded-[24px] border-white/10 bg-black/10">
              <CardHeader>
                <CardTitle>Assessment rules</CardTitle>
                <CardDescription>Strictness, timing, and release settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    {detail.assessment.strict_mode ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    {detail.assessment.strict_mode ? 'Strict monitoring enabled' : 'Standard classroom mode'}
                  </div>
                  <p className="mt-2">
                    {detail.assessment.duration_minutes ? `${detail.assessment.duration_minutes} minute timer` : 'No timer'}
                    {detail.assessment.open_at ? ` • Opens ${formatIst(detail.assessment.open_at)} IST` : ''}
                    {detail.assessment.close_at ? ` • Closes ${formatIst(detail.assessment.close_at)} IST` : ''}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Attempt policy
                  </div>
                  <p className="mt-2">Students can attempt this assessment {detail.assessment.max_attempts} time(s).</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Eye className="h-4 w-4 text-primary" />
                    Result release
                  </div>
                  <p className="mt-2">
                    {detail.assessment.show_results_immediately
                      ? 'Results can be released immediately after grading.'
                      : 'Results stay hidden until the teacher finalizes them.'}
                  </p>
                </div>
                {isCodingAssessment && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2 text-foreground">
                      <Code2 className="h-4 w-4 text-primary" />
                      Coding mode
                    </div>
                    <p className="mt-2">
                      Students answer with runnable code. Supported language for this assignment: {detail.assessment.coding_language}.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-white/10 bg-black/10">
              <CardHeader>
                <CardTitle>Recent attempts</CardTitle>
                <CardDescription>Open a submission to inspect integrity events and manually grade descriptive answers.</CardDescription>
              </CardHeader>
              <CardContent>
                {detail.attempts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                    No student attempts yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detail.attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-foreground">
                                {attempt.student?.full_name || attempt.student?.username || 'Student'}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Attempt {attempt.attempt_number} • {attempt.status}
                              </div>
                            </div>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">
                              {formatAttemptScore(attempt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Risk: {attempt.risk_level}</span>
                            <span>{attempt.submitted_at ? formatIst(attempt.submitted_at) : 'In progress'}</span>
                          </div>
                          <Button variant="outline" className="border-white/10" onClick={() => openAttemptReview(attempt.id)}>
                            Review Attempt
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false, attemptId: null, loading: false, data: null })}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-card sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Attempt review</DialogTitle>
            <DialogDescription>
              Inspect descriptive answers, integrity events, and finalize grading for this submission.
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.loading || !reviewDialog.data ? (
            <div className="text-sm text-muted-foreground">Loading attempt review...</div>
          ) : (
            <div className="space-y-6 py-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">
                  {reviewDialog.data.attempt.student?.full_name || reviewDialog.data.attempt.student?.username || 'Student'}
                </div>
                <div className="mt-2">Risk level: {reviewDialog.data.attempt.risk_level} ({reviewDialog.data.attempt.risk_score || 0})</div>
                <div className="mt-1">Integrity events: {reviewDialog.data.events.length}</div>
              </div>

              <div className="space-y-4">
                {reviewDialog.data.questions.map((question) => (
                  <Card key={question.id} className="border-white/10 bg-white/[0.03]">
                    <CardHeader>
                      <CardTitle className="text-base">{question.prompt}</CardTitle>
                      <CardDescription>
                        {question.display_question_type} � {question.points} point(s)
                      </CardDescription>
                      {question.coding_language && (
                        <div className="text-xs text-muted-foreground">{question.coding_language}</div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        {question.display_question_type === 'coding' ? (
                          <CodingPlayground
                            language={question.coding_language || 'javascript'}
                            value={formatStudentAnswer(question)}
                            readOnly
                            title="Submitted solution"
                            description="Review the student's code and optionally run it in the browser while grading."
                            placeholder="No code submitted."
                          />
                        ) : (
                          <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-muted-foreground">
                            <div className="text-xs uppercase tracking-[0.2em] text-foreground">Student answer</div>
                            <div className="mt-2 whitespace-pre-wrap">{formatStudentAnswer(question)}</div>
                          </div>
                        )}

                        {(() => {
                          const reference = buildTeacherReference(question)
                          const hasReferenceContent = reference.details.length > 0 || reference.rubricItems.length > 0 || Boolean(reference.code)

                          if (!hasReferenceContent) {
                            return (
                              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                                <div className="text-xs uppercase tracking-[0.2em] text-foreground">Teacher guide</div>
                                <div className="mt-2">No answer key or rubric has been added for this question yet.</div>
                              </div>
                            )
                          }

                          return (
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                              <div className="text-xs uppercase tracking-[0.2em] text-foreground">{reference.title}</div>

                              {reference.details.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {reference.details.map((detailLine, index) => (
                                    <div key={`${question.id}-reference-${index}`} className="whitespace-pre-wrap">
                                      {detailLine}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {reference.code && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.2em] text-foreground">
                                    {reference.codeLabel || 'Reference code'}
                                  </div>
                                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-100">
                                    {reference.code}
                                  </pre>
                                </div>
                              )}

                              {reference.rubricItems.length > 0 && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.2em] text-foreground">Rubric</div>
                                  <div className="mt-2 space-y-2">
                                    {reference.rubricItems.map((item, index) => (
                                      <div key={`${question.id}-rubric-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                                        <div className="font-medium text-foreground">
                                          {item.criterion || item.title || `Criterion ${index + 1}`}
                                          {item.points !== undefined && item.points !== null ? ` (${item.points} pts)` : ''}
                                        </div>
                                        {(item.description || item.details) && (
                                          <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                            {item.description || item.details}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Teacher score</Label>
                          <Input
                            type="number"
                            min="0"
                            max={question.points}
                            value={reviewPayload[question.id]?.score ?? 0}
                            onChange={(event) => setReviewPayload((current) => ({
                              ...current,
                              [question.id]: {
                                ...(current[question.id] || {}),
                                score: event.target.value
                              }
                            }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Feedback</Label>
                          <Textarea
                            value={reviewPayload[question.id]?.feedback || ''}
                            onChange={(event) => setReviewPayload((current) => ({
                              ...current,
                              [question.id]: {
                                ...(current[question.id] || {}),
                                feedback: event.target.value
                              }
                            }))}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="teacher-feedback">Overall feedback</Label>
                <Textarea id="teacher-feedback" value={teacherFeedback} onChange={(event) => setTeacherFeedback(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Integrity event log</Label>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  {reviewDialog.data.events.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No integrity events recorded.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviewDialog.data.events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>{event.event_type}</TableCell>
                            <TableCell>{event.event_severity}</TableCell>
                            <TableCell>{formatIst(event.occurred_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewDialog({ open: false, attemptId: null, loading: false, data: null })}>Close</Button>
            <Button onClick={submitReview} disabled={reviewing || reviewDialog.loading || !reviewDialog.data}>
              {reviewing ? 'Saving review...' : 'Finalize Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

