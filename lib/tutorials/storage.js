export function isMissingTutorialVariantsTableError(error) {
  const message = String(error?.message || error || '')
  return message.includes('topic_tutorial_variants')
    && (
      message.includes('schema cache')
      || message.includes('does not exist')
      || message.includes('Could not find the table')
    )
}

export function buildVirtualTutorialRow(payload) {
  const now = new Date().toISOString()

  return {
    id: `virtual-${payload.topicId}-${payload.userId}-${payload.learningStyle}-${payload.tutorialVersion}`,
    topic_id: payload.topicId,
    user_id: payload.userId,
    learning_style: payload.learningStyle,
    tutorial_version: payload.tutorialVersion,
    status: payload.qualityReport?.passed ? 'ready' : 'fallback',
    tutorial_markdown: payload.tutorialMarkdown,
    tutorial_outline: payload.tutorialOutline,
    tutorial_blocks: payload.tutorialBlocks,
    flashcards: payload.flashcards,
    chat_starters: payload.chatStarters,
    review_prompts: payload.reviewPrompts,
    quality_report: payload.qualityReport,
    source_signature: payload.sourceSignature,
    created_at: now,
    updated_at: now
  }
}
