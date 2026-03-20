'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Brain,
  ClipboardCheck,
  Clock3,
  Code2,
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
import { formatIst } from '@/lib/classrooms/format'

const initialForm = {
  deliveryMode: 'standard',
  codingLanguage: 'javascript',
  creationMethod: 'manual',
  title: '',
  description: '',
  instructions: '',
  assessmentType: 'graded',
  classroomCourseId: '',
  durationMinutes: '30',
  maxAttempts: '1',
  openAt: '',
  closeAt: '',
  strictMode: false,
  showResultsImmediately: false,
  questionCount: '10',
  difficulty: '3',
  focus: 'course_topics',
  extraPrompt: '',
  questionTypes: 'mcq,multi_select,true_false,short_answer,long_answer,numeric'
}

export default function TeacherAssessmentListPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [classroom, setClassroom] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [form, setForm] = useState(initialForm)

  const loadData = useCallback(async () => {
    try {
      const [classroomResponse, assessmentsResponse] = await Promise.all([
        fetch(`/api/teacher/classrooms/${params.classroomId}`),
        fetch(`/api/teacher/classrooms/${params.classroomId}/assessments`)
      ])

      const [classroomPayload, assessmentsPayload] = await Promise.all([
        classroomResponse.json(),
        assessmentsResponse.json()
      ])

      if (!classroomResponse.ok) {
        throw new Error(classroomPayload.error || 'Failed to load classroom')
      }

      if (!assessmentsResponse.ok) {
        throw new Error(assessmentsPayload.error || 'Failed to load assessments')
      }

      setClassroom(classroomPayload.classroom || null)
      setAssessments(assessmentsPayload.assessments || [])
      if (!form.classroomCourseId && classroomPayload.courses?.[0]?.id) {
        setForm((current) => ({ ...current, classroomCourseId: classroomPayload.courses[0].id }))
      }
    } catch (error) {
      toast.error(error.message)
      router.push(`/teacher/classrooms/${params.classroomId}`)
    } finally {
      setLoading(false)
    }
  }, [form.classroomCourseId, params.classroomId, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = useMemo(() => ({
    total: assessments.length,
    published: assessments.filter((assessment) => assessment.status === 'published').length,
    pendingReview: assessments.reduce((sum, assessment) => sum + (assessment.pendingReviewCount || 0), 0),
    secure: assessments.filter((assessment) => assessment.assessment_type === 'secure').length
  }), [assessments])

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Assessment title is required')
      return
    }

    setCreating(true)

    try {
      const payload = {
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        assessmentType: form.assessmentType,
        classroomCourseId: form.classroomCourseId || null,
        durationMinutes: form.durationMinutes,
        maxAttempts: form.maxAttempts,
        openAt: form.openAt || null,
        closeAt: form.closeAt || null,
        strictMode: form.strictMode,
        showResultsImmediately: form.showResultsImmediately,
        metadata: {
          deliveryMode: form.deliveryMode,
          codingLanguage: form.deliveryMode === 'coding' ? form.codingLanguage : null
        },
        creationMethod: form.creationMethod,
        generatorConfig: form.creationMethod === 'ai'
          ? {
              questionCount: form.questionCount,
              difficulty: form.difficulty,
              focus: form.focus,
              extraPrompt: form.extraPrompt,
              questionTypes: form.questionTypes.split(',').map((value) => value.trim()).filter(Boolean)
            }
          : undefined
      }

      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create assessment')
      }

      toast.success(form.creationMethod === 'ai' ? 'AI assessment draft created' : 'Assessment draft created')
      setIsCreateOpen(false)
      setForm(initialForm)
      router.push(`/teacher/classrooms/${params.classroomId}/assessments/${data.assessment.id}`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading assessment center...</div>
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-primary/15 via-background to-orange-500/10 px-6 py-7 shadow-[0_24px_80px_-48px_rgba(249,115,22,0.45)] md:px-8 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <Button variant="ghost" className="mb-4 -ml-2 w-fit text-muted-foreground" onClick={() => router.push(`/teacher/classrooms/${params.classroomId}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Classroom
              </Button>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                Assessment Center
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                {classroom?.name || 'Classroom'} Assessments
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Create manual or AI-assisted assessments, publish them into the classroom, and review performance with integrity signals.
              </p>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="h-11">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Assessment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>New assessment</DialogTitle>
                  <DialogDescription>
                    Start with a manual draft or let AI generate a question set aligned to this classroom.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="assignment-type">Assignment type</Label>
                    <select
                      id="assignment-type"
                      value={form.deliveryMode}
                      onChange={(event) => {
                        const nextMode = event.target.value === 'coding' ? 'coding' : 'standard'
                        setForm((current) => ({
                          ...current,
                          deliveryMode: nextMode,
                          creationMethod: nextMode === 'coding' ? 'manual' : current.creationMethod
                        }))
                      }}
                      className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                    >
                      <option value="standard">Standard Assessment</option>
                      <option value="coding">Coding Assignment</option>
                    </select>
                  </div>

                  {form.deliveryMode === 'coding' && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                      Coding assignments are manual-only for now and support only <span className="font-medium text-foreground">Python</span> or <span className="font-medium text-foreground">JavaScript</span>.
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      variant={form.creationMethod === 'manual' ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setForm((current) => ({ ...current, creationMethod: 'manual' }))}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Manual Draft
                    </Button>
                    <Button
                      variant={form.creationMethod === 'ai' ? 'default' : 'outline'}
                      className="justify-start"
                      disabled={form.deliveryMode === 'coding'}
                      onClick={() => setForm((current) => ({ ...current, creationMethod: 'ai' }))}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI Draft
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="assessment-title">Title</Label>
                      <Input id="assessment-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="assessment-description">Description</Label>
                      <Textarea id="assessment-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="assessment-instructions">Instructions</Label>
                      <Textarea id="assessment-instructions" value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assessment-type">Assessment category</Label>
                      <select
                        id="assessment-type"
                        value={form.assessmentType}
                        onChange={(event) => setForm((current) => ({ ...current, assessmentType: event.target.value }))}
                        className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                      >
                        <option value="practice">Practice</option>
                        <option value="graded">Graded Assignment</option>
                        <option value="secure">Secure Assessment</option>
                      </select>
                    </div>

                    {form.deliveryMode === 'coding' && (
                      <div className="space-y-2">
                        <Label htmlFor="coding-language">Coding language</Label>
                        <select
                          id="coding-language"
                          value={form.codingLanguage}
                          onChange={(event) => setForm((current) => ({ ...current, codingLanguage: event.target.value }))}
                          className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="assessment-course">Course</Label>
                      <select
                        id="assessment-course"
                        value={form.classroomCourseId}
                        onChange={(event) => setForm((current) => ({ ...current, classroomCourseId: event.target.value }))}
                        className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                      >
                        <option value="">All classroom topics</option>
                        {(classroom?.courses || []).map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.subjects?.title || 'Untitled course'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration-minutes">Duration (minutes)</Label>
                      <Input id="duration-minutes" type="number" value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-attempts">Max attempts</Label>
                      <Input id="max-attempts" type="number" value={form.maxAttempts} onChange={(event) => setForm((current) => ({ ...current, maxAttempts: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-at">Open at</Label>
                      <Input id="open-at" type="datetime-local" value={form.openAt} onChange={(event) => setForm((current) => ({ ...current, openAt: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="close-at">Close at</Label>
                      <Input id="close-at" type="datetime-local" value={form.closeAt} onChange={(event) => setForm((current) => ({ ...current, closeAt: event.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={form.strictMode} onChange={(event) => setForm((current) => ({ ...current, strictMode: event.target.checked }))} />
                      Enable strict malpractice restrictions
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={form.showResultsImmediately} onChange={(event) => setForm((current) => ({ ...current, showResultsImmediately: event.target.checked }))} />
                      Show results immediately after grading
                    </label>
                  </div>

                  {form.creationMethod === 'ai' && form.deliveryMode !== 'coding' && (
                    <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Brain className="h-4 w-4 text-primary" />
                        AI generation controls
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="question-count">Question count</Label>
                          <Input id="question-count" type="number" value={form.questionCount} onChange={(event) => setForm((current) => ({ ...current, questionCount: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="difficulty">Difficulty</Label>
                          <Input id="difficulty" type="number" min="1" max="5" value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="focus">Focus</Label>
                          <select
                            id="focus"
                            value={form.focus}
                            onChange={(event) => setForm((current) => ({ ...current, focus: event.target.value }))}
                            className="flex h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary/40"
                          >
                            <option value="course_topics">Course topics</option>
                            <option value="weak_topics">Weak topics</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="question-types">Question types</Label>
                          <Input id="question-types" value={form.questionTypes} onChange={(event) => setForm((current) => ({ ...current, questionTypes: event.target.value }))} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="extra-prompt">Extra prompt</Label>
                          <Textarea id="extra-prompt" value={form.extraPrompt} onChange={(event) => setForm((current) => ({ ...current, extraPrompt: event.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? 'Creating...' : form.creationMethod === 'ai' ? 'Generate Draft' : 'Create Draft'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Total assessments</CardDescription>
                <CardTitle className="text-3xl">{summary.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Published</CardDescription>
                <CardTitle className="text-3xl">{summary.published}</CardTitle>
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
                <CardDescription>Secure mode</CardDescription>
                <CardTitle className="text-3xl">{summary.secure}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {assessments.length === 0 ? (
        <Card className="rounded-[24px] border-dashed border-white/10 bg-black/10">
          <CardHeader className="items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No assessments yet</CardTitle>
            <CardDescription>
              Create a manual draft or use AI to generate the first classroom assessment.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assessments.map((assessment) => (
            <Card
              key={assessment.id}
              className="group cursor-pointer rounded-[24px] border-white/10 bg-gradient-to-br from-black/20 to-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-primary/30"
              onClick={() => router.push(`/teacher/classrooms/${params.classroomId}/assessments/${assessment.id}`)}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="line-clamp-2 text-xl">{assessment.title}</CardTitle>
                    <CardDescription className="mt-2 line-clamp-3 leading-6">
                      {assessment.description || 'No description provided.'}
                    </CardDescription>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    assessment.status === 'published'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                  }`}>
                    {assessment.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-muted-foreground">Questions</div>
                    <div className="mt-2 text-lg font-semibold">{assessment.questionCount || 0}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-muted-foreground">Attempts</div>
                    <div className="mt-2 text-lg font-semibold">{assessment.attemptCount || 0}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-muted-foreground">Pending review</div>
                    <div className="mt-2 text-lg font-semibold">{assessment.pendingReviewCount || 0}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-muted-foreground">Average score</div>
                    <div className="mt-2 text-lg font-semibold">{assessment.averageScore ?? 'N/A'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground">
                    {assessment.strict_mode ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Clock3 className="h-4 w-4 text-primary" />}
                    {assessment.delivery_mode === 'coding'
                      ? `${assessment.coding_language} coding assignment`
                      : assessment.assessment_type === 'secure'
                        ? 'Secure assessment'
                        : `${assessment.assessment_type} assessment`}
                  </div>
                  <p className="mt-2">
                    {assessment.open_at
                      ? `Opens ${formatIst(assessment.open_at)} IST`
                      : 'Available immediately'}
                    {assessment.close_at ? ` • Closes ${formatIst(assessment.close_at)} IST` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
