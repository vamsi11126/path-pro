import { generateWithGemini } from '@/lib/gemini'
import { createAdminClient } from '@/lib/supabase/admin'

const QUESTION_TYPES = new Set([
  'mcq',
  'multi_select',
  'true_false',
  'short_answer',
  'long_answer',
  'numeric',
  'match'
])

const AUTO_GRADED_TYPES = new Set(['mcq', 'multi_select', 'true_false', 'numeric', 'match'])
const MANUAL_REVIEW_TYPES = new Set(['long_answer'])
const ATTEMPT_ACTIVE_STATUSES = new Set(['in_progress'])
const CODING_LANGUAGES = new Set(['python', 'javascript'])

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNullableText(value) {
  const text = normalizeText(value)
  return text || null
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeInteger(value, fallback = 0) {
  return Math.round(normalizeNumber(value, fallback))
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }

  return fallback
}

function normalizeIso(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function safeJson(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      return fallback
    }
  }

  return fallback
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value === null || value === undefined) {
    return []
  }

  return [value]
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))]
}

function optionLabelForIndex(index) {
  return String.fromCharCode(65 + (index % 26))
}

function normalizeResponseText(value) {
  return normalizeText(value).replace(/\s+/g, ' ').toLowerCase()
}

function normalizeCodingLanguage(value, fallback = 'javascript') {
  const normalized = normalizeText(value).toLowerCase()
  if (CODING_LANGUAGES.has(normalized)) {
    return normalized
  }

  return fallback
}

function normalizeAssessmentMetadata(value) {
  const metadata = safeJson(value, {})
  const deliveryMode = normalizeText(metadata.deliveryMode).toLowerCase() === 'coding' ? 'coding' : 'standard'

  return {
    ...metadata,
    deliveryMode,
    codingLanguage: deliveryMode === 'coding'
      ? normalizeCodingLanguage(metadata.codingLanguage || metadata.language)
      : null
  }
}

function isCodingAssessment(assessment) {
  return normalizeAssessmentMetadata(assessment?.metadata).deliveryMode === 'coding'
}

function normalizeQuestionMetadata(questionType, metadata, assessmentMetadata = {}) {
  const normalizedMetadata = safeJson(metadata, {})
  const rawQuestionType = normalizeText(questionType).toLowerCase()
  const questionInteractionType = normalizeText(normalizedMetadata.interactionType).toLowerCase()
  const codingLanguage = normalizeCodingLanguage(
    normalizedMetadata.language || assessmentMetadata.codingLanguage || assessmentMetadata.language
  )
  const isCoding = rawQuestionType === 'coding' || questionInteractionType === 'coding'

  if (!isCoding) {
    return normalizedMetadata
  }

  return {
    ...normalizedMetadata,
    interactionType: 'coding',
    language: codingLanguage,
    starterCode: String(normalizedMetadata.starterCode || normalizedMetadata.template || ''),
    evaluationNotes: normalizeNullableText(normalizedMetadata.evaluationNotes || normalizedMetadata.expectedBehavior)
  }
}

function isCodingQuestion(question) {
  return normalizeQuestionMetadata(question?.question_type, question?.metadata, {}).interactionType === 'coding'
}

function decorateAssessmentQuestion(question) {
  const metadata = normalizeQuestionMetadata(question.question_type, question.metadata, {})
  const coding = metadata.interactionType === 'coding'

  return {
    ...question,
    metadata,
    display_question_type: coding ? 'coding' : question.question_type,
    coding_language: coding ? metadata.language : null,
    starter_code: coding ? metadata.starterCode || '' : null
  }
}

function computePercentage(score, maxScore) {
  if (!maxScore || maxScore <= 0) {
    return 0
  }

  return Number(((score / maxScore) * 100).toFixed(2))
}

function nowIso() {
  return new Date().toISOString()
}

function groupBy(items, getKey) {
  return (items || []).reduce((map, item) => {
    const key = getKey(item)
    const list = map.get(key) || []
    list.push(item)
    map.set(key, list)
    return map
  }, new Map())
}

async function assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, name, teacher_user_id, timezone, archived_at')
    .eq('id', classroomId)
    .eq('teacher_user_id', teacherUserId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.archived_at) {
    throw new Error('Classroom not found')
  }

  return data
}

async function assertStudentMembership(supabase, classroomId, studentUserId) {
  const { data, error } = await supabase
    .from('classroom_members')
    .select('id, classroom_id, student_user_id, status')
    .eq('classroom_id', classroomId)
    .eq('student_user_id', studentUserId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Classroom access denied')
  }

  return data
}

