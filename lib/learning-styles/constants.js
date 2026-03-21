export const LEARNING_STYLE_OPTIONS = [
  'Visual',
  'Auditory',
  'Reading/Writing',
  'Kinesthetic',
  'Project-based'
]

export const DEFAULT_LEARNING_STYLE = 'Reading/Writing'
export const TUTORIAL_VERSION = 'v10-auditory-podcast-quality'
export const STYLE_RECIPE_VERSION = '2026-03-style-tutorials-v11-auditory-podcast-quality'

const STYLE_SET = new Set(LEARNING_STYLE_OPTIONS)

export function isValidLearningStyle(value) {
  return STYLE_SET.has(String(value || '').trim())
}

export function normalizeLearningStyle(value) {
  const incoming = String(value || '').trim()
  return STYLE_SET.has(incoming) ? incoming : DEFAULT_LEARNING_STYLE
}
