import { getLearningStyleRecipe } from '@/lib/learning-styles/recipes'
import {
  countSupportedInteractions,
  getLearningStyleInteractionRule,
  hasSupportedInteraction,
  isCodeTopicContext,
  tutorialHasMermaidDiagram
} from '@/lib/tutorials/interactions'
import { evaluateTutorialQuality } from '@/lib/tutorials/quality'
import { inferCodeLanguage } from '@/lib/tutorials/codeLanguage'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function combinedBlockContentLength(block) {
  return [
    block?.body,
    block?.markdown,
    block?.prompt,
    ...(Array.isArray(block?.items) ? block.items : [])
  ]
    .map((value) => String(value || '').trim())
    .join(' ')
    .trim()
    .length
}

function countSpeakerTurns(scriptMarkdown = '') {
  return String(scriptMarkdown || '')
    .replace(/\r/g, '')
    .replace(/^>\s?/gm, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-z][A-Za-z\s/-]{1,30}:\s*\S+/.test(line))
    .length
}

function validateBlockShape(block, errors, index) {
  const label = `Block ${index + 1}`
  const blockType = String(block?.type || '').trim()
  const hasArtifacts = asArray(block?.artifacts).length > 0
  const hasInteraction = Boolean(block?.interaction?.type)
  const contentLength = combinedBlockContentLength(block)
  const requiresTeachingDepth = new Set(['lesson_intro', 'concept_walkthrough', 'worked_example', 'self_check', 'recap', 'review_bridge']).has(blockType)

  if (!blockType) {
    errors.push(`${label} is missing a type.`)
  }

  if (!String(block?.title || '').trim()) {
    errors.push(`${label} is missing a title.`)
  }

  if (contentLength === 0 && !hasArtifacts && !hasInteraction) {
    errors.push(`${label} does not contain any learner-facing teaching content.`)
  }

  if (requiresTeachingDepth && contentLength < 80 && !hasArtifacts && !hasInteraction) {
    errors.push(`${label} is too thin for a core lesson block.`)
  }
}

function validateArtifacts(block, errors, index) {
  const artifacts = asArray(block?.artifacts)

  artifacts.forEach((artifact, artifactIndex) => {
    const label = `Block ${index + 1} artifact ${artifactIndex + 1}`
    if (!String(artifact?.type || '').trim()) {
      errors.push(`${label} is missing a type.`)
    }
    if (!String(artifact?.title || '').trim()) {
      errors.push(`${label} is missing a title.`)
    }
    if (!String(artifact?.markdown || '').trim()) {
      errors.push(`${label} is missing markdown content.`)
    }
  })
}

function validateInteraction(block, errors, index) {
  if (!hasSupportedInteraction(block)) {
    return
  }

  const interaction = block.interaction
  const label = `Block ${index + 1} (${block?.type || 'unknown'})`

  switch (interaction.type) {
    case 'sequence':
      if (asArray(interaction.items).length < 3) {
        errors.push(`${label} sequence interaction must contain at least 3 items.`)
      }
      if (asArray(interaction.solutionOrder).length < 3) {
        errors.push(`${label} sequence interaction must define a full solutionOrder.`)
      }
      break
    case 'categorize':
      if (asArray(interaction.categories).length < 2) {
        errors.push(`${label} categorize interaction must contain at least 2 categories.`)
      }
      if (asArray(interaction.items).length < 3) {
        errors.push(`${label} categorize interaction must contain at least 3 items.`)
      }
      if (asArray(interaction.items).some((item) => !String(item?.category || '').trim())) {
        errors.push(`${label} categorize interaction items must define their correct category.`)
      }
      break
    case 'decision': {
      const options = asArray(interaction.options)
      const correctOptions = options.filter((option) => option?.isCorrect)
      if (options.length < 2) {
        errors.push(`${label} decision interaction must contain at least 2 options.`)
      }
      if (correctOptions.length !== 1) {
        errors.push(`${label} decision interaction must contain exactly one correct option.`)
      }
      break
    }
    case 'retrieval_grid':
      if (asArray(interaction.prompts).length < 2) {
        errors.push(`${label} retrieval grid must contain at least 2 prompts.`)
      }
      break
    case 'code_session':
      if (!String(interaction.starterCode || '').trim()) {
        errors.push(`${label} code session must include starterCode.`)
      }
      if (asArray(interaction.tasks).length < 1) {
        errors.push(`${label} code session must include at least 1 task.`)
      }
      if (asArray(interaction.checkpoints).length < 1) {
        errors.push(`${label} code session must include at least 1 checkpoint.`)
      }
      break
    default:
      errors.push(`${label} uses an unsupported interaction type.`)
  }
}

