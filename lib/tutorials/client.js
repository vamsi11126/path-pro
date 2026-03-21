export async function fetchTutorialBundle({
  topicId,
  classroomId = null,
  classroomCourseId = null
}) {
  const response = await fetch('/api/generate-topic-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topicId,
      classroomId,
      classroomCourseId
    })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Failed to load tutorial')
  }

  return result
}
