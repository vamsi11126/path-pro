import { createAdminClient } from '@/lib/supabase/admin'
import {
  addDaysToDateKey,
  buildWeekWindow,
  compareDateKeys,
  getDateKeyInTimeZone,
  getStartOfWeekDateKey,
  normalizeTimeZone
} from '@/lib/classrooms/time'

const SCORE_WEIGHTS = {
  activeDays: 25,
  learningMinutes: 20,
  reviewDiscipline: 35,
  assignmentContribution: 20
}

function roundScore(value) {
  return Number((value || 0).toFixed(2))
}

function buildStudentName(profile = {}) {
  return profile?.full_name || profile?.username || 'Student'
}

function getReader(supabase) {
  return createAdminClient() || supabase
}

async function assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId) {
  const reader = getReader(supabase)
  const { data, error } = await reader
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_user_id', teacherUserId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Classroom not found')
  }

  return data
}

async function getActiveMemberDirectory(reader, classroomId, providedMembers = null) {
  if (Array.isArray(providedMembers) && providedMembers.length > 0) {
    const activeMembers = providedMembers.filter((member) => member.status === 'active')
    const memberIds = activeMembers.map((member) => member.student_user_id).filter(Boolean)
    const profileById = new Map(activeMembers.map((member) => [member.student_user_id, member.profile || null]))

    return {
      activeMembers,
      memberIds,
      profileById
    }
  }

  const { data: members, error: memberError } = await reader
    .from('classroom_members')
    .select('id, student_user_id, status')
    .eq('classroom_id', classroomId)
    .eq('status', 'active')

  if (memberError) {
    throw new Error(memberError.message)
  }

  const memberIds = (members || []).map((member) => member.student_user_id).filter(Boolean)
  const { data: profiles, error: profileError } = memberIds.length > 0
    ? await reader
        .from('profiles')
        .select('id, full_name, username, education_level')
        .in('id', memberIds)
    : { data: [], error: null }

  if (profileError) {
    throw new Error(profileError.message)
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))

  return {
    activeMembers: (members || []).map((member) => ({
      ...member,
      profile: profileById.get(member.student_user_id) || null
    })),
    memberIds,
    profileById
  }
}

function buildReviewObligationKey({ studentUserId, classroomCourseId, topicId, scheduledReviewAt }) {
  return [
    studentUserId,
    classroomCourseId,
    topicId,
    scheduledReviewAt ? new Date(scheduledReviewAt).toISOString() : 'missing'
  ].join(':')
}

function buildEmptyRewardMetrics(studentUserId, profile = null) {
  return {
    studentUserId,
    name: buildStudentName(profile),
    educationLevel: profile?.education_level || null,
    activeDays: 0,
    weeklyLearningMinutes: 0,
    reviewObligations: 0,
    onTimeReviews: 0,
    missedReviews: 0,
    completedLateReviews: 0,
    assessmentSubmissions: 0,
    assessmentAveragePercentage: 0,
    scoreBreakdown: {
      studyConsistency: 0,
      courseReading: 0,
      reviewDiscipline: 0,
      assignmentContribution: {
        total: 0,
        volume: 0,
        performance: 0
      }
    },
    totalScore: 0
  }
}

