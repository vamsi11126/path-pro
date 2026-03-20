'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ClipboardCheck, Clock3, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatIst } from '@/lib/classrooms/format'

export default function ClassroomAssessmentsPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classroom, setClassroom] = useState(null)
  const [assessments, setAssessments] = useState([])

  const loadData = useCallback(async () => {
    try {
      const [classroomResponse, assessmentsResponse] = await Promise.all([
        fetch(`/api/classrooms/${params.classroomId}`),
        fetch(`/api/classrooms/${params.classroomId}/assessments`)
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
    } catch (error) {
      toast.error(error.message)
      router.push(`/classrooms/${params.classroomId}`)
    } finally {
      setLoading(false)
    }
  }, [params.classroomId, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = useMemo(() => ({
    total: assessments.length,
    active: assessments.filter((assessment) => assessment.availabilityLabel === 'Available' || assessment.availabilityLabel === 'Resume').length,
    completed: assessments.filter((assessment) => assessment.availabilityLabel === 'Completed').length,
    secure: assessments.filter((assessment) => assessment.assessment_type === 'secure').length
  }), [assessments])

  if (loading) {
    return <div className="text-muted-foreground">Loading assessments...</div>
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-primary/10 via-background to-sky-500/10 px-6 py-7 shadow-[0_24px_80px_-48px_rgba(14,165,233,0.45)] md:px-8 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-6">
          <div className="max-w-3xl">
            <Button variant="ghost" className="mb-4 -ml-2 w-fit text-muted-foreground" onClick={() => router.push(`/classrooms/${params.classroomId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classroom
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
              Classroom Assessments
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{classroom?.name || 'Classroom'} Assessments</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Start graded work, resume secure assessments, and track which submissions are complete or still under review.
            </p>
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
                <CardDescription>Active now</CardDescription>
                <CardTitle className="text-3xl">{summary.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/[0.04] shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
                <CardTitle className="text-3xl">{summary.completed}</CardTitle>
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
            <CardTitle>No assessments assigned yet</CardTitle>
            <CardDescription>Your teacher has not published any assessments for this classroom yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assessments.map((assessment) => (
            <Card
              key={assessment.id}
              className="group cursor-pointer rounded-[24px] border-white/10 bg-gradient-to-br from-black/20 to-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-primary/30"
              onClick={() => router.push(`/classrooms/${params.classroomId}/assessments/${assessment.id}`)}
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
                    assessment.availabilityLabel === 'Resume'
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : assessment.availabilityLabel === 'Completed'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.04] text-muted-foreground'
                  }`}>
                    {assessment.availabilityLabel}
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
                    <div className="text-muted-foreground">Best score</div>
                    <div className="mt-2 text-lg font-semibold">{assessment.latestResult?.percentage ?? 'N/A'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground">
                    {assessment.strict_mode ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    {assessment.delivery_mode === 'coding'
                      ? `${assessment.coding_language} coding assignment`
                      : assessment.assessment_type === 'secure'
                        ? 'Secure assessment'
                        : `${assessment.assessment_type} assessment`}
                  </div>
                  <p className="mt-2">
                    {assessment.open_at ? `Opens ${formatIst(assessment.open_at)} IST` : 'Available immediately'}
                    {assessment.close_at ? ` • Closes ${formatIst(assessment.close_at)} IST` : ''}
                  </p>
                  <p className="mt-2 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {assessment.duration_minutes ? `${assessment.duration_minutes} minute timer` : 'Untimed'}
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
