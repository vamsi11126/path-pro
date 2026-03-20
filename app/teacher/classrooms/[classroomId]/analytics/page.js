'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Activity, AlertTriangle, ArrowLeft, BookOpen, ClipboardCheck, Clock3, Crown, RotateCcw, Save, Search, Target, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatInTimeZone, formatIst } from '@/lib/classrooms/format'

function formatMinutes(minutes = 0) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

function formatQuality(value) {
  return value === null || value === undefined ? 'N/A' : `${value}/5`
}

function formatIdle(idleDays) {
  if (idleDays === null) return 'No activity yet'
  if (idleDays <= 0) return 'Active today'
  if (idleDays === 1) return 'Active 1 day ago'
  return `Active ${idleDays} days ago`
}

function formatRewardWeek(reward, timeZone) {
  if (!reward?.weekStart || !reward?.weekEnd) {
    return 'this week'
  }

  const start = formatInTimeZone(reward.weekStart, timeZone, {
    dateStyle: 'medium',
    timeStyle: undefined
  })
  const end = formatInTimeZone(reward.weekEnd, timeZone, {
    dateStyle: 'medium',
    timeStyle: undefined
  })

  return `${start} to ${end}`
}

function getAttentionClasses(level) {
  if (level === 'high') return 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
  if (level === 'medium') return 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200'
  if (level === 'low') return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
  return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
}

function getTrendIcon(direction) {
  if (direction === 'up' || direction === 'new') return TrendingUp
  if (direction === 'down' || direction === 'inactive') return TrendingDown
  return Activity
}

function StatCard({ icon: Icon, label, value, tone = 'text-primary' }) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-none backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-2 px-4 py-4 sm:px-6 sm:py-6">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`flex items-center gap-2 text-2xl sm:text-3xl ${tone}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