export function computeWeeklyLeaderboard({
  memberIds = [],
  profileById = new Map(),
  classroomTimeZone,
  weekWindow,
  studyLogs = [],
  scheduledReviewLogs = [],
  assessmentAttempts = [],
  unresolvedProgressRows = []
}) {
  const timeZone = normalizeTimeZone(classroomTimeZone)
  const metricsByStudent = new Map(
    memberIds.map((studentUserId) => [
      studentUserId,
      {
        ...buildEmptyRewardMetrics(studentUserId, profileById.get(studentUserId)),
        _activeDayKeys: new Set(),
        _resolvedReviewKeys: new Set()
      }
    ])
  )

  const ensureMetrics = (studentUserId) => {
    if (!metricsByStudent.has(studentUserId)) {
      metricsByStudent.set(studentUserId, {
        ...buildEmptyRewardMetrics(studentUserId, profileById.get(studentUserId)),
        _activeDayKeys: new Set(),
        _resolvedReviewKeys: new Set()
      })
    }

    return metricsByStudent.get(studentUserId)
  }

  ;(studyLogs || []).forEach((log) => {
    const metrics = ensureMetrics(log.user_id)
    metrics._activeDayKeys.add(getDateKeyInTimeZone(log.created_at, timeZone))

    if (log.session_type === 'learning') {
      metrics.weeklyLearningMinutes += Math.max(0, Math.round(log.duration_minutes || 0))
    }
  })

  ;(assessmentAttempts || []).forEach((attempt) => {
    const metrics = ensureMetrics(attempt.student_user_id)
    metrics._activeDayKeys.add(getDateKeyInTimeZone(attempt.submitted_at, timeZone))
    metrics.assessmentSubmissions += 1
    metrics.assessmentAveragePercentage += Number(attempt.percentage || 0)
  })

  ;(scheduledReviewLogs || []).forEach((log) => {
    const metrics = ensureMetrics(log.user_id)
    const obligationKey = buildReviewObligationKey({
      studentUserId: log.user_id,
      classroomCourseId: log.classroom_course_id,
      topicId: log.topic_id,
      scheduledReviewAt: log.scheduled_review_at
    })

    if (metrics._resolvedReviewKeys.has(obligationKey)) {
      return
    }

    metrics._resolvedReviewKeys.add(obligationKey)
    metrics.reviewObligations += 1

    if (log.review_completed_on_time) {
      metrics.onTimeReviews += 1
    } else {
      metrics.completedLateReviews += 1
      metrics.missedReviews += 1
    }
  })

  const unresolvedKeys = new Set()

  ;(unresolvedProgressRows || []).forEach((row) => {
    const obligationKey = buildReviewObligationKey({
      studentUserId: row.student_user_id,
      classroomCourseId: row.classroom_course_id,
      topicId: row.topic_id,
      scheduledReviewAt: row.next_review_at
    })

    if (unresolvedKeys.has(obligationKey)) {
      return
    }

    unresolvedKeys.add(obligationKey)
    const metrics = ensureMetrics(row.student_user_id)

    if (!metrics._resolvedReviewKeys.has(obligationKey)) {
      metrics.reviewObligations += 1
      metrics.missedReviews += 1
    }
  })

  const leaderboard = [...metricsByStudent.values()]
    .map((metrics) => {
      const activeDays = metrics._activeDayKeys.size
      const averageAssessmentPercentage = metrics.assessmentSubmissions > 0
        ? metrics.assessmentAveragePercentage / metrics.assessmentSubmissions
        : 0
      const studyConsistencyScore = roundScore((Math.min(activeDays, 5) / 5) * SCORE_WEIGHTS.activeDays)
      const learningMinutesScore = roundScore((Math.min(metrics.weeklyLearningMinutes, 150) / 150) * SCORE_WEIGHTS.learningMinutes)
      const reviewDisciplineScore = metrics.reviewObligations > 0
        ? roundScore((metrics.onTimeReviews / metrics.reviewObligations) * SCORE_WEIGHTS.reviewDiscipline)
        : 0
      const assignmentVolumeScore = roundScore((Math.min(metrics.assessmentSubmissions, 2) / 2) * 8)
      const assignmentPerformanceScore = metrics.assessmentSubmissions > 0
        ? roundScore((averageAssessmentPercentage / 100) * 12)
        : 0
      const totalScore = roundScore(
        studyConsistencyScore +
        learningMinutesScore +
        reviewDisciplineScore +
        assignmentVolumeScore +
        assignmentPerformanceScore
      )

      return {
        studentUserId: metrics.studentUserId,
        name: metrics.name,
        educationLevel: metrics.educationLevel,
        activeDays,
        weeklyLearningMinutes: metrics.weeklyLearningMinutes,
        reviewObligations: metrics.reviewObligations,
        onTimeReviews: metrics.onTimeReviews,
        missedReviews: metrics.missedReviews,
        completedLateReviews: metrics.completedLateReviews,
        assessmentSubmissions: metrics.assessmentSubmissions,
        assessmentAveragePercentage: roundScore(averageAssessmentPercentage),
        scoreBreakdown: {
          studyConsistency: studyConsistencyScore,
          courseReading: learningMinutesScore,
          reviewDiscipline: reviewDisciplineScore,
          assignmentContribution: {
            total: roundScore(assignmentVolumeScore + assignmentPerformanceScore),
            volume: assignmentVolumeScore,
            performance: assignmentPerformanceScore
          }
        },
        totalScore,
        qualifies: activeDays > 0
      }
    })
    .filter((entry) => entry.qualifies)
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore
      }

      if (right.scoreBreakdown.reviewDiscipline !== left.scoreBreakdown.reviewDiscipline) {
        return right.scoreBreakdown.reviewDiscipline - left.scoreBreakdown.reviewDiscipline
      }

      if (right.scoreBreakdown.assignmentContribution.performance !== left.scoreBreakdown.assignmentContribution.performance) {
        return right.scoreBreakdown.assignmentContribution.performance - left.scoreBreakdown.assignmentContribution.performance
      }

      if (right.activeDays !== left.activeDays) {
        return right.activeDays - left.activeDays
      }

      return left.studentUserId.localeCompare(right.studentUserId)
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }))

  return {
    weekStart: weekWindow.startAt.toISOString(),
    weekEnd: new Date(weekWindow.nextStartAt.getTime() - 1).toISOString(),
    weekStartKey: weekWindow.startKey,
    weekEndKey: weekWindow.endKey,
    leaderboard
  }
}