async function getClassroomCourses(reader, classroomId) {
  const { data, error } = await reader
    .from('classroom_courses')
    .select(`
      id,
      classroom_id,
      subject_id,
      order_index,
      subjects (
        id,
        title,
        description,
        cheat_sheet
      )
    `)
    .eq('classroom_id', classroomId)
    .order('order_index', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

async function getTopicsForAssessment(reader, classroomId, classroomCourseId = null, topicIds = []) {
  let courseSubjectId = null

  if (classroomCourseId) {
    const { data: course, error: courseError } = await reader
      .from('classroom_courses')
      .select('id, classroom_id, subject_id')
      .eq('id', classroomCourseId)
      .eq('classroom_id', classroomId)
      .maybeSingle()

    if (courseError) {
      throw new Error(courseError.message)
    }

    if (!course) {
      throw new Error('Classroom course not found')
    }

    courseSubjectId = course.subject_id
  }

  let query = reader
    .from('topics')
    .select('id, subject_id, title, description, estimated_minutes, difficulty')
    .order('created_at', { ascending: true })

  if (topicIds.length > 0) {
    query = query.in('id', topicIds)
  } else if (courseSubjectId) {
    query = query.eq('subject_id', courseSubjectId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

function normalizeAssessmentType(value) {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'practice' || normalized === 'graded' || normalized === 'secure') {
    return normalized
  }

  return 'graded'
}

function normalizeAssessmentStatus(value) {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'draft' || normalized === 'published' || normalized === 'archived') {
    return normalized
  }

  return 'draft'
}

function normalizeQuestionType(value) {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'coding') {
    return 'long_answer'
  }
  if (!QUESTION_TYPES.has(normalized)) {
    throw new Error('Unsupported question type')
  }

  return normalized
}

function normalizeOptionsPayload(questionType, options, answerKey) {
  const normalizedOptions = toArray(options)
    .map((option, index) => {
      if (typeof option === 'string') {
        return {
          label: optionLabelForIndex(index),
          optionText: normalizeText(option),
          isCorrect: false,
          orderIndex: index,
          matchKey: null
        }
      }

      return {
        label: normalizeText(option.label) || optionLabelForIndex(index),
        optionText: normalizeText(option.optionText || option.text || option.value),
        isCorrect: normalizeBoolean(option.isCorrect),
        orderIndex: normalizeInteger(option.orderIndex, index),
        matchKey: normalizeNullableText(option.matchKey || option.leftPrompt)
      }
    })
    .filter((option) => option.optionText)

  if (questionType === 'true_false' && normalizedOptions.length === 0) {
    const accepted = normalizeResponseText(answerKey.correctValue)
    return [
      {
        label: 'A',
        optionText: 'True',
        isCorrect: accepted === 'true',
        orderIndex: 0,
        matchKey: null
      },
      {
        label: 'B',
        optionText: 'False',
        isCorrect: accepted === 'false',
        orderIndex: 1,
        matchKey: null
      }
    ]
  }

  return normalizedOptions
}

function normalizeAnswerKey({ questionType, answerKey, options }) {
  const safeAnswerKey = safeJson(answerKey, {})

  if (questionType === 'mcq' || questionType === 'multi_select' || questionType === 'true_false') {
    const providedCorrectLabels = uniqueStrings(toArray(safeAnswerKey.correctLabels || safeAnswerKey.correctOptionLabels))
    const optionLabels = options
      .filter((option) => option.isCorrect || providedCorrectLabels.includes(option.label))
      .map((option) => option.label)

    return {
      correctLabels: optionLabels,
      acceptedAnswers: optionLabels
    }
  }

  if (questionType === 'numeric') {
    return {
      numericAnswer: normalizeNumber(safeAnswerKey.numericAnswer ?? safeAnswerKey.value),
      tolerance: normalizeNumber(safeAnswerKey.tolerance, 0)
    }
  }

  if (questionType === 'short_answer') {
    const acceptedAnswers = uniqueStrings(
      toArray(safeAnswerKey.acceptedAnswers || safeAnswerKey.acceptedAnswer || safeAnswerKey.answer)
        .map((value) => normalizeText(value))
    )

    return {
      acceptedAnswers
    }
  }

  if (questionType === 'match') {
    return {
      matches: safeAnswerKey.matches || {}
    }
  }

  return safeAnswerKey
}

function buildQuestionPayload(question, index = 0) {
  const requestedQuestionType = normalizeText(question.questionType || question.type).toLowerCase()
  const assessmentMetadata = normalizeAssessmentMetadata(question.assessmentMetadata)
  const questionType = normalizeQuestionType(requestedQuestionType)
  const questionMetadata = normalizeQuestionMetadata(
    requestedQuestionType || questionType,
    question.metadata,
    assessmentMetadata
  )
  const options = normalizeOptionsPayload(questionType, question.options, safeJson(question.answerKey, {}))
  const answerKey = normalizeAnswerKey({
    questionType,
    answerKey: question.answerKey,
    options
  })

  return {
    sectionId: question.sectionId || null,
    topicId: question.topicId || null,
    questionType,
    prompt: normalizeText(question.prompt),
    answerExplanation: normalizeNullableText(question.answerExplanation || question.explanation),
    points: Number(normalizeNumber(question.points, 1).toFixed(2)),
    difficulty: Math.min(5, Math.max(1, normalizeInteger(question.difficulty, 3))),
    orderIndex: normalizeInteger(question.orderIndex, index),
    metadata: {
      ...questionMetadata,
      source: normalizeText(question.source || '')
    },
    options,
    answerKey,
    rubric: Array.isArray(question.rubric) ? question.rubric : []
  }
}

function buildAssessmentPayload(classroomId, teacherUserId, payload) {
  const title = normalizeText(payload.title)
  if (!title) {
    throw new Error('Assessment title is required')
  }

  const openAt = normalizeIso(payload.openAt || payload.open_at)
  const closeAt = normalizeIso(payload.closeAt || payload.close_at)

  if (openAt && closeAt && new Date(openAt) >= new Date(closeAt)) {
    throw new Error('Assessment close time must be after the open time')
  }

  const metadata = normalizeAssessmentMetadata(payload.metadata)
  const createdVia = normalizeText(payload.createdVia || payload.created_via || payload.creationMethod) || 'manual'

  if (metadata.deliveryMode === 'coding' && createdVia === 'ai') {
    throw new Error('Coding assignments currently support manual drafts only')
  }

  return {
    classroom_id: classroomId,
    teacher_user_id: teacherUserId,
    classroom_course_id: payload.classroomCourseId || payload.classroom_course_id || null,
    title,
    description: normalizeNullableText(payload.description),
    instructions: normalizeNullableText(payload.instructions),
    assessment_type: normalizeAssessmentType(payload.assessmentType || payload.assessment_type),
    status: normalizeAssessmentStatus(payload.status),
    created_via: createdVia,
    ai_prompt: normalizeNullableText(payload.aiPrompt || payload.ai_prompt),
    open_at: openAt,
    close_at: closeAt,
    duration_minutes: payload.durationMinutes ? Math.max(1, normalizeInteger(payload.durationMinutes)) : null,
    max_attempts: Math.max(1, normalizeInteger(payload.maxAttempts, 1)),
    pass_percentage: Math.max(0, Math.min(100, normalizeNumber(payload.passPercentage, 40))),
    shuffle_questions: normalizeBoolean(payload.shuffleQuestions, false),
    shuffle_options: normalizeBoolean(payload.shuffleOptions, true),
    show_results_immediately: normalizeBoolean(payload.showResultsImmediately, false),
    strict_mode: normalizeBoolean(payload.strictMode, normalizeAssessmentType(payload.assessmentType || payload.assessment_type) === 'secure'),
    metadata,
    published_at: normalizeAssessmentStatus(payload.status) === 'published' ? nowIso() : null,
    archived_at: normalizeAssessmentStatus(payload.status) === 'archived' ? nowIso() : null
  }
}

function buildQuestionView(question, optionsByQuestionId, rubricByQuestionId) {
  return decorateAssessmentQuestion({
    ...question,
    options: (optionsByQuestionId.get(question.id) || []).sort((a, b) => a.order_index - b.order_index),
    rubric: rubricByQuestionId.get(question.id) || null
  })
}

async function insertQuestionRecords(writer, assessmentId, teacherUserId, questions = []) {
  const createdQuestions = []

  for (let index = 0; index < questions.length; index += 1) {
    const question = buildQuestionPayload(questions[index], index)

    if (!question.prompt) {
      throw new Error('Each question must include a prompt')
    }

    const { data: createdQuestion, error: questionError } = await writer
      .from('assessment_questions')
      .insert({
        assessment_id: assessmentId,
        section_id: question.sectionId,
        topic_id: question.topicId,
        question_type: question.questionType,
        prompt: question.prompt,
        answer_key: question.answerKey,
        answer_explanation: question.answerExplanation,
        points: question.points,
        difficulty: question.difficulty,
        order_index: question.orderIndex,
        metadata: question.metadata
      })
      .select('*')
      .single()

    if (questionError) {
      throw new Error(questionError.message)
    }

    if (question.options.length > 0) {
      const optionPayload = question.options.map((option, optionIndex) => ({
        question_id: createdQuestion.id,
        label: option.label || optionLabelForIndex(optionIndex),
        option_text: option.optionText,
        is_correct: option.isCorrect,
        order_index: option.orderIndex ?? optionIndex,
        match_key: option.matchKey || null
      }))

      const { error: optionError } = await writer
        .from('assessment_question_options')
        .insert(optionPayload)

      if (optionError) {
        throw new Error(optionError.message)
      }
    }

    if (question.rubric.length > 0) {
      const { error: rubricError } = await writer
        .from('assessment_rubrics')
        .insert({
          teacher_user_id: teacherUserId,
          assessment_id: assessmentId,
          question_id: createdQuestion.id,
          title: `${createdQuestion.prompt.slice(0, 80)} rubric`,
          rubric_json: question.rubric
        })

      if (rubricError) {
        throw new Error(rubricError.message)
      }
    }

    if (normalizeBoolean(questions[index].saveToBank, true)) {
      const { error: bankError } = await writer
        .from('assessment_question_bank')
        .insert({
          teacher_user_id: teacherUserId,
          classroom_id: questions[index].classroomId || null,
          subject_id: questions[index].subjectId || null,
          topic_id: question.topicId,
          question_type: question.questionType,
          prompt: question.prompt,
          answer_key: question.answerKey,
          answer_explanation: question.answerExplanation,
          difficulty: question.difficulty,
          default_points: question.points,
          metadata: {
            sourceAssessmentId: assessmentId,
            ...(question.metadata || {})
          }
        })

      if (bankError) {
        throw new Error(bankError.message)
      }
    }

    createdQuestions.push(createdQuestion)
  }

  return createdQuestions
}

async function getWeakTopicsForCourse(reader, classroomId, classroomCourseId) {
  const { data: progressRows, error: progressError } = await reader
    .from('student_topic_progress')
    .select('topic_id, next_review_at')
    .eq('classroom_id', classroomId)
    .eq('classroom_course_id', classroomCourseId)

  if (progressError) {
    throw new Error(progressError.message)
  }

  const { data: reviewLogs, error: reviewLogsError } = await reader
    .from('study_logs')
    .select('topic_id, quality_rating')
    .eq('classroom_id', classroomId)
    .eq('classroom_course_id', classroomCourseId)
    .eq('source_type', 'classroom')
    .eq('session_type', 'review')

  if (reviewLogsError) {
    throw new Error(reviewLogsError.message)
  }

  const topicIds = uniqueStrings([
    ...(progressRows || []).map((row) => row.topic_id),
    ...(reviewLogs || []).map((row) => row.topic_id)
  ])

  if (topicIds.length === 0) {
    return []
  }

  const { data: topics, error: topicsError } = await reader
    .from('topics')
    .select('id, title, description, estimated_minutes, difficulty')
    .in('id', topicIds)

  if (topicsError) {
    throw new Error(topicsError.message)
  }

  const topicProgressMap = groupBy(progressRows || [], (row) => row.topic_id)
  const topicReviewMap = groupBy(reviewLogs || [], (row) => row.topic_id)
  const now = new Date()

  return (topics || [])
    .map((topic) => {
      const topicProgress = topicProgressMap.get(topic.id) || []
      const topicReviews = topicReviewMap.get(topic.id) || []
      const dueReviews = topicProgress.filter((row) => row.next_review_at && new Date(row.next_review_at) <= now).length
      const averageQuality = topicReviews.length > 0
        ? topicReviews.reduce((sum, row) => sum + (row.quality_rating || 0), 0) / topicReviews.length
        : 5

      return {
        ...topic,
        dueReviews,
        averageQuality,
        riskScore: dueReviews * 2 + Math.max(0, Math.round((3.5 - averageQuality) * 10))
      }
    })
    .sort((a, b) => b.riskScore - a.riskScore)
}

async function generateAssessmentQuestionsWithAi({
  reader,
  classroomId,
  assessmentPayload,
  generatorConfig = {},
  apiKey = null
}) {
  const questionCount = Math.min(30, Math.max(3, normalizeInteger(generatorConfig.questionCount, 10)))
  const focus = normalizeText(generatorConfig.focus).toLowerCase() || 'course_topics'
  const selectedTopicIds = uniqueStrings(toArray(generatorConfig.topicIds))
  const selectedTopics = selectedTopicIds.length > 0
    ? await getTopicsForAssessment(reader, classroomId, assessmentPayload.classroom_course_id, selectedTopicIds)
    : []

  let focusTopics = selectedTopics

  if (focusTopics.length === 0 && focus === 'weak_topics' && assessmentPayload.classroom_course_id) {
    focusTopics = (await getWeakTopicsForCourse(reader, classroomId, assessmentPayload.classroom_course_id)).slice(0, 8)
  }

  if (focusTopics.length === 0) {
    focusTopics = (await getTopicsForAssessment(reader, classroomId, assessmentPayload.classroom_course_id)).slice(0, 10)
  }

  const questionTypes = uniqueStrings(toArray(generatorConfig.questionTypes)).filter((value) => QUESTION_TYPES.has(value))
  const difficulty = Math.max(1, Math.min(5, normalizeInteger(generatorConfig.difficulty, 3)))
  const topicContext = focusTopics.length > 0
    ? focusTopics.map((topic) => `- ${topic.title}: ${topic.description || 'No description'} (difficulty ${topic.difficulty || 3}/5)`).join('\n')
    : '- Use the classroom course scope to infer suitable questions.'

  const prompt = `You are designing a classroom assessment for Learnify.

Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "description": "string",
  "instructions": "string",
  "questions": [
    {
      "topicTitle": "string",
      "questionType": "mcq|multi_select|true_false|short_answer|long_answer|numeric",
      "prompt": "string",
      "points": 2,
      "difficulty": 3,
      "answerExplanation": "string",
      "answerKey": {},
      "options": [
        { "label": "A", "optionText": "string", "isCorrect": false }
      ],
      "rubric": [
        { "criterion": "string", "points": 2, "description": "string" }
      ]
    }
  ]
}

Rules:
1. Assessment type: ${assessmentPayload.assessment_type}.
2. Strict mode: ${assessmentPayload.strict_mode ? 'yes' : 'no'}.
3. Generate ${questionCount} questions.
4. Allowed question types: ${questionTypes.length > 0 ? questionTypes.join(', ') : 'mcq, multi_select, true_false, short_answer, long_answer, numeric'}.
5. Difficulty target: ${difficulty}/5.
6. Use only the topic context below.
7. MCQ and multi_select questions must include 4 options.
8. true_false questions must not include custom options; use answerKey.correctValue with true or false.
9. numeric questions must include answerKey.numericAnswer and optional tolerance.
10. short_answer questions must include answerKey.acceptedAnswers.
11. long_answer questions must include a rubric array.
12. Keep every question classroom-ready and teacher-reviewable.

Assessment title preference: ${assessmentPayload.title}
Assessment description: ${assessmentPayload.description || 'No teacher description provided.'}
Teacher instructions: ${assessmentPayload.instructions || normalizeText(generatorConfig.extraPrompt) || 'No extra instructions provided.'}
Topic context:
${topicContext}`

  const response = await generateWithGemini([
    {
      role: 'system',
      content: 'You create rigorous classroom assessments and return strict JSON.'
    },
    {
      role: 'user',
      content: prompt
    }
  ], {
    temperature: 0.4,
    maxOutputTokens: 8000,
    apiKey
  })

  const rawContent = normalizeText(response.choices?.[0]?.message?.content)
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()

  if (!rawContent) {
    throw new Error('AI returned empty assessment content')
  }

  let parsed
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error('AI returned invalid assessment JSON')
  }

  const topicIdByTitle = new Map(focusTopics.map((topic) => [normalizeText(topic.title).toLowerCase(), topic.id]))
  const aiQuestions = toArray(parsed.questions).map((question, index) => ({
    ...question,
    topicId: question.topicId || topicIdByTitle.get(normalizeText(question.topicTitle).toLowerCase()) || null,
    orderIndex: index
  }))

  return {
    title: normalizeText(parsed.title) || assessmentPayload.title,
    description: normalizeNullableText(parsed.description) || assessmentPayload.description,
    instructions: normalizeNullableText(parsed.instructions) || assessmentPayload.instructions,
    questions: aiQuestions
  }
}

async function hydrateAssessmentQuestions(reader, assessmentId) {
  const { data: questions, error: questionError } = await reader
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('order_index', { ascending: true })

  if (questionError) {
    throw new Error(questionError.message)
  }

  const questionIds = (questions || []).map((question) => question.id)

  const [{ data: options, error: optionError }, { data: rubrics, error: rubricError }] = await Promise.all([
    questionIds.length > 0
      ? reader.from('assessment_question_options').select('*').in('question_id', questionIds)
      : Promise.resolve({ data: [], error: null }),
    questionIds.length > 0
      ? reader.from('assessment_rubrics').select('*').in('question_id', questionIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (optionError) {
    throw new Error(optionError.message)
  }

  if (rubricError) {
    throw new Error(rubricError.message)
  }

  const optionsByQuestionId = groupBy(options || [], (item) => item.question_id)
  const rubricByQuestionId = new Map((rubrics || []).map((item) => [item.question_id, item]))

  return (questions || []).map((question) => buildQuestionView(question, optionsByQuestionId, rubricByQuestionId))
}

function buildAssessmentSummary(assessment, related = {}) {
  const attempts = related.attempts || []
  const results = related.results || []
  const questions = related.questions || []
  const pendingReviewCount = attempts.filter((attempt) => attempt.status === 'teacher_review_pending').length
  const completedAttempts = results.length
  const averageScore = completedAttempts > 0
    ? Number((results.reduce((sum, result) => sum + (result.percentage || 0), 0) / completedAttempts).toFixed(1))
    : null
  const metadata = normalizeAssessmentMetadata(assessment.metadata)

  return {
    ...assessment,
    metadata,
    delivery_mode: metadata.deliveryMode,
    coding_language: metadata.codingLanguage,
    questionCount: questions.length,
    attemptCount: attempts.length,
    completedAttempts,
    pendingReviewCount,
    averageScore
  }
}

async function getAssessmentAndQuestions(reader, classroomId, assessmentId) {
  const { data: assessment, error: assessmentError } = await reader
    .from('classroom_assessments')
    .select(`
      *,
      classroom_courses (
        id,
        subject_id,
        subjects (
          id,
          title,
          description
        )
      )
    `)
    .eq('id', assessmentId)
    .eq('classroom_id', classroomId)
    .maybeSingle()

  if (assessmentError) {
    throw new Error(assessmentError.message)
  }

  if (!assessment) {
    throw new Error('Assessment not found')
  }

  const questions = await hydrateAssessmentQuestions(reader, assessmentId)
  const topicIds = uniqueStrings(questions.map((question) => question.topic_id))
  const { data: topics, error: topicsError } = topicIds.length > 0
    ? await reader
        .from('topics')
        .select('id, title')
        .in('id', topicIds)
    : { data: [], error: null }

  if (topicsError) {
    throw new Error(topicsError.message)
  }

  const topicMap = new Map((topics || []).map((topic) => [topic.id, topic]))

  return {
    assessment,
    questions: questions.map((question) => ({
      ...question,
      topic: question.topic_id ? topicMap.get(question.topic_id) || null : null
    }))
  }
}

export async function listTeacherClassroomAssessments(supabase, classroomId, teacherUserId) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const reader = createAdminClient() || supabase

  const { data: assessments, error } = await reader
    .from('classroom_assessments')
    .select(`
      *,
      classroom_courses (
        id,
        subjects (
          id,
          title
        )
      )
    `)
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const assessmentIds = (assessments || []).map((assessment) => assessment.id)
  const [questionsResult, attemptsResult, resultsResult] = await Promise.all([
    assessmentIds.length > 0
      ? reader.from('assessment_questions').select('id, assessment_id').in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length > 0
      ? reader.from('assessment_attempts').select('id, assessment_id, status').in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length > 0
      ? reader.from('assessment_results').select('id, assessment_id, percentage').in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (questionsResult.error) throw new Error(questionsResult.error.message)
  if (attemptsResult.error) throw new Error(attemptsResult.error.message)
  if (resultsResult.error) throw new Error(resultsResult.error.message)

  const questionsByAssessmentId = groupBy(questionsResult.data || [], (item) => item.assessment_id)
  const attemptsByAssessmentId = groupBy(attemptsResult.data || [], (item) => item.assessment_id)
  const resultsByAssessmentId = groupBy(resultsResult.data || [], (item) => item.assessment_id)

  return (assessments || []).map((assessment) => buildAssessmentSummary(assessment, {
    questions: questionsByAssessmentId.get(assessment.id) || [],
    attempts: attemptsByAssessmentId.get(assessment.id) || [],
    results: resultsByAssessmentId.get(assessment.id) || []
  }))
}

export async function createTeacherAssessment(supabase, classroomId, teacherUserId, payload) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const reader = createAdminClient() || supabase
  const writer = createAdminClient() || supabase
  let assessmentPayload = buildAssessmentPayload(classroomId, teacherUserId, payload)
  let questions = toArray(payload.questions)

  const { data: teacherProfile, error: teacherProfileError } = await supabase
    .from('profiles')
    .select('gemini_api_key')
    .eq('id', teacherUserId)
    .maybeSingle()

  if (teacherProfileError) {
    throw new Error(teacherProfileError.message)
  }

  const teacherGeminiApiKey = teacherProfile?.gemini_api_key || null

  if (assessmentPayload.created_via === 'ai') {
    const aiDraft = await generateAssessmentQuestionsWithAi({
      reader,
      classroomId,
      assessmentPayload,
      generatorConfig: safeJson(payload.generatorConfig, {}),
      apiKey: teacherGeminiApiKey
    })

    assessmentPayload = {
      ...assessmentPayload,
      title: aiDraft.title,
      description: aiDraft.description,
      instructions: aiDraft.instructions,
      ai_prompt: normalizeNullableText(payload.aiPrompt || payload.generatorConfig?.extraPrompt || assessmentPayload.ai_prompt)
    }
    questions = aiDraft.questions
  }

  const { data: assessment, error } = await writer
    .from('classroom_assessments')
    .insert(assessmentPayload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const { data: section, error: sectionError } = await writer
    .from('assessment_sections')
    .insert({
      assessment_id: assessment.id,
      title: 'Main Section',
      description: assessment.description || null,
      order_index: 0,
      duration_minutes: assessment.duration_minutes || null,
      shuffle_questions: assessment.shuffle_questions
    })
    .select('*')
    .single()

  if (sectionError) {
    throw new Error(sectionError.message)
  }

  if (questions.length > 0) {
    await insertQuestionRecords(writer, assessment.id, teacherUserId, questions.map((question) => ({
      ...question,
      sectionId: question.sectionId || section.id,
      assessmentMetadata: assessmentPayload.metadata,
      classroomId
    })))
  }

  return {
    assessment,
    defaultSection: section
  }
}

export async function updateTeacherAssessment(supabase, classroomId, assessmentId, teacherUserId, payload) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const writer = createAdminClient() || supabase
  const { assessment, questions } = await getAssessmentAndQuestions(writer, classroomId, assessmentId)

  if (assessment.teacher_user_id !== teacherUserId) {
    throw new Error('Assessment not found')
  }

  const updates = {}
  const candidate = buildAssessmentPayload(classroomId, teacherUserId, {
    ...assessment,
    ...payload
  })

  ;[
    'classroom_course_id',
    'title',
    'description',
    'instructions',
    'assessment_type',
    'status',
    'created_via',
    'ai_prompt',
    'open_at',
    'close_at',
    'duration_minutes',
    'max_attempts',
    'pass_percentage',
    'shuffle_questions',
    'shuffle_options',
    'show_results_immediately',
    'strict_mode',
    'metadata',
    'published_at',
    'archived_at'
  ].forEach((key) => {
    if (candidate[key] !== assessment[key]) {
      updates[key] = candidate[key]
    }
  })

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await writer
      .from('classroom_assessments')
      .update(updates)
      .eq('id', assessmentId)
      .eq('classroom_id', classroomId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  if (Array.isArray(payload.questions) && payload.questions.length > 0 && questions.length === 0) {
    await insertQuestionRecords(writer, assessmentId, teacherUserId, payload.questions)
  }

  return getTeacherAssessmentDetail(supabase, classroomId, assessmentId, teacherUserId)
}

export async function addTeacherAssessmentQuestion(supabase, classroomId, assessmentId, teacherUserId, payload) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const writer = createAdminClient() || supabase
  const { assessment } = await getAssessmentAndQuestions(writer, classroomId, assessmentId)

  if (assessment.teacher_user_id !== teacherUserId) {
    throw new Error('Assessment not found')
  }

  const { data: sections, error: sectionsError } = await writer
    .from('assessment_sections')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('order_index', { ascending: true })

  if (sectionsError) {
    throw new Error(sectionsError.message)
  }

  const defaultSection = sections?.[0] || null
  await insertQuestionRecords(writer, assessmentId, teacherUserId, [{
    ...payload,
    sectionId: payload.sectionId || defaultSection?.id || null,
    assessmentMetadata: assessment.metadata,
    classroomId
  }])

  return getTeacherAssessmentDetail(supabase, classroomId, assessmentId, teacherUserId)
}

export async function publishTeacherAssessment(supabase, classroomId, assessmentId, teacherUserId) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const writer = createAdminClient() || supabase
  const { assessment, questions } = await getAssessmentAndQuestions(writer, classroomId, assessmentId)

  if (assessment.teacher_user_id !== teacherUserId) {
    throw new Error('Assessment not found')
  }

  if (questions.length === 0) {
    throw new Error('Add at least one question before publishing')
  }

  const { error } = await writer
    .from('classroom_assessments')
    .update({
      status: 'published',
      published_at: nowIso(),
      archived_at: null
    })
    .eq('id', assessmentId)
    .eq('classroom_id', classroomId)

  if (error) {
    throw new Error(error.message)
  }

  return getTeacherAssessmentDetail(supabase, classroomId, assessmentId, teacherUserId)
}

export async function getTeacherAssessmentDetail(supabase, classroomId, assessmentId, teacherUserId) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const reader = createAdminClient() || supabase
  const classroomCourses = await getClassroomCourses(reader, classroomId)
  const { assessment, questions } = await getAssessmentAndQuestions(reader, classroomId, assessmentId)

  if (assessment.teacher_user_id !== teacherUserId) {
    throw new Error('Assessment not found')
  }

  const [{ data: sections, error: sectionError }, { data: attempts, error: attemptError }, { data: results, error: resultsError }] = await Promise.all([
    reader.from('assessment_sections').select('*').eq('assessment_id', assessmentId).order('order_index', { ascending: true }),
    reader.from('assessment_attempts').select('*').eq('assessment_id', assessmentId).order('created_at', { ascending: false }).limit(30),
    reader.from('assessment_results').select('*').eq('assessment_id', assessmentId)
  ])

  if (sectionError) throw new Error(sectionError.message)
  if (attemptError) throw new Error(attemptError.message)
  if (resultsError) throw new Error(resultsError.message)

  const studentIds = uniqueStrings((attempts || []).map((attempt) => attempt.student_user_id))
  const [{ data: members, error: membersError }, { data: profiles, error: profilesError }] = studentIds.length > 0
    ? await Promise.all([
        reader
          .from('classroom_members')
          .select('id, student_user_id')
          .eq('classroom_id', classroomId)
          .in('student_user_id', studentIds),
        reader
          .from('profiles')
          .select('id, full_name, username, education_level')
          .in('id', studentIds)
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  if (membersError) {
    throw new Error(membersError.message)
  }

  if (profilesError) {
    throw new Error(profilesError.message)
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))
  const memberByUserId = new Map((members || []).map((member) => [
    member.student_user_id,
    {
      ...member,
      profile: profileById.get(member.student_user_id) || null
    }
  ]))
  const resultsByAttemptId = new Map((results || []).map((result) => [result.attempt_id, result]))
  const attemptsWithStudent = (attempts || []).map((attempt) => ({
    ...attempt,
    result: resultsByAttemptId.get(attempt.id) || null,
    student: memberByUserId.get(attempt.student_user_id)?.profile || null
  }))

  const availableTopics = assessment.classroom_course_id
    ? await getTopicsForAssessment(reader, classroomId, assessment.classroom_course_id)
    : []

  return {
    classroomId,
    assessment: buildAssessmentSummary(assessment, {
      questions,
      attempts: attempts || [],
      results: results || []
    }),
    sections: sections || [],
    questions,
    attempts: attemptsWithStudent,
    classroomCourses,
    availableTopics
  }
}

export async function getTeacherAssessmentAttemptDetail(supabase, classroomId, assessmentId, attemptId, teacherUserId) {
  await assertTeacherOwnsClassroom(supabase, classroomId, teacherUserId)
  const reader = createAdminClient() || supabase
  const detail = await getTeacherAssessmentDetail(supabase, classroomId, assessmentId, teacherUserId)
  const attempt = detail.attempts.find((item) => item.id === attemptId)

  if (!attempt) {
    throw new Error('Assessment attempt not found')
  }

  const questionIds = detail.questions.map((question) => question.id)
  const [{ data: answers, error: answersError }, { data: events, error: eventsError }, { data: result, error: resultError }] = await Promise.all([
    questionIds.length > 0
      ? reader.from('assessment_answers').select('*').eq('attempt_id', attemptId).in('question_id', questionIds)
      : Promise.resolve({ data: [], error: null }),
    reader.from('assessment_events').select('*').eq('attempt_id', attemptId).order('occurred_at', { ascending: false }),
    reader.from('assessment_results').select('*').eq('attempt_id', attemptId).maybeSingle()
  ])

  if (answersError) throw new Error(answersError.message)
  if (eventsError) throw new Error(eventsError.message)
  if (resultError) throw new Error(resultError.message)

  const answerByQuestionId = new Map((answers || []).map((answer) => [answer.question_id, answer]))

  return {
    assessment: detail.assessment,
    attempt,
    result: result || null,
    questions: detail.questions.map((question) => ({
      ...question,
      answer: answerByQuestionId.get(question.id) || null
    })),
    events: events || []
  }
}

function getAttemptRiskLevel(score) {
  if (score >= 8) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

function getEventWeight(severity) {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

async function recomputeAttemptRisk(writer, attemptId) {
  const { data: events, error: eventsError } = await writer
    .from('assessment_events')
    .select('event_type, event_severity')
    .eq('attempt_id', attemptId)

  if (eventsError) {
    throw new Error(eventsError.message)
  }

  const countsByType = {}
  const riskScore = (events || []).reduce((sum, event) => {
    countsByType[event.event_type] = (countsByType[event.event_type] || 0) + 1
    return sum + getEventWeight(event.event_severity)
  }, 0)

  const integritySummary = {
    totalEvents: (events || []).length,
    countsByType
  }

  const { error: updateError } = await writer
    .from('assessment_attempts')
    .update({
      risk_score: riskScore,
      risk_level: getAttemptRiskLevel(riskScore),
      integrity_summary: integritySummary,
      last_activity_at: nowIso()
    })
    .eq('id', attemptId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    riskScore,
    riskLevel: getAttemptRiskLevel(riskScore),
    integritySummary
  }
}

function shuffleList(items) {
  const clone = [...items]
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const temporary = clone[index]
    clone[index] = clone[swapIndex]
    clone[swapIndex] = temporary
  }
  return clone
}

function buildDeliverySnapshot(assessment, questions) {
  const orderedQuestions = assessment.shuffle_questions ? shuffleList(questions) : [...questions]
  const questionIds = orderedQuestions.map((question) => question.id)
  const optionOrder = {}

  orderedQuestions.forEach((question) => {
    const optionIds = (question.options || []).map((option) => option.id)
    optionOrder[question.id] = assessment.shuffle_options ? shuffleList(optionIds) : optionIds
  })

  return {
    questionIds,
    optionOrder,
    generatedAt: nowIso()
  }
}

function applyDeliverySnapshot(questions, snapshot) {
  const questionMap = new Map(questions.map((question) => [question.id, question]))
  const orderedQuestionIds = toArray(snapshot?.questionIds)
  const ordered = orderedQuestionIds
    .map((questionId) => questionMap.get(questionId))
    .filter(Boolean)

  const fallback = questions.filter((question) => !orderedQuestionIds.includes(question.id))
  const combined = [...ordered, ...fallback]

  return combined.map((question) => {
    const optionOrder = snapshot?.optionOrder?.[question.id] || []
    const optionsById = new Map((question.options || []).map((option) => [option.id, option]))
    const orderedOptions = optionOrder
      .map((optionId) => optionsById.get(optionId))
      .filter(Boolean)
    const remainingOptions = (question.options || []).filter((option) => !optionOrder.includes(option.id))

    return {
      ...question,
      options: [...orderedOptions, ...remainingOptions]
    }
  })
}

function getAttemptExpiration(assessment) {
  const now = Date.now()
  const durationDeadline = assessment.duration_minutes
    ? now + (assessment.duration_minutes * 60 * 1000)
    : null
  const closeDeadline = assessment.close_at ? new Date(assessment.close_at).getTime() : null
  const deadline = [durationDeadline, closeDeadline].filter(Boolean).sort((a, b) => a - b)[0]
  return deadline ? new Date(deadline).toISOString() : null
}

function ensureAssessmentAvailableForStudent(assessment) {
  const now = new Date()

  if (assessment.status !== 'published') {
    throw new Error('Assessment is not available')
  }

  if (assessment.open_at && new Date(assessment.open_at) > now) {
    throw new Error('Assessment is not open yet')
  }

  if (assessment.close_at && new Date(assessment.close_at) < now) {
    throw new Error('Assessment is closed')
  }
}

function sanitizeAssessmentForStudent(assessment, attempt = null, result = null) {
  const metadata = normalizeAssessmentMetadata(assessment.metadata)

  return {
    ...assessment,
    metadata,
    delivery_mode: metadata.deliveryMode,
    coding_language: metadata.codingLanguage,
    answerKeyVisible: false,
    canViewResults: Boolean(
      result && (result.published_to_student || assessment.show_results_immediately)
    ),
    currentAttemptId: attempt?.id || null
  }
}

function sanitizeQuestionForStudent(question, assessment, resultVisible) {
  return decorateAssessmentQuestion({
    ...question,
    answer_key: resultVisible ? question.answer_key : {},
    answer_explanation: resultVisible ? question.answer_explanation : null,
    options: (question.options || []).map((option) => ({
      ...option,
      is_correct: resultVisible ? option.is_correct : undefined
    }))
  })
}

function getCorrectOptionIds(question) {
  return (question.options || [])
    .filter((option) => option.is_correct)
    .map((option) => option.id)
    .sort()
}

function evaluateQuestion(question, answer) {
  const points = Number(question.points || 0)
  const emptyResult = {
    isCorrect: false,
    autoScore: 0,
    requiresReview: false,
    correctQuestion: false
  }

  if (!answer) {
    return emptyResult
  }

  if (isCodingQuestion(question)) {
    return {
      isCorrect: null,
      autoScore: 0,
      requiresReview: true,
      correctQuestion: false
    }
  }

  if (MANUAL_REVIEW_TYPES.has(question.question_type)) {
    return {
      isCorrect: null,
      autoScore: 0,
      requiresReview: true,
      correctQuestion: false
    }
  }

  if (question.question_type === 'short_answer') {
    const acceptedAnswers = uniqueStrings(toArray(question.answer_key?.acceptedAnswers)).map((value) => normalizeResponseText(value))
    if (acceptedAnswers.length === 0) {
      return {
        isCorrect: null,
        autoScore: 0,
        requiresReview: true,
        correctQuestion: false
      }
    }

    const submitted = normalizeResponseText(answer.answer_text)
    const correct = acceptedAnswers.includes(submitted)

    return {
      isCorrect: correct,
      autoScore: correct ? points : 0,
      requiresReview: false,
      correctQuestion: correct
    }
  }

  if (question.question_type === 'numeric') {
    const expected = normalizeNumber(question.answer_key?.numericAnswer, null)
    const tolerance = Math.max(0, normalizeNumber(question.answer_key?.tolerance, 0))
    const actual = normalizeNumber(answer.numeric_answer, null)
    const correct = actual !== null && expected !== null && Math.abs(actual - expected) <= tolerance

    return {
      isCorrect: correct,
      autoScore: correct ? points : 0,
      requiresReview: false,
      correctQuestion: correct
    }
  }

  if (question.question_type === 'match') {
    const expectedMatches = question.answer_key?.matches || {}
    const actualMatches = safeJson(answer.answer_json, {})
    const correct = JSON.stringify(expectedMatches) === JSON.stringify(actualMatches)

    return {
      isCorrect: correct,
      autoScore: correct ? points : 0,
      requiresReview: false,
      correctQuestion: correct
    }
  }

  if (AUTO_GRADED_TYPES.has(question.question_type)) {
    const actualOptionIds = uniqueStrings(answer.selected_option_ids).sort()
    const correctOptionIds = getCorrectOptionIds(question)
    const correct = JSON.stringify(actualOptionIds) === JSON.stringify(correctOptionIds)

    return {
      isCorrect: correct,
      autoScore: correct ? points : 0,
      requiresReview: false,
      correctQuestion: correct
    }
  }

  return emptyResult
}

function buildTopicBreakdown(questions, answerMap) {
  const topicStats = new Map()

  questions.forEach((question) => {
    const topicKey = question.topic_id || `question-${question.id}`
    if (!topicStats.has(topicKey)) {
      topicStats.set(topicKey, {
        topicId: question.topic_id || null,
        topicTitle: question.topic?.title || question.metadata?.topicTitle || 'General',
        questions: 0,
        answered: 0,
        correct: 0,
        score: 0,
        maxScore: 0
      })
    }

    const stats = topicStats.get(topicKey)
    const answer = answerMap.get(question.id)
    stats.questions += 1
    stats.maxScore += Number(question.points || 0)

    if (answer) {
      stats.answered += 1
      stats.score += Number(answer.final_score ?? answer.auto_score ?? 0)
      if (answer.is_correct) {
        stats.correct += 1
      }
    }
  })

  return [...topicStats.values()].map((entry) => ({
    ...entry,
    percentage: computePercentage(entry.score, entry.maxScore)
  }))
}

async function persistResult(writer, payload) {
  const { error } = await writer
    .from('assessment_results')
    .upsert(payload, { onConflict: 'attempt_id' })

  if (error) {
    throw new Error(error.message)
  }
}

export async function reviewTeacherAssessmentAttempt(supabase, classroomId, assessmentId, attemptId, teacherUserId, payload) {
  const writer = createAdminClient() || supabase
  const attemptDetail = await getTeacherAssessmentAttemptDetail(supabase, classroomId, assessmentId, attemptId, teacherUserId)
  const reviews = toArray(payload.reviews)
  const reviewByQuestionId = new Map(reviews.map((review) => [review.questionId, review]))

  for (const question of attemptDetail.questions) {
    const review = reviewByQuestionId.get(question.id)
    if (!review || !question.answer) {
      continue
    }

    const teacherScore = Math.max(0, Math.min(Number(question.points || 0), normalizeNumber(review.score, 0)))
    const finalScore = teacherScore + Number(question.answer.auto_score || 0)

    const { error } = await writer
      .from('assessment_answers')
      .update({
        teacher_score: teacherScore,
        final_score: finalScore,
        requires_review: false,
        feedback: normalizeNullableText(review.feedback),
        evaluated_at: nowIso()
      })
      .eq('id', question.answer.id)

    if (error) {
      throw new Error(error.message)
    }
  }

  const { data: answers, error: answersError } = await writer
    .from('assessment_answers')
    .select('*')
    .eq('attempt_id', attemptId)

  if (answersError) {
    throw new Error(answersError.message)
  }

  const answerMap = new Map((answers || []).map((answer) => [answer.question_id, answer]))
  const topicBreakdown = buildTopicBreakdown(attemptDetail.questions, answerMap)
  const objectiveScore = (answers || []).reduce((sum, answer) => sum + Number(answer.auto_score || 0), 0)
  const subjectiveScore = (answers || []).reduce((sum, answer) => sum + Number(answer.teacher_score || 0), 0)
  const totalScore = objectiveScore + subjectiveScore
  const maxScore = attemptDetail.questions.reduce((sum, question) => sum + Number(question.points || 0), 0)
  const answeredQuestions = (answers || []).filter((answer) => (
    answer.answer_text || answer.selected_option_ids?.length > 0 || answer.numeric_answer !== null || answer.numeric_answer !== undefined || Object.keys(answer.answer_json || {}).length > 0
  )).length
  const correctQuestions = (answers || []).filter((answer) => answer.is_correct).length
  const percentage = computePercentage(totalScore, maxScore)

  await persistResult(writer, {
    assessment_id: assessmentId,
    attempt_id: attemptId,
    classroom_id: classroomId,
    student_user_id: attemptDetail.attempt.student_user_id,
    total_questions: attemptDetail.questions.length,
    answered_questions: answeredQuestions,
    correct_questions: correctQuestions,
    objective_score: objectiveScore,
    subjective_score: subjectiveScore,
    total_score: totalScore,
    max_score: maxScore,
    percentage,
    teacher_feedback: normalizeNullableText(payload.teacherFeedback),
    mastery_summary: {
      passPercentage: attemptDetail.assessment.pass_percentage,
      passed: percentage >= Number(attemptDetail.assessment.pass_percentage || 0)
    },
    topic_breakdown: topicBreakdown,
    published_to_student: normalizeBoolean(payload.publishToStudent, attemptDetail.assessment.show_results_immediately)
  })

  const { error: attemptError } = await writer
    .from('assessment_attempts')
    .update({
      status: 'finalized',
      teacher_review_score: subjectiveScore,
      score: totalScore,
      max_score: maxScore,
      percentage,
      submitted_at: attemptDetail.attempt.submitted_at || nowIso()
    })
    .eq('id', attemptId)

  if (attemptError) {
    throw new Error(attemptError.message)
  }

  return getTeacherAssessmentAttemptDetail(supabase, classroomId, assessmentId, attemptId, teacherUserId)
}

export async function listStudentClassroomAssessments(supabase, classroomId, studentUserId) {
  await assertStudentMembership(supabase, classroomId, studentUserId)
  const reader = createAdminClient() || supabase

  const { data: assessments, error } = await reader
    .from('classroom_assessments')
    .select(`
      *,
      classroom_courses (
        id,
        subjects (
          id,
          title
        )
      )
    `)
    .eq('classroom_id', classroomId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const assessmentIds = (assessments || []).map((assessment) => assessment.id)
  const [questionResult, attemptResult, resultResult] = await Promise.all([
    assessmentIds.length > 0
      ? reader.from('assessment_questions').select('id, assessment_id').in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length > 0
      ? reader.from('assessment_attempts').select('*').in('assessment_id', assessmentIds).eq('student_user_id', studentUserId)
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length > 0
      ? reader.from('assessment_results').select('*').in('assessment_id', assessmentIds).eq('student_user_id', studentUserId)
      : Promise.resolve({ data: [], error: null })
  ])

  if (questionResult.error) throw new Error(questionResult.error.message)
  if (attemptResult.error) throw new Error(attemptResult.error.message)
  if (resultResult.error) throw new Error(resultResult.error.message)

  const questionByAssessmentId = groupBy(questionResult.data || [], (item) => item.assessment_id)
  const attemptByAssessmentId = groupBy(attemptResult.data || [], (item) => item.assessment_id)
  const resultByAssessmentId = groupBy(resultResult.data || [], (item) => item.assessment_id)

  return (assessments || []).map((assessment) => {
    const attempts = attemptByAssessmentId.get(assessment.id) || []
    const latestAttempt = attempts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
    const latestResult = (resultByAssessmentId.get(assessment.id) || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
    const now = new Date()
    let availabilityLabel = 'Available'

    if (assessment.open_at && new Date(assessment.open_at) > now) {
      availabilityLabel = 'Upcoming'
    } else if (assessment.close_at && new Date(assessment.close_at) < now) {
      availabilityLabel = 'Closed'
    } else if (latestAttempt && ATTEMPT_ACTIVE_STATUSES.has(latestAttempt.status)) {
      availabilityLabel = 'Resume'
    } else if (latestResult) {
      availabilityLabel = 'Completed'
    }

    return {
      ...buildAssessmentSummary(assessment, {
        questions: questionByAssessmentId.get(assessment.id) || [],
        attempts,
        results: resultByAssessmentId.get(assessment.id) || []
      }),
      latestAttempt,
      latestResult,
      availabilityLabel
    }
  })
}

async function getLatestStudentAttempt(reader, assessmentId, studentUserId) {
  const { data, error } = await reader
    .from('assessment_attempts')
    .select('*')
    .eq('assessment_id', assessmentId)
    .eq('student_user_id', studentUserId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data || null
}

export async function getStudentAssessmentSession(supabase, classroomId, assessmentId, studentUserId) {
  await assertStudentMembership(supabase, classroomId, studentUserId)
  const reader = createAdminClient() || supabase
  const { assessment, questions } = await getAssessmentAndQuestions(reader, classroomId, assessmentId)
  ensureAssessmentAvailableForStudent(assessment)

  const latestAttempt = await getLatestStudentAttempt(reader, assessmentId, studentUserId)
  const activeAttempt = latestAttempt && ATTEMPT_ACTIVE_STATUSES.has(latestAttempt.status)
    ? latestAttempt
    : null

  const questionSet = activeAttempt
    ? applyDeliverySnapshot(questions, activeAttempt.delivery_snapshot)
    : questions

  const { data: answers, error: answersError } = activeAttempt
    ? await reader
        .from('assessment_answers')
        .select('*')
        .eq('attempt_id', activeAttempt.id)
    : { data: [], error: null }

  if (answersError) {
    throw new Error(answersError.message)
  }

  const { data: latestResult, error: resultError } = latestAttempt
    ? await reader
        .from('assessment_results')
        .select('*')
        .eq('attempt_id', latestAttempt.id)
        .maybeSingle()
    : { data: null, error: null }

  if (resultError) {
    throw new Error(resultError.message)
  }

  const resultVisible = Boolean(latestResult && (latestResult.published_to_student || assessment.show_results_immediately))
  const answersByQuestionId = new Map((answers || []).map((answer) => [answer.question_id, answer]))

  return {
    assessment: sanitizeAssessmentForStudent(assessment, activeAttempt, latestResult),
    questions: questionSet.map((question) => ({
      ...sanitizeQuestionForStudent(question, assessment, resultVisible),
      answer: answersByQuestionId.get(question.id) || null
    })),
    currentAttempt: activeAttempt,
    latestAttempt,
    latestResult: resultVisible ? latestResult : null
  }
}

export async function startStudentAssessmentAttempt(supabase, classroomId, assessmentId, studentUserId) {
  await assertStudentMembership(supabase, classroomId, studentUserId)
  const reader = createAdminClient() || supabase
  const writer = createAdminClient() || supabase
  const { assessment, questions } = await getAssessmentAndQuestions(reader, classroomId, assessmentId)
  ensureAssessmentAvailableForStudent(assessment)

  const currentAttempt = await getLatestStudentAttempt(reader, assessmentId, studentUserId)

  if (currentAttempt && ATTEMPT_ACTIVE_STATUSES.has(currentAttempt.status)) {
    return currentAttempt
  }

  const previousAttemptsCount = currentAttempt?.attempt_number || 0
  if (previousAttemptsCount >= Number(assessment.max_attempts || 1)) {
    throw new Error('Maximum attempts reached')
  }

  const deliverySnapshot = buildDeliverySnapshot(assessment, questions)
  const { data: attempt, error } = await writer
    .from('assessment_attempts')
    .insert({
      assessment_id: assessmentId,
      classroom_id: classroomId,
      student_user_id: studentUserId,
      attempt_number: previousAttemptsCount + 1,
      status: 'in_progress',
      delivery_snapshot: deliverySnapshot,
      started_at: nowIso(),
      expires_at: getAttemptExpiration(assessment),
      max_score: questions.reduce((sum, question) => sum + Number(question.points || 0), 0)
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return attempt
}

async function getStudentAttemptForSave(reader, classroomId, assessmentId, attemptId, studentUserId) {
  const { data, error } = await reader
    .from('assessment_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('assessment_id', assessmentId)
    .eq('classroom_id', classroomId)
    .eq('student_user_id', studentUserId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Assessment attempt not found')
  }

  if (!ATTEMPT_ACTIVE_STATUSES.has(data.status)) {
    throw new Error('Assessment attempt is not editable')
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('Assessment attempt has expired')
  }

  return data
}

function buildSavedAnswerPayload(question, payload, studentUserId, attemptId) {
  const base = {
    attempt_id: attemptId,
    question_id: question.id,
    student_user_id: studentUserId,
    answer_text: null,
    numeric_answer: null,
    selected_option_ids: [],
    answer_json: {},
    saved_at: nowIso()
  }

  if (isCodingQuestion(question)) {
    return {
      ...base,
      answer_text: normalizeNullableText(payload.answerText),
      answer_json: safeJson(payload.answerJson, {})
    }
  }

  if (question.question_type === 'numeric') {
    return {
      ...base,
      numeric_answer: payload.numericAnswer === '' ? null : normalizeNumber(payload.numericAnswer, null)
    }
  }

  if (question.question_type === 'mcq' || question.question_type === 'true_false') {
    return {
      ...base,
      selected_option_ids: payload.selectedOptionId ? [payload.selectedOptionId] : []
    }
  }

  if (question.question_type === 'multi_select') {
    return {
      ...base,
      selected_option_ids: uniqueStrings(toArray(payload.selectedOptionIds))
    }
  }

  if (question.question_type === 'match') {
    return {
      ...base,
      answer_json: safeJson(payload.answerJson, {})
    }
  }

  return {
    ...base,
    answer_text: normalizeNullableText(payload.answerText)
  }
}

export async function saveStudentAssessmentAnswer(supabase, classroomId, assessmentId, attemptId, studentUserId, payload) {
  await assertStudentMembership(supabase, classroomId, studentUserId)
  const reader = createAdminClient() || supabase
  const writer = createAdminClient() || supabase
  const attempt = await getStudentAttemptForSave(reader, classroomId, assessmentId, attemptId, studentUserId)
  const { questions } = await getAssessmentAndQuestions(reader, classroomId, assessmentId)
  const question = questions.find((item) => item.id === payload.questionId)

  if (!question) {
    throw new Error('Assessment question not found')
  }

  const answerPayload = buildSavedAnswerPayload(question, payload, studentUserId, attempt.id)

  const { error } = await writer
    .from('assessment_answers')
    .upsert(answerPayload, {
      onConflict: 'attempt_id,question_id'
    })

  if (error) {
    throw new Error(error.message)
  }

  const { error: attemptUpdateError } = await writer
    .from('assessment_attempts')
    .update({
      last_activity_at: nowIso()
    })
    .eq('id', attempt.id)

  if (attemptUpdateError) {
    throw new Error(attemptUpdateError.message)
  }

  return {
    success: true
  }
}

export async function submitStudentAssessmentAttempt(supabase, classroomId, assessmentId, attemptId, studentUserId) {
  await assertStudentMembership(supabase, classroomId, studentUserId)
  const reader = createAdminClient() || supabase
  const writer = createAdminClient() || supabase
  const attempt = await getStudentAttemptForSave(reader, classroomId, assessmentId, attemptId, studentUserId)
  const { assessment, questions } = await getAssessmentAndQuestions(reader, classroomId, assessmentId)

  const { data: answers, error: answersError } = await writer
    .from('assessment_answers')
    .select('*')
    .eq('attempt_id', attemptId)

  if (answersError) {
    throw new Error(answersError.message)
  }

  const answerMap = new Map((answers || []).map((answer) => [answer.question_id, answer]))
  let objectiveScore = 0
  let manualReviewScore = 0
  let correctQuestions = 0
  let answeredQuestions = 0
  let requiresTeacherReview = false

  for (const question of questions) {
    const answer = answerMap.get(question.id)
    if (answer && (
      answer.answer_text ||
      (answer.selected_option_ids || []).length > 0 ||
      answer.numeric_answer !== null ||
      Object.keys(answer.answer_json || {}).length > 0
    )) {
      answeredQuestions += 1
    }

    const evaluation = evaluateQuestion(question, answer)
    if (evaluation.requiresReview) {
      requiresTeacherReview = true
    }

    if (evaluation.correctQuestion) {
      correctQuestions += 1
    }

    objectiveScore += Number(evaluation.autoScore || 0)

    if (answer) {
      const finalScore = Number(evaluation.autoScore || 0) + Number(answer.teacher_score || 0)
      const { error: answerUpdateError } = await writer
        .from('assessment_answers')
        .update({
          is_correct: evaluation.isCorrect,
          auto_score: evaluation.autoScore,
          final_score: finalScore,
          requires_review: evaluation.requiresReview,
          evaluated_at: nowIso()
        })
        .eq('id', answer.id)

      if (answerUpdateError) {
        throw new Error(answerUpdateError.message)
      }

      manualReviewScore += Number(answer.teacher_score || 0)
    }
  }

  const risk = await recomputeAttemptRisk(writer, attemptId)
  const maxScore = questions.reduce((sum, question) => sum + Number(question.points || 0), 0)
  const totalScore = objectiveScore + manualReviewScore
  const percentage = computePercentage(totalScore, maxScore)
  const topicBreakdown = buildTopicBreakdown(questions, answerMap)
  const status = requiresTeacherReview ? 'teacher_review_pending' : 'finalized'
  const submittedAt = nowIso()

  const { error: attemptUpdateError } = await writer
    .from('assessment_attempts')
    .update({
      status,
      submitted_at: submittedAt,
      auto_graded_score: objectiveScore,
      teacher_review_score: manualReviewScore,
      score: totalScore,
      max_score: maxScore,
      percentage,
      last_activity_at: submittedAt,
      risk_score: risk.riskScore,
      risk_level: risk.riskLevel,
      integrity_summary: risk.integritySummary
    })
    .eq('id', attemptId)

  if (attemptUpdateError) {
    throw new Error(attemptUpdateError.message)
  }

  await persistResult(writer, {
    assessment_id: assessmentId,
    attempt_id: attemptId,
    classroom_id: classroomId,
    student_user_id: studentUserId,
    total_questions: questions.length,
    answered_questions: answeredQuestions,
    correct_questions: correctQuestions,
    objective_score: objectiveScore,
    subjective_score: manualReviewScore,
    total_score: totalScore,
    max_score: maxScore,
    percentage,
    teacher_feedback: null,
    mastery_summary: {
      passPercentage: assessment.pass_percentage,
      passed: percentage >= Number(assessment.pass_percentage || 0),
      teacherReviewPending: requiresTeacherReview
    },
    topic_breakdown: topicBreakdown,
    published_to_student: assessment.show_results_immediately && !requiresTeacherReview
  })

  return getStudentAssessmentSession(supabase, classroomId, assessmentId, studentUserId)
}

export async function logStudentAssessmentEvent(supabase, classroomId, assessmentId, attemptId, studentUserId, payload) {
  await assertStudentMembership(supabase, classroomId, studentUserId)
  const reader = createAdminClient() || supabase
  const writer = createAdminClient() || supabase
  await getStudentAttemptForSave(reader, classroomId, assessmentId, attemptId, studentUserId)

  const eventType = normalizeText(payload.eventType)
  if (!eventType) {
    throw new Error('eventType is required')
  }

  const severity = normalizeText(payload.severity).toLowerCase()
  const eventSeverity = severity === 'high' || severity === 'medium' ? severity : 'low'
  const { error } = await writer
    .from('assessment_events')
    .insert({
      attempt_id: attemptId,
      assessment_id: assessmentId,
      student_user_id: studentUserId,
      event_type: eventType,
      event_severity: eventSeverity,
      details: safeJson(payload.details, {})
    })

  if (error) {
    throw new Error(error.message)
  }

  return recomputeAttemptRisk(writer, attemptId)
}
