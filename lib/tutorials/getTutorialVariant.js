import { TUTORIAL_VERSION } from '@/lib/learning-styles/constants'
import { isMissingTutorialVariantsTableError } from '@/lib/tutorials/storage'

export async function getTutorialVariant(supabase, { topicId, userId, learningStyle, tutorialVersion = TUTORIAL_VERSION }) {
  const { data, error } = await supabase
    .from('topic_tutorial_variants')
    .select('*')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .eq('learning_style', learningStyle)
    .eq('tutorial_version', tutorialVersion)
    .maybeSingle()

  if (error) {
    if (isMissingTutorialVariantsTableError(error)) {
      console.warn('[tutorials] topic_tutorial_variants table is missing; using non-persistent fallback mode.')
      return null
    }
    throw new Error(error.message)
  }

  return data || null
}