async function getWeeklyRewardInputs(reader, {
  classroomId,
  weekWindow,
  memberIds,
  referenceDate = new Date()
}) {
  if (memberIds.length === 0) {
    return {
      studyLogs: [],
      scheduledReviewLogs: [],
      assessmentAttempts: [],
      unresolvedProgressRows: []
    }
  }

  const weekStartIso = weekWindow.startAt.toISOString()
  const nextWeekStartIso = weekWindow.nextStartAt.toISOString()

  const [studyLogsResult, scheduledReviewLogsResult, attemptsResult, progressResult] = await Promise.all([
    reader
      .from('study_logs')
      .select('id, user_id, topic_id, classroom_course_id, session_type, duration_minutes, created_at')
      .eq('classroom_id', classroomId)
      .eq('source_type', 'classroom')
      .in('user_id', memberIds)
      .gte('created_at', weekStartIso)
      .lt('created_at', nextWeekStartIso),
    reader
      .from('study_logs')
      .select('id, user_id, topic_id, classroom_course_id, scheduled_review_at, review_completed_on_time, created_at')
      .eq('classroom_id', classroomId)
      .eq('source_type', 'classroom')
      .eq('session_type', 'review')
      .in('user_id', memberIds)
      .gte('scheduled_review_at', weekStartIso)
      .lt('scheduled_review_at', nextWeekStartIso),
    reader
      .from('assessment_attempts')
      .select('id, student_user_id, percentage, submitted_at, status')
      .eq('classroom_id', classroomId)
      .in('student_user_id', memberIds)
      .not('submitted_at', 'is', null)
      .gte('submitted_at', weekStartIso)
      .lt('submitted_at', nextWeekStartIso),
    reader
      .from('student_topic_progress')
      .select('student_user_id, classroom_course_id, topic_id, next_review_at')
      .eq('classroom_id', classroomId)
      .in('student_user_id', memberIds)
      .gte('next_review_at', weekStartIso)
      .lt('next_review_at', nextWeekStartIso)
  ])

  if (studyLogsResult.error) throw new Error(studyLogsResult.error.message)
  if (scheduledReviewLogsResult.error) throw new Error(scheduledReviewLogsResult.error.message)
  if (attemptsResult.error) throw new Error(attemptsResult.error.message)
  if (progressResult.error) throw new Error(progressResult.error.message)

  const studyLogs = studyLogsResult.data || []
  const scheduledReviewLogs = (scheduledReviewLogsResult.data || []).filter((row) => row.scheduled_review_at)
  const assessmentAttempts = (attemptsResult.data || [])
    .filter((attempt) => attempt.submitted_at && ['submitted', 'auto_graded', 'teacher_review_pending', 'finalized'].includes(attempt.status))
  const unresolvedProgressRows = (progressResult.data || []).filter((row) => (
    row.next_review_at && new Date(row.next_review_at) <= new Date(referenceDate)
  ))

  return {
    studyLogs,
    scheduledReviewLogs,
    assessmentAttempts,
    unresolvedProgressRows
  }
}

