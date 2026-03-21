import { TUTORIAL_VERSION } from '@/lib/learning-styles/constants'
import { buildVirtualTutorialRow, isMissingTutorialVariantsTableError } from '@/lib/tutorials/storage'

export async function saveTutorialVariant(supabase, payload) {
  const {
    topicId,
    userId,
    learningStyle,
    tutorialVersion = TUTORIAL_VERSION,
    tutorialMarkdown,
    tutorialOutline,
    tutorialBlocks,
    flashcards,
    chatStarters,
    reviewPrompts,
    qualityReport,
    sourceSignature
  } = payload

  const { data, error } = await supabase
    .from('topic_tutorial_variants')
    .upsert({
      topic_id: topicId,
      user_id: userId,
      learning_style: learningStyle,
      tutorial_version: tutorialVersion,
      tutorial_markdown: tutorialMarkdown,
      tutorial_outline: tutorialOutline,
      tutorial_blocks: tutorialBlocks,
      flashcards,
      chat_starters: chatStarters,
      review_prompts: reviewPrompts,
      quality_report: qualityReport,
      source_signature: sourceSignature,
      status: qualityReport?.passed ? 'ready' : 'fallback'
    }, {
      onConflict: 'topic_id,user_id,learning_style,tutorial_version'
    })
    .select()
    .single()

  if (error) {
    if (isMissingTutorialVariantsTableError(error)) {
      console.warn('[tutorials] topic_tutorial_variants table is missing; returning an in-memory tutorial result.')
      return buildVirtualTutorialRow({
        topicId,
        userId,
        learningStyle,
        tutorialVersion,
        tutorialMarkdown,
        tutorialOutline,
        tutorialBlocks,
        flashcards,
        chatStarters,
        reviewPrompts,
        qualityReport,
        sourceSignature
      })
    }
    throw new Error(error.message)
  }

  return data
}