export default function TeacherClassroomAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [assessmentOverview, setAssessmentOverview] = useState({
    total: 0,
    published: 0,
    pendingReview: 0,
    averageScore: 'N/A'
  })
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [query, setQuery] = useState('')
  const [rewardForm, setRewardForm] = useState({
    rewardTitle: '',
    teacherNote: ''
  })
  const [savingReward, setSavingReward] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsResponse, assessmentsResponse] = await Promise.all([
          fetch(`/api/teacher/classrooms/${params.classroomId}/analytics`),
          fetch(`/api/teacher/classrooms/${params.classroomId}/assessments`)
        ])
        const [payload, assessmentsPayload] = await Promise.all([
          analyticsResponse.json(),
          assessmentsResponse.json()
        ])

        if (!analyticsResponse.ok) {
          throw new Error(payload.error || 'Failed to load analytics')
        }

        setAnalytics(payload)

        if (assessmentsResponse.ok) {
          const assessments = assessmentsPayload.assessments || []
          const completed = assessments.filter((assessment) => typeof assessment.averageScore === 'number')
          const averageScore = completed.length > 0
            ? `${Math.round(completed.reduce((sum, assessment) => sum + assessment.averageScore, 0) / completed.length)}%`
            : 'N/A'

          setAssessmentOverview({
            total: assessments.length,
            published: assessments.filter((assessment) => assessment.status === 'published').length,
            pendingReview: assessments.reduce((sum, assessment) => sum + (assessment.pendingReviewCount || 0), 0),
            averageScore
          })
        }
      } catch (error) {
        toast.error(error.message)
        router.push(`/teacher/classrooms/${params.classroomId}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.classroomId, router])

  const activeBadge = analytics?.rewards?.activeBadge || null
  const editableAward = activeBadge || analytics?.rewards?.history?.[0] || null
  const currentWeekLeaderboard = analytics?.rewards?.currentWeek?.leaderboard || []

  useEffect(() => {
    setRewardForm({
      rewardTitle: editableAward?.rewardTitle || '',
      teacherNote: editableAward?.teacherNote || ''
    })
  }, [editableAward?.id, editableAward?.rewardTitle, editableAward?.teacherNote])

  const spotlightStudent = useMemo(() => (
    (activeBadge
      ? analytics?.students?.find((student) => student.studentUserId === activeBadge.winnerStudentUserId)
      : null) ||
    analytics?.insights?.attentionStudents?.[0] ||
    analytics?.insights?.momentumLeader ||
    analytics?.insights?.topPerformer ||
    null
  ), [activeBadge, analytics])

  const students = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return analytics?.students || []

    return (analytics?.students || []).filter((student) => (
      [student.name, student.educationLevel, student.attention?.label, student.attention?.reasons?.join(' ')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    ))
  }, [analytics, query])

  const selectedStudent = useMemo(() => (
    analytics?.students?.find((student) => student.studentUserId === selectedStudentId) || null
  ), [analytics, selectedStudentId])

  const handleSaveReward = async () => {
    if (!editableAward) {
      return
    }

    setSavingReward(true)

    try {
      const response = await fetch(`/api/teacher/classrooms/${params.classroomId}/rewards/${encodeURIComponent(editableAward.weekStartKey)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rewardForm)
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save reward details')
      }

      setAnalytics((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          rewards: {
            ...current.rewards,
            activeBadge: current.rewards?.activeBadge?.id === data.award.id ? data.award : current.rewards?.activeBadge,
            history: (current.rewards?.history || []).map((award) => (
              award.id === data.award.id ? data.award : award
            ))
          }
        }
      })

      toast.success('Reward details saved')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingReward(false)
    }
  }

  if (loading || !analytics) {
    return <div className="text-muted-foreground">Loading analytics...</div>
  }

  const stats = [
    { icon: Users, label: 'Roster', value: analytics.summary.rosterSize },
    { icon: BookOpen, label: 'Courses', value: analytics.summary.totalCourses },
    { icon: ClipboardCheck, label: 'Assessments', value: assessmentOverview.total, tone: 'text-foreground' },
    { icon: TrendingUp, label: 'Active this week', value: analytics.summary.activeStudentsThisWeek, tone: 'text-emerald-600 dark:text-emerald-300' },
    { icon: AlertTriangle, label: 'Need attention', value: analytics.summary.studentsNeedingAttention, tone: 'text-orange-600 dark:text-orange-300' },
    { icon: Target, label: 'Average completion', value: `${analytics.summary.averageCompletion}%`, tone: 'text-foreground' },
    { icon: RotateCcw, label: 'Review quality', value: formatQuality(analytics.summary.averageReviewQuality), tone: 'text-foreground' },
    { icon: ClipboardCheck, label: 'Pending grading', value: assessmentOverview.pendingReview, tone: 'text-orange-600 dark:text-orange-300' }
  ]

  const SpotlightTrend = getTrendIcon(spotlightStudent?.trend?.direction)

  return (
    <>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[24px] border border-border/60 bg-gradient-to-br from-primary/15 via-background to-orange-500/10 px-4 py-6 shadow-[0_24px_80px_-48px_rgba(249,115,22,0.35)] sm:px-6 md:rounded-[28px] md:px-8 md:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <Button variant="ghost" className="mb-4 -ml-2 w-fit text-muted-foreground" onClick={() => router.push(`/teacher/classrooms/${params.classroomId}`)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Classroom
                </Button>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-sm">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Teacher Analytics
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{analytics.classroom.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  Meaningful classroom analytics for intervention, reteaching, and progress checks.
                  {analytics.meta?.generatedAt ? ` Updated ${formatIst(analytics.meta.generatedAt)} IST.` : ' All times are shown in IST.'}
                </p>
              </div>

              {spotlightStudent && (
                <Card className="w-full border-border/60 bg-card/85 backdrop-blur-sm xl:max-w-sm">
                  <CardHeader className="pb-3">
                    <CardDescription>{spotlightStudent.attention?.level === 'on-track' ? 'Class spotlight' : 'Priority student'}</CardDescription>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                          {spotlightStudent.name}
                          {spotlightStudent.isActiveBadgeHolder && (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                              <Crown className="mr-1 h-3.5 w-3.5" />
                              Weekly Star
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="mt-2 text-sm text-muted-foreground">{spotlightStudent.educationLevel || 'Education level not set'}</div>
                      </div>
                      <Badge variant="outline" className={getAttentionClasses(spotlightStudent.attention?.level)}>
                        {spotlightStudent.attention?.label || 'On track'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span>Completion</span>
                        <span className="font-medium text-foreground">{spotlightStudent.overall.completionPercentage}%</span>
                      </div>
                      <Progress value={spotlightStudent.overall.completionPercentage} className="h-2 bg-white/10" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-background/75 p-3 sm:grid-cols-3">
                      <div><div className="text-[11px] uppercase tracking-[0.18em]">Due</div><div className="mt-1 text-lg font-semibold text-foreground">{spotlightStudent.dueReviews}</div></div>
                      <div><div className="text-[11px] uppercase tracking-[0.18em]">Week</div><div className="mt-1 text-lg font-semibold text-foreground">{formatMinutes(spotlightStudent.currentWeekMinutes)}</div></div>
                      <div><div className="text-[11px] uppercase tracking-[0.18em]">Quality</div><div className="mt-1 text-lg font-semibold text-foreground">{formatQuality(spotlightStudent.averageQuality)}</div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SpotlightTrend className="h-4 w-4 text-primary" />
                      <span>{spotlightStudent.trend?.label || 'Steady week'}</span>
                    </div>
                    <Button className="w-full" onClick={() => setSelectedStudentId(spotlightStudent.studentUserId)}>Open Student Analytics</Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-6">
            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>Student performance</CardTitle>
                  <CardDescription>Each student card opens a modal with course, topic, and recent-session analytics.</CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a student" className="border-border/60 bg-background/75 pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/70 p-8 text-center text-sm text-muted-foreground">No students matched your search.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {students.map((student) => {
                      const TrendIcon = getTrendIcon(student.trend.direction)

                      return (
                        <Card key={student.studentUserId} className="rounded-[24px] border-border/60 bg-card/75 transition hover:border-primary/30 hover:bg-accent/40">
                          <CardHeader className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                  {student.name}
                                  {student.isActiveBadgeHolder && (
                                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                      <Crown className="mr-1 h-3.5 w-3.5" />
                                      Weekly Star
                                    </Badge>
                                  )}
                                </CardTitle>
                                <CardDescription className="mt-1">{student.educationLevel || 'Education level not set'}</CardDescription>
                              </div>
                              <Badge variant="outline" className={getAttentionClasses(student.attention.level)}>{student.attention.label}</Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Completion</span><span className="font-medium">{student.overall.completionPercentage}%</span></div>
                              <Progress value={student.overall.completionPercentage} className="h-2 bg-white/10" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-border/60 bg-background/75 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Due</div><div className="mt-1 text-xl font-semibold">{student.dueReviews}</div></div>
                              <div className="rounded-2xl border border-border/60 bg-background/75 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">This week</div><div className="mt-1 text-xl font-semibold">{formatMinutes(student.currentWeekMinutes)}</div></div>
                              <div className="rounded-2xl border border-border/60 bg-background/75 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Quality</div><div className="mt-1 text-xl font-semibold">{formatQuality(student.averageQuality)}</div></div>
                              <div className="rounded-2xl border border-border/60 bg-background/75 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last activity</div><div className="mt-1 text-sm font-semibold">{formatIdle(student.idleDays)}</div></div>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm text-muted-foreground">{student.attention.reasons?.[0] || student.attention.action}</div>
                            {student.activeBadgeMeta?.rewardTitle && (
                              <div className="rounded-2xl border border-amber-300/30 bg-amber-50/80 p-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                {student.activeBadgeMeta.rewardTitle}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <div className="flex items-center gap-2"><TrendIcon className="h-4 w-4 text-primary" />{student.trend.label}</div>
                              <span>{student.trend.changePercentage > 0 ? '+' : ''}{student.trend.changePercentage}%</span>
                            </div>
                            <Button className="w-full" onClick={() => setSelectedStudentId(student.studentUserId)}>Open Student Analytics</Button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Weekly leaderboard</CardTitle>
                <CardDescription>
                  Live rankings for {formatRewardWeek(analytics.rewards?.currentWeek, analytics.classroom.timezone)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentWeekLeaderboard.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/70 p-6 text-sm text-muted-foreground">
                    No qualifying classroom activity has been recorded for this week yet.
                  </div>
                ) : (
                  currentWeekLeaderboard.slice(0, 6).map((entry) => (
                    <div key={entry.studentUserId} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              #{entry.rank}
                            </div>
                            <div className="font-medium text-foreground">{entry.name}</div>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {entry.activeDays} active days • {formatMinutes(entry.weeklyLearningMinutes)} learning • {entry.assessmentSubmissions} assessment submission{entry.assessmentSubmissions === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-foreground">{entry.totalScore}</div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Score</div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Consistency</div>
                          <div className="mt-1 font-semibold">{entry.scoreBreakdown.studyConsistency}</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Reading</div>
                          <div className="mt-1 font-semibold">{entry.scoreBreakdown.courseReading}</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Review</div>
                          <div className="mt-1 font-semibold">{entry.scoreBreakdown.reviewDiscipline}</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Assignments</div>
                          <div className="mt-1 font-semibold">{entry.scoreBreakdown.assignmentContribution.total}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Course overview</CardTitle>
                <CardDescription>Which courses are creating the most pressure across the classroom.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:hidden">
                  {analytics.courses.map((course) => (
                    <div key={course.classroomCourseId} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <div className="font-medium text-foreground">{course.subjectTitle}</div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Students</div>
                          <div className="mt-1 font-semibold">{course.activeStudents}</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Need help</div>
                          <div className="mt-1 font-semibold">{course.studentsNeedingAttention}</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Completion</div>
                          <div className="mt-1 font-semibold">{course.averageCompletion}%</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Due</div>
                          <div className="mt-1 font-semibold">{course.dueReviews}</div>
                        </div>
                        <div className="col-span-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Quality</div>
                          <div className="mt-1 font-semibold">{formatQuality(course.averageQuality)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {analytics.courses.length === 0 && (
                    <div className="text-sm text-muted-foreground">No classroom courses attached yet.</div>
                  )}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>Need help</TableHead>
                        <TableHead>Completion</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Quality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.courses.map((course) => (
                        <TableRow key={course.classroomCourseId}>
                          <TableCell>{course.subjectTitle}</TableCell>
                          <TableCell>{course.activeStudents}</TableCell>
                          <TableCell>{course.studentsNeedingAttention}</TableCell>
                          <TableCell>{course.averageCompletion}%</TableCell>
                          <TableCell>{course.dueReviews}</TableCell>
                          <TableCell>{formatQuality(course.averageQuality)}</TableCell>
                        </TableRow>
                      ))}
                      {analytics.courses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-muted-foreground">No classroom courses attached yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Badge spotlight</CardTitle>
                <CardDescription>
                  {activeBadge
                    ? `Winner for ${formatRewardWeek(activeBadge, analytics.classroom.timezone)}`
                    : 'The next badge appears after a weekly winner is finalized.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeBadge ? (
                  <>
                    <div className="rounded-2xl border border-amber-300/30 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <Crown className="h-4 w-4 text-amber-500" />
                            {activeBadge.winnerName}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Badge active until {formatInTimeZone(new Date(new Date(activeBadge.badgeActiveTo).getTime() - 1), analytics.classroom.timezone)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-foreground">{activeBadge.winnerScore}</div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Score</div>
                        </div>
                      </div>
                      {activeBadge.rewardTitle && <div className="mt-3 text-sm font-medium text-foreground">{activeBadge.rewardTitle}</div>}
                      {activeBadge.teacherNote && <div className="mt-2 text-sm text-muted-foreground">{activeBadge.teacherNote}</div>}
                    </div>

                    <div className="space-y-3">
                      <Input
                        value={rewardForm.rewardTitle}
                        onChange={(event) => setRewardForm((current) => ({ ...current, rewardTitle: event.target.value }))}
                        placeholder="Reward title, prize, or recognition"
                        className="border-border/60 bg-background/75"
                      />
                      <Textarea
                        value={rewardForm.teacherNote}
                        onChange={(event) => setRewardForm((current) => ({ ...current, teacherNote: event.target.value }))}
                        placeholder="Add a short note for the winner"
                        className="min-h-[120px] border-border/60 bg-background/75"
                      />
                      <Button className="w-full" onClick={handleSaveReward} disabled={savingReward}>
                        <Save className="mr-2 h-4 w-4" />
                        {savingReward ? 'Saving...' : 'Save Reward Details'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/70 p-6 text-sm text-muted-foreground">
                    No finalized weekly winner is active yet. Once a week closes and a topper is computed, the badge and reward note controls will appear here.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Topic hotspots</CardTitle>
                <CardDescription>Low-quality or overdue topics to reteach first.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.topics.slice(0, 6).map((topic) => (
                  <div key={topic.topicId} className="rounded-2xl border border-border/60 bg-card/75 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium text-foreground">{topic.topicTitle}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{topic.studentsAtRisk} student{topic.studentsAtRisk === 1 ? '' : 's'} at risk</div>
                      </div>
                      <Badge variant="outline" className={topic.studentsAtRisk > 0 ? 'self-start border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200' : 'self-start border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'}>{topic.dueReviews} due</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Quality</div><div className="mt-1 font-semibold">{formatQuality(topic.averageQuality)}</div></div>
                      <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last activity</div><div className="mt-1 font-semibold break-words">{formatIst(topic.lastActivity)}</div></div>
                    </div>
                  </div>
                ))}
                {analytics.topics.length === 0 && (
                  <div className="text-sm text-muted-foreground">No topic activity yet.</div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Teacher reading</CardTitle>
                <CardDescription>Quick rules for interpreting the dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/60 bg-background/75 p-4"><div className="flex items-center gap-2 text-foreground"><RotateCcw className="h-4 w-4 text-primary" />Due reviews</div><p className="mt-2 leading-6">Rising due reviews usually mean retention is falling before completion numbers make it obvious.</p></div>
                <div className="rounded-2xl border border-border/60 bg-background/75 p-4"><div className="flex items-center gap-2 text-foreground"><Target className="h-4 w-4 text-primary" />Weak review quality</div><p className="mt-2 leading-6">If multiple students show low quality on the same topic, reteach the concept or improve the explanation.</p></div>
                <div className="rounded-2xl border border-border/60 bg-background/75 p-4"><div className="flex items-center gap-2 text-foreground"><Clock3 className="h-4 w-4 text-primary" />Recent momentum</div><p className="mt-2 leading-6">A drop in weekly study time with low completion is the clearest sign to intervene early.</p></div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Assessment pulse</CardTitle>
                <CardDescription>High-level assessment pressure inside this classroom.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                  <div className="font-medium text-foreground">Published assessments</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{assessmentOverview.published}</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                  <div className="font-medium text-foreground">Pending grading</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{assessmentOverview.pendingReview}</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                  <div className="font-medium text-foreground">Average assessment score</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{assessmentOverview.averageScore}</div>
                </div>
                <Button className="w-full" onClick={() => router.push(`/teacher/classrooms/${params.classroomId}/assessments`)}>
                  Open Assessment Center
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="h-[100dvh] w-screen max-w-none overflow-y-auto border-border/60 bg-card p-0 sm:h-auto sm:max-h-[92vh] sm:w-[96vw] sm:max-w-5xl">
          {selectedStudent && (
            <div className="space-y-6">
              <div className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-orange-500/5 px-4 py-5 sm:px-6 sm:py-6">
                <DialogHeader className="text-left">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                        {selectedStudent.name}
                        {selectedStudent.isActiveBadgeHolder && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            <Crown className="mr-1 h-3.5 w-3.5" />
                            Weekly Star
                          </Badge>
                        )}
                      </DialogTitle>
                      <DialogDescription className="mt-2">{selectedStudent.attention.action} {selectedStudent.educationLevel ? `Student level: ${selectedStudent.educationLevel}.` : ''}</DialogDescription>
                    </div>
                    <Badge variant="outline" className={getAttentionClasses(selectedStudent.attention.level)}>{selectedStudent.attention.label}</Badge>
                  </div>
                </DialogHeader>
              </div>

              <div className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={Target} label="Completion" value={`${selectedStudent.overall.completionPercentage}%`} tone="text-foreground" />
                  <StatCard icon={RotateCcw} label="Due reviews" value={selectedStudent.dueReviews} tone="text-orange-600 dark:text-orange-300" />
                  <StatCard icon={TrendingUp} label="This week" value={formatMinutes(selectedStudent.currentWeekMinutes)} tone="text-emerald-600 dark:text-emerald-300" />
                  <StatCard icon={Clock3} label="Review quality" value={formatQuality(selectedStudent.averageQuality)} tone="text-foreground" />
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px]">
                  <div className="space-y-6">
                    <Card className="rounded-[24px] border-border/60 bg-card/75">
                      <CardHeader className="px-4 py-5 sm:px-6 sm:py-6"><CardTitle>Course performance</CardTitle><CardDescription>Per-course completion, review load, and study effort.</CardDescription></CardHeader>
                      <CardContent className="space-y-4">
                        {selectedStudent.courses.map((course) => (
                          <div key={course.classroomCourseId} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div><div className="font-medium text-foreground">{course.subjectTitle}</div><div className="mt-1 text-sm text-muted-foreground">{course.masteredTopics}/{course.totalTopics} topics mastered</div></div>
                              {course.needsAttention && <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200">Needs support</Badge>}
                            </div>
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Completion</span><span className="font-medium">{course.completionPercentage}%</span></div>
                              <Progress value={course.completionPercentage} className="h-2 bg-white/10" />
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Due</div><div className="mt-1 font-semibold">{course.dueReviews}</div></div>
                              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Quality</div><div className="mt-1 font-semibold">{formatQuality(course.averageQuality)}</div></div>
                              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Sessions</div><div className="mt-1 font-semibold">{course.totalSessions}</div></div>
                              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Minutes</div><div className="mt-1 font-semibold">{formatMinutes(course.studyMinutes)}</div></div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="rounded-[24px] border-border/60 bg-card/75">
                      <CardHeader className="px-4 py-5 sm:px-6 sm:py-6"><CardTitle>Recent activity</CardTitle><CardDescription>Most recent learning and review sessions in this classroom.</CardDescription></CardHeader>
                      <CardContent className="space-y-3">
                        {selectedStudent.recentActivity.length > 0 ? selectedStudent.recentActivity.map((activity, index) => (
                          <div key={`${activity.topicId || index}-${activity.createdAt}`} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div><div className="font-medium text-foreground">{activity.topicTitle}</div><div className="mt-1 text-sm text-muted-foreground">{activity.subjectTitle}</div></div>
                              <Badge variant="outline" className="border-border/60 bg-card/80 text-foreground">{activity.sessionType === 'review' ? 'Review' : 'Learning'}</Badge>
                            </div>
                            <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                              <div>{formatMinutes(activity.durationMinutes)}</div>
                              <div>{activity.qualityRating === null || activity.qualityRating === undefined ? 'No quality score' : `Quality ${activity.qualityRating}/5`}</div>
                              <div>{formatIst(activity.createdAt)}</div>
                            </div>
                          </div>
                        )) : <div className="text-sm text-muted-foreground">No classroom study logs yet.</div>}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="rounded-[24px] border-border/60 bg-card/75">
                      <CardHeader className="px-4 py-5 sm:px-6 sm:py-6"><CardTitle>Teacher focus points</CardTitle><CardDescription>Use these signals for the next intervention.</CardDescription></CardHeader>
                      <CardContent className="space-y-3 text-sm text-muted-foreground">
                        {(selectedStudent.attention.reasons.length > 0 ? selectedStudent.attention.reasons : ['This student is on track. Continue the current study rhythm.']).map((reason) => (
                          <div key={reason} className="rounded-2xl border border-border/60 bg-background/75 p-4">{reason}</div>
                        ))}
                        <div className="rounded-2xl border border-border/60 bg-background/75 p-4"><div className="font-medium text-foreground">Momentum</div><div className="mt-2">{selectedStudent.trend.label} ({selectedStudent.trend.changePercentage > 0 ? '+' : ''}{selectedStudent.trend.changePercentage}% vs last week)</div></div>
                        <div className="rounded-2xl border border-border/60 bg-background/75 p-4"><div className="font-medium text-foreground">Activity status</div><div className="mt-2">{formatIdle(selectedStudent.idleDays)}</div></div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[24px] border-border/60 bg-card/75">
                      <CardHeader className="px-4 py-5 sm:px-6 sm:py-6"><CardTitle>Weak topics</CardTitle><CardDescription>Low-quality review topics to reteach or revisit.</CardDescription></CardHeader>
                      <CardContent className="space-y-3">
                        {selectedStudent.weakTopics.length > 0 ? selectedStudent.weakTopics.slice(0, 6).map((topic) => (
                          <div key={topic.topicId} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                            <div className="font-medium text-foreground">{topic.topicTitle}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{topic.subjectTitle}</div>
                            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Quality</div><div className="mt-1 font-semibold">{formatQuality(topic.averageQuality)}</div></div>
                              <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Reviews</div><div className="mt-1 font-semibold">{topic.reviewCount}</div></div>
                            </div>
                            <div className="mt-3 break-words text-sm text-muted-foreground">Last reviewed {formatIst(topic.lastReviewedAt)}</div>
                          </div>
                        )) : <div className="rounded-2xl border border-border/60 bg-background/75 p-4 text-sm text-muted-foreground">No weak topics detected from review quality yet.</div>}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