async function finalizeMissingClosedWeeks(reader, {
  classroomId,
  classroomTimeZone,
  memberIds,
  profileById
}) {
  if (memberIds.length === 0) {
    return
  }

  const timeZone = normalizeTimeZone(classroomTimeZone)
  const currentWeek = buildWeekWindow(new Date(), timeZone)
  const latestClosedWeekStartKey = addDaysToDateKey(currentWeek.startKey, -7)

  const { data: awards, error: awardError } = await reader
    .from('classroom_weekly_awards')
    .select('id, week_start')
    .eq('classroom_id', classroomId)
    .order('week_start', { ascending: true })

  if (awardError) {
    throw new Error(awardError.message)
  }

  const existingWeekKeys = new Set((awards || []).map((award) => getStartOfWeekDateKey(award.week_start, timeZone)))
  const latestExistingWeekKey = (awards || []).length > 0
    ? getStartOfWeekDateKey(awards[awards.length - 1].week_start, timeZone)
    : null

  let firstPendingWeekKey = latestExistingWeekKey ? addDaysToDateKey(latestExistingWeekKey, 7) : null

  if (!firstPendingWeekKey) {
    const [earliestLogResult, earliestAttemptResult] = await Promise.all([
      reader
        .from('study_logs')
        .select('created_at')
        .eq('classroom_id', classroomId)
        .eq('source_type', 'classroom')
        .in('user_id', memberIds)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      reader
        .from('assessment_attempts')
        .select('submitted_at')
        .eq('classroom_id', classroomId)
        .in('student_user_id', memberIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    ])

    if (earliestLogResult.error) throw new Error(earliestLogResult.error.message)
    if (earliestAttemptResult.error) throw new Error(earliestAttemptResult.error.message)

    const firstRelevantTimestamp = [
      earliestLogResult.data?.created_at,
      earliestAttemptResult.data?.submitted_at
    ].filter(Boolean).sort()[0]

    if (!firstRelevantTimestamp) {
      return
    }

    firstPendingWeekKey = getStartOfWeekDateKey(firstRelevantTimestamp, timeZone)
  }

  if (compareDateKeys(firstPendingWeekKey, latestClosedWeekStartKey) > 0) {
    return
  }

  for (
    let weekStartKey = firstPendingWeekKey;
    compareDateKeys(weekStartKey, latestClosedWeekStartKey) <= 0;
    weekStartKey = addDaysToDateKey(weekStartKey, 7)
  ) {
    if (existingWeekKeys.has(weekStartKey)) {
      continue
    }

    const weekWindow = {
      ...buildWeekWindow(weekStartKey, timeZone),
      startKey: weekStartKey,
      endKey: addDaysToDateKey(weekStartKey, 6),
      startAt: buildWeekWindow(weekStartKey, timeZone).startAt,
      nextStartAt: buildWeekWindow(addDaysToDateKey(weekStartKey, 7), timeZone).startAt
    }

    const rewardInputs = await getWeeklyRewardInputs(reader, {
      classroomId,
      weekWindow,
      memberIds,
      referenceDate: new Date(weekWindow.nextStartAt.getTime() - 1)
    })
    const weekResult = computeWeeklyLeaderboard({
      memberIds,
      profileById,
      classroomTimeZone: timeZone,
      weekWindow,
      ...rewardInputs
    })
    const winner = weekResult.leaderboard[0]

    if (!winner) {
      continue
    }

    const nextBadgeWindow = buildWeekWindow(addDaysToDateKey(weekStartKey, 7), timeZone)

    const { error: insertError } = await reader
      .from('classroom_weekly_awards')
      .upsert({
        classroom_id: classroomId,
        week_start: weekWindow.startAt.toISOString(),
        week_end: new Date(weekWindow.nextStartAt.getTime() - 1).toISOString(),
        winner_student_user_id: winner.studentUserId,
        winner_score: winner.totalScore,
        score_breakdown: winner,
        reward_title: null,
        teacher_note: null,
        badge_active_from: nextBadgeWindow.startAt.toISOString(),
        badge_active_to: nextBadgeWindow.nextStartAt.toISOString(),
        finalized_at: new Date().toISOString()
      }, { onConflict: 'classroom_id,week_start' })

    if (insertError) {
      throw new Error(insertError.message)
    }
  }
}

function serializeAward(award, profileById, timeZone, now = new Date()) {
  const profile = profileById.get(award.winner_student_user_id) || null
  const badgeIsActive = Boolean(award.badge_active_from && award.badge_active_to)
    && new Date(award.badge_active_from) <= now
    && now < new Date(award.badge_active_to)

  return {
    id: award.id,
    classroomId: award.classroom_id,
    weekStart: award.week_start,
    weekEnd: award.week_end,
    weekStartKey: getStartOfWeekDateKey(award.week_start, timeZone),
    winnerStudentUserId: award.winner_student_user_id,
    winnerName: buildStudentName(profile),
    winnerEducationLevel: profile?.education_level || null,
    winnerScore: Number(award.winner_score || 0),
    scoreBreakdown: award.score_breakdown || null,
    rewardTitle: award.reward_title || null,
    teacherNote: award.teacher_note || null,
    badgeActiveFrom: award.badge_active_from,
    badgeActiveTo: award.badge_active_to,
    badgeIsActive
  }
}

export async function getClassroomRewardSnapshot(supabase, {
  classroomId,
  classroomTimeZone,
  members = null,
  historyLimit = 4
}) {
  const reader = getReader(supabase)
  const timeZone = normalizeTimeZone(classroomTimeZone)
  const { memberIds, profileById } = await getActiveMemberDirectory(reader, classroomId, members)

  await finalizeMissingClosedWeeks(reader, {
    classroomId,
    classroomTimeZone: timeZone,
    memberIds,
    profileById
  })

  const currentWeek = buildWeekWindow(new Date(), timeZone)
  const rewardInputs = await getWeeklyRewardInputs(reader, {
    classroomId,
    weekWindow: currentWeek,
    memberIds,
    referenceDate: new Date()
  })
  const currentWeekResult = computeWeeklyLeaderboard({
    memberIds,
    profileById,
    classroomTimeZone: timeZone,
    weekWindow: currentWeek,
    ...rewardInputs
  })

  const { data: awardRows, error: awardError } = await reader
    .from('classroom_weekly_awards')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('week_start', { ascending: false })
    .limit(Math.max(historyLimit, 4))

  if (awardError) {
    throw new Error(awardError.message)
  }

  const winnerIds = [...new Set((awardRows || []).map((award) => award.winner_student_user_id).filter(Boolean))]

  if (winnerIds.length > 0) {
    const missingWinnerIds = winnerIds.filter((id) => !profileById.has(id))
    if (missingWinnerIds.length > 0) {
      const { data: missingProfiles, error: profileError } = await reader
        .from('profiles')
        .select('id, full_name, username, education_level')
        .in('id', missingWinnerIds)

      if (profileError) {
        throw new Error(profileError.message)
      }

      ;(missingProfiles || []).forEach((profile) => {
        profileById.set(profile.id, profile)
      })
    }
  }

  const now = new Date()
  const history = (awardRows || []).map((award) => serializeAward(award, profileById, timeZone, now))
  const activeBadge = history.find((award) => award.badgeIsActive) || null

  return {
    activeBadge,
    currentWeek: currentWeekResult,
    history: history.slice(0, historyLimit)
  }
}

export async function updateTeacherClassroomWeeklyAward(supabase, {
  classroomId,
  teacherUserId,
  weekStartKey,
  classroomTimeZone,
  rewardTitle,
  teacherNote
}) {
  const reader = getReader(supabase)
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)

  const timeZone = normalizeTimeZone(classroomTimeZone)
  const { data: awards, error } = await reader
    .from('classroom_weekly_awards')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('week_start', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const award = (awards || []).find((item) => getStartOfWeekDateKey(item.week_start, timeZone) === weekStartKey)

  if (!award) {
    throw new Error('Weekly award not found')
  }

  const { error: updateError } = await reader
    .from('classroom_weekly_awards')
    .update({
      reward_title: rewardTitle || null,
      teacher_note: teacherNote || null
    })
    .eq('id', award.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { data: updatedAward, error: updatedError } = await reader
    .from('classroom_weekly_awards')
    .select('*')
    .eq('id', award.id)
    .single()

  if (updatedError) {
    throw new Error(updatedError.message)
  }

  const { profileById } = await getActiveMemberDirectory(reader, classroomId)
  if (!profileById.has(updatedAward.winner_student_user_id)) {
    const { data: winnerProfile, error: winnerProfileError } = await reader
      .from('profiles')
      .select('id, full_name, username, education_level')
      .eq('id', updatedAward.winner_student_user_id)
      .maybeSingle()

    if (winnerProfileError) {
      throw new Error(winnerProfileError.message)
    }

    if (winnerProfile) {
      profileById.set(winnerProfile.id, winnerProfile)
    }
  }

  return serializeAward(updatedAward, profileById, timeZone)
}

export async function listStudentActiveClassroomRewards(supabase, { studentUserId }) {
  const reader = getReader(supabase)
  const { data: memberships, error: membershipError } = await reader
    .from('classroom_members')
    .select(`
      classroom_id,
      classrooms (
        id,
        name,
        timezone
      )
    `)
    .eq('student_user_id', studentUserId)
    .eq('status', 'active')

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const rewards = []

  for (const membership of memberships || []) {
    const classroom = membership.classrooms
    if (!classroom?.id) {
      continue
    }

    const snapshot = await getClassroomRewardSnapshot(supabase, {
      classroomId: classroom.id,
      classroomTimeZone: classroom.timezone
    })

    if (snapshot.activeBadge?.winnerStudentUserId === studentUserId) {
      rewards.push({
        ...snapshot.activeBadge,
        classroomName: classroom.name,
        classroomTimeZone: normalizeTimeZone(classroom.timezone)
      })
    }
  }

  return rewards.sort((left, right) => new Date(right.badgeActiveFrom) - new Date(left.badgeActiveFrom))
}