export function validateTutorialBundle(bundle, style, tutorialContext = {}) {
  const errors = []
  const recipe = getLearningStyleRecipe(style)
  const interactionRule = getLearningStyleInteractionRule(style)
  const blocks = asArray(bundle?.tutorialBlocks)
  const markdown = String(bundle?.tutorialMarkdown || '').trim()
  const flashcards = asArray(bundle?.flashcards)
  const chatStarters = asArray(bundle?.chatStarters)
  const reviewPrompts = asArray(bundle?.reviewPrompts)
  const blockTypes = new Set(blocks.map((block) => String(block?.type || '').trim()).filter(Boolean))
  const artifactTypes = new Set(
    blocks.flatMap((block) => asArray(block?.artifacts))
      .map((artifact) => String(artifact?.type || '').trim())
      .filter(Boolean)
  )
  const artifactCount = blocks.reduce((count, block) => count + asArray(block?.artifacts).length, 0)
  const blocksWithRichContent = blocks.filter((block) => (
    String(block?.markdown || '').trim()
    || asArray(block?.artifacts).length > 0
  )).length
  const inferredCodeLanguage = inferCodeLanguage({
    subjectTitle: tutorialContext?.subjectTitle || '',
    subjectDescription: tutorialContext?.subjectDescription || '',
    subjectSyllabus: tutorialContext?.subjectSyllabus || '',
    topicTitle: tutorialContext?.topicTitle || '',
    topicDescription: tutorialContext?.topicDescription || ''
  })

  if (!markdown || markdown.length < 400) {
    errors.push('Tutorial markdown is too short.')
  }

  if (blocks.length < 4) {
    errors.push('Tutorial must contain at least 4 structured blocks.')
  }

  if (!blockTypes.has('worked_example')) {
    errors.push('Tutorial is missing a worked example block.')
  }

  if (!blockTypes.has('self_check')) {
    errors.push('Tutorial is missing a self-check block.')
  }

  if (!blockTypes.has('recap')) {
    errors.push('Tutorial is missing a recap block.')
  }

  if (!blockTypes.has('review_bridge')) {
    errors.push('Tutorial is missing a review bridge block.')
  }

  const interactionBlockCount = countSupportedInteractions(blocks)

  if (interactionBlockCount < interactionRule.minInteractions || interactionBlockCount > interactionRule.maxInteractions) {
    errors.push(`Tutorial for ${style} must contain between ${interactionRule.minInteractions} and ${interactionRule.maxInteractions} supported interaction blocks.`)
  }

  blocks.forEach((block, index) => {
    validateBlockShape(block, errors, index)
    validateArtifacts(block, errors, index)
    validateInteraction(block, errors, index)
  })

  for (const requiredType of recipe.blockExpectations) {
    if (!blockTypes.has(requiredType)) {
      errors.push(`Tutorial is missing the "${requiredType}" block required for ${style}.`)
    }
  }

  if (artifactCount < 6) {
    errors.push('Tutorial must contain at least 6 rich teaching artifacts.')
  }

  if (blocksWithRichContent < 4) {
    errors.push('Tutorial must use markdown or artifact panels in at least 4 blocks.')
  }

  if (artifactTypes.size < 4) {
    errors.push('Tutorial must use at least 4 distinct artifact types.')
  }

  if (asArray(recipe.requiredArtifactTypes).some((artifactType) => !artifactTypes.has(artifactType))) {
    errors.push(`Tutorial is missing one of the required artifact types for ${style}.`)
  }

  const codeSessionCount = blocks.filter((block) => block?.interaction?.type === 'code_session').length
  const voiceScripts = blocks.flatMap((block) => (
    asArray(block?.artifacts).filter((artifact) => artifact?.type === 'voice_script')
  ))

  if (!interactionRule.allowCodeSession && codeSessionCount > 0) {
    errors.push(`${style} tutorials must not include code_session interactions.`)
  }

  if (interactionRule.allowCodeSession && codeSessionCount > 1) {
    errors.push(`${style} tutorials may include at most one code_session interaction.`)
  }

  if (interactionRule.allowCodeSession && isCodeTopicContext(tutorialContext) && codeSessionCount !== 1) {
    errors.push(`${style} tutorials for code-oriented topics must include exactly one code_session interaction.`)
  }

  if (codeSessionCount > 0 && inferredCodeLanguage.id !== 'text') {
    const wrongLanguageBlock = blocks.find((block) => (
      block?.interaction?.type === 'code_session'
      && String(block?.interaction?.language || '').trim().toLowerCase() !== inferredCodeLanguage.id.toLowerCase()
    ))

    if (wrongLanguageBlock) {
      errors.push(`Code examples must use ${inferredCodeLanguage.displayName} for this topic, not ${wrongLanguageBlock.interaction.language || 'an unspecified language'}.`)
    }
  }

  const invalidInteractionType = blocks.find((block) =>
    block?.interaction?.type && !interactionRule.allowedInteractionTypes.includes(block.interaction.type)
  )
  if (invalidInteractionType) {
    errors.push(`${style} tutorials cannot use the "${invalidInteractionType.interaction.type}" interaction type.`)
  }

  if (interactionRule.requireMermaid && !tutorialHasMermaidDiagram(bundle)) {
    errors.push('Visual tutorials must include at least one Mermaid diagram.')
  }

  if (flashcards.length < 3) {
    errors.push('Tutorial must contain at least 3 flashcards.')
  }

  if (chatStarters.length < 2) {
    errors.push('Tutorial must contain at least 2 chat starters.')
  }

  if (reviewPrompts.length < 2) {
    errors.push('Tutorial must contain at least 2 review prompts.')
  }

  if (style === 'Auditory') {
    if (voiceScripts.length === 0) {
      errors.push('Auditory tutorials must include at least one voice_script artifact.')
    }

    const substantialVoiceScript = voiceScripts.find((artifact) => (
      String(artifact?.markdown || '').trim().length >= 320 && countSpeakerTurns(artifact?.markdown) >= 6
    ))

    if (!substantialVoiceScript) {
      errors.push('Auditory tutorials must include one substantial podcast-ready voice_script artifact.')
    }
  }

  const qualityCheck = evaluateTutorialQuality(bundle, style, tutorialContext)
  if (!qualityCheck.isHighQuality) {
    errors.push(...qualityCheck.errors)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
