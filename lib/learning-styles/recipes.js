import {
  DEFAULT_LEARNING_STYLE,
  LEARNING_STYLE_OPTIONS,
  STYLE_RECIPE_VERSION
} from '@/lib/learning-styles/constants'
import visualLearningStyle from '@/lib/learning-styles/styles/visual'
import auditoryLearningStyle from '@/lib/learning-styles/styles/auditory'
import readingWritingLearningStyle from '@/lib/learning-styles/styles/readingWriting'
import kinestheticLearningStyle from '@/lib/learning-styles/styles/kinesthetic'
import projectBasedLearningStyle from '@/lib/learning-styles/styles/projectBased'

export const LEARNING_STYLE_RECIPES = {
  Visual: visualLearningStyle,
  Auditory: auditoryLearningStyle,
  'Reading/Writing': readingWritingLearningStyle,
  Kinesthetic: kinestheticLearningStyle,
  'Project-based': projectBasedLearningStyle
}

export function getLearningStyleRecipe(style) {
  return LEARNING_STYLE_RECIPES[style] || LEARNING_STYLE_RECIPES[DEFAULT_LEARNING_STYLE]
}

export function getLearningStyleUiOptions() {
  return LEARNING_STYLE_OPTIONS.map((style) => {
    const recipe = getLearningStyleRecipe(style)
    return {
      value: style,
      label: style,
      description: recipe.shortDescription,
      preview: recipe.preview
    }
  })
}

export function buildLearningStylePromptContext(style) {
  const recipe = getLearningStyleRecipe(style)

  return [
    `Learning Style: ${recipe.id}`,
    `Recipe Version: ${STYLE_RECIPE_VERSION}`,
    `Tutor Tone: ${recipe.tutorTone}`,
    `Curriculum Guidance: ${recipe.graphGuidance}`,
    `Required Tutorial Blocks: ${recipe.blockExpectations.join(', ')}`,
    `Interaction Patterns: ${recipe.interactionPatterns.join(' ')}`,
    `Artifact Expectations: ${recipe.artifactExpectations.join(' ')}`,
    `Quality Standards: ${recipe.qualityStandards.join(' ')}`,
    `Anti-Patterns To Avoid: ${recipe.antiPatterns.join(' ')}`,
    `Section Blueprint: ${recipe.sectionBlueprint.join(' -> ')}`,
    `Practice Blueprint: ${recipe.practiceBlueprint.join(' ')}`,
    `Markdown Expectations: ${recipe.markdownExpectations.join(' ')}`,
    `Engagement Moves: ${recipe.engagementMoves.join(' ')}`
  ].join('\n')
}
