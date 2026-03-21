import { getLearningStyleRecipe } from '@/lib/learning-styles/recipes'
import {
  buildTopicSignalProfile,
  countAnchorMentions,
  isLowSignalAnchorTerm,
  selectHighSignalAnchorTerms
} from '@/lib/tutorials/topicSignals'

const GENERIC_PHRASES = [
  'it matters because it helps you understand',
  'in context',
  'main concept or process',
  'clear, practical way',
  'realistic scenario',
  'important idea',
  'state the setup',
  'name the key mechanism',
  'predict the outcome',
  'explain one mistake they might make',
  'what you begin with',
  'what you do or what changes',
  'what result you inspect afterward'
]

const GENERIC_SCENARIO_PATTERNS = [
  /a learner has to explain or apply/i,
  /state the setup\./i,
  /name the key mechanism\./i,
  /predict the outcome\./i,
  /explain one mistake they might make\./i
]

const GENERIC_COMPARE_BOARD_PATTERNS = [
  /bucket\s*\|\s*what belongs there/i,
  /inputs\s*\|\s*what you begin with/i,
  /actions\s*\|\s*what you do or what changes/i,
  /outputs\s*\|\s*what result you inspect afterward/i,
  /setup\s*\|\s*the starting conditions/i,
  /mechanism\s*\|\s*the change, action, or rule/i,
  /outcome\s*\|\s*the result or evidence/i
]

const GENERIC_ACTION_LAB_PATTERNS = [
  /name the starting state/i,
  /predict what changes/i,
  /check the outcome/i
]

const PROMPT_LEAK_PATTERNS = [
  /keep the explanation conversational/i,
  /ask for an explain-it-back response/i,
  /grounded in the actual topic parts/i,
  /use explicit speaker labels/i,
  /return only valid json/i,
  /do not output code fences/i,
  /use the outline as a floor/i,
  /artifacts must teach/i,
  /tutorialmarkdown must/i
]

const GENERIC_AUDITORY_SCRIPT_PATTERNS = [
  /let's make .* sound simple before we make it sound formal/i,
  /connect those parts to the mechanism and the result/i,
  /explain .* in plain language, not textbook language/i,
  /what changes between them/i,
  /what outcome proves the idea is working/i
]

const GENERIC_PROMPT_PATTERNS = [
  /^explain (the )?topic/i,
  /^give one example/i,
  /^state the setup, mechanism, and outcome/i,
  /^what is the main concept/i,
  /^why does .* matter/i
]

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function hasAnyPattern(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text))
}

function countArtifactAnchorMentions(artifact, anchorTerms = []) {
  return countAnchorMentions(extractText(artifact).toLowerCase(), anchorTerms)
}

function extractText(value) {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(extractText).join(' ')
  }

  if (typeof value === 'object') {
    return Object.values(value).map(extractText).join(' ')
  }

  return ''
}

function countMatches(text, pattern) {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

function normalizeText(value) {
  return String(value || '').trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractQuestionTopicFocus(topicTitle = '') {
  const normalized = normalizeText(topicTitle)
  if (!normalized) {
    return ''
  }

  const patterns = [
    /^what is\s+(.+?)\s+and\s+why\s+learn\s+it\??$/i,
    /^what is\s+(.+?)\??$/i,
    /^why learn\s+(.+?)\??$/i
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      return normalizeText(match[1].replace(/["']/g, ''))
    }
  }

  return ''
}

function findDuplicateEntries(values = [], minLength = 16) {
  const seen = new Map()
  const duplicates = []

  values.forEach((value) => {
    const normalized = normalizeComparableText(value)
    if (!normalized || normalized.length < minLength) {
      return
    }

    const count = seen.get(normalized) || 0
    seen.set(normalized, count + 1)
    if (count === 1) {
      duplicates.push(normalized)
    }
  })

  return duplicates
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

function findRepeatedAuditoryScript(entries = []) {
  const normalizedEntries = entries
    .map((entry) => ({
      type: entry?.type,
      normalized: normalizeComparableText(entry?.markdown),
      markdown: String(entry?.markdown || '')
    }))
    .filter((entry) => entry.normalized.length >= 80)

  for (let index = 0; index < normalizedEntries.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < normalizedEntries.length; compareIndex += 1) {
      const left = normalizedEntries[index]
      const right = normalizedEntries[compareIndex]

      if (
        left.normalized === right.normalized
        || left.normalized.includes(right.normalized)
        || right.normalized.includes(left.normalized)
      ) {
        return { left, right }
      }
    }
  }

  return null
}

function extractAuditoryScriptEntries(blocks = []) {
  return blocks.flatMap((block) => {
    const entries = []

    if (block?.type === 'dialogue_segment' && String(block?.markdown || '').trim()) {
      entries.push({ type: 'dialogue_segment', markdown: String(block.markdown) })
    }

    asArray(block?.artifacts).forEach((artifact) => {
      if (artifact?.type === 'voice_script' && String(artifact?.markdown || '').trim()) {
        entries.push({ type: 'voice_script', markdown: String(artifact.markdown) })
      }
    })

    return entries
  })
}

function hasWeakAuditoryAnchorList(scriptMarkdown = '', topicTitle = '') {
  const match = String(scriptMarkdown || '').match(/name the real parts:\s*([^\n.?!"]+)/i)
  if (!match) return false

  const items = match[1]
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)

  if (items.length < 2) {
    return true
  }

  const weakCount = items.filter((item) => (
    isLowSignalAnchorTerm(item, topicTitle) || normalizeText(topicTitle).toLowerCase().includes(item.toLowerCase())
  )).length

  return weakCount >= Math.max(2, items.length - 1)
}

export function evaluateTutorialQuality(bundle, style, tutorialContext = {}) {
  const recipe = getLearningStyleRecipe(style)
  const topicProfile = buildTopicSignalProfile(tutorialContext)
  const preferredAnchors = selectHighSignalAnchorTerms(tutorialContext, { profile: topicProfile, limit: 4 })
  const markdown = String(bundle?.tutorialMarkdown || '')
  const blocks = asArray(bundle?.tutorialBlocks)
  const flashcards = asArray(bundle?.flashcards)
  const chatStarters = asArray(bundle?.chatStarters)
  const reviewPrompts = asArray(bundle?.reviewPrompts)
  const artifacts = blocks.flatMap((block) => asArray(block?.artifacts))
  const auditoryScriptEntries = extractAuditoryScriptEntries(blocks)
  const voiceScriptEntries = auditoryScriptEntries.filter((entry) => entry.type === 'voice_script')
  const auditoryScriptText = extractText(auditoryScriptEntries).toLowerCase()
  const topicTitle = String(tutorialContext?.topicTitle || '').trim()
  const normalizedMarkdown = markdown.toLowerCase()
  const combinedBlockText = extractText(blocks).toLowerCase()
  const supportText = extractText([flashcards, chatStarters, reviewPrompts]).toLowerCase()
  const allText = `${normalizedMarkdown}\n${combinedBlockText}\n${supportText}`
  const topicMentions = topicTitle
    ? countMatches(allText, new RegExp(topicTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))
    : 0
  const headingCount = countMatches(markdown, /^##\s+/gm)
  const concreteCueCount = countMatches(allText, /\b(example|scenario|tradeoff|outcome|because|notice|predict|build|compare|checkpoint|artifact|deliverable)\b/gi)
  const analogyCueCount = countMatches(allText, /\b(like|imagine|think of|similar to|as if|metaphor|analogy|picture)\b/gi)
  const theoryCueCount = countMatches(allText, /\b(why|how|because|mechanism|process|principle|means|happens|reason)\b/gi)
  const genericPhraseCount = GENERIC_PHRASES.reduce((count, phrase) => (
    normalizedMarkdown.includes(phrase) ? count + 1 : count
  ), 0)
  const blockBodies = blocks.filter((block) => (
    String(block?.body || '').trim().length >= 90 || String(block?.markdown || '').trim().length >= 180
  )).length
  const substantialTeachingBlocks = blocks.filter((block) =>
    ['lesson_intro', 'concept_walkthrough', 'worked_example', 'recap'].includes(block?.type)
    && (
      String(block?.body || '').trim().length >= 120
      || String(block?.markdown || '').trim().length >= 220
      || asArray(block?.artifacts).some((artifact) => String(artifact?.markdown || '').trim().length >= 180)
    )
  ).length
  const practiceMoments = blocks.filter((block) =>
    Boolean(block?.interaction?.type)
    || Boolean(String(block?.prompt || '').trim())
    || ['self_check', 'reflection_prompt', 'review_bridge', 'worked_example'].includes(block?.type)
  ).length
  const flashcardQuality = flashcards.filter((card) =>
    String(card?.front || '').trim().length >= 18 && String(card?.back || '').trim().length >= 40
  ).length
  const artifactCount = artifacts.filter((artifact) => String(artifact?.markdown || '').trim()).length
  const artifactTypes = new Set(artifacts.map((artifact) => String(artifact?.type || '').trim()).filter(Boolean))
  const markdownFeatureCount = countMatches(
    `${markdown}\n${artifacts.map((artifact) => artifact?.markdown || '').join('\n')}\n${blocks.map((block) => block?.markdown || '').join('\n')}`,
    /```|!\[[^\]]*\]\([^)]+\)|^\s*>\s+|^\s*[-*]\s+\[[ xX]\]|\|.+\|/gm
  )
  const anchorMentionCount = countAnchorMentions(allText, topicProfile.anchorTerms)
  const scenarioArtifacts = artifacts.filter((artifact) => artifact?.type === 'scenario_lab')
  const compareBoards = artifacts.filter((artifact) => artifact?.type === 'compare_board')
  const actionLabs = artifacts.filter((artifact) => artifact?.type === 'action_lab')
  const genericScenarioArtifact = scenarioArtifacts.find((artifact) =>
    GENERIC_SCENARIO_PATTERNS.every((pattern) => pattern.test(String(artifact?.markdown || '')))
  )
  const genericCompareBoard = compareBoards.find((artifact) =>
    GENERIC_COMPARE_BOARD_PATTERNS.every((pattern) => pattern.test(String(artifact?.markdown || '')))
  )
  const genericActionLab = actionLabs.find((artifact) =>
    GENERIC_ACTION_LAB_PATTERNS.every((pattern) => pattern.test(String(artifact?.markdown || '')))
  )
  const weakScenarioArtifact = scenarioArtifacts.find((artifact) => countArtifactAnchorMentions(artifact, topicProfile.anchorTerms) < 3)
  const weakCompareBoard = compareBoards.find((artifact) => countArtifactAnchorMentions(artifact, topicProfile.anchorTerms) < 3)
  const weakActionLab = actionLabs.find((artifact) => countArtifactAnchorMentions(artifact, topicProfile.anchorTerms) < 3)
  const genericKinestheticBlock = blocks.find((block) => (
    ['micro_activity', 'worked_example', 'self_check', 'reflection_prompt'].includes(block?.type)
    && hasAnyPattern(extractText(block).toLowerCase(), [
      /state the setup/i,
      /name the key mechanism/i,
      /predict the outcome/i,
      /explain one mistake/i,
      /what you begin with/i,
      /what you do or what changes/i,
      /what result you inspect afterward/i
    ])
  ))
  const promptLeakMatch = PROMPT_LEAK_PATTERNS.find((pattern) => pattern.test(allText))
  const weakAuditoryAnchorScript = auditoryScriptEntries.find((entry) => hasWeakAuditoryAnchorList(entry.markdown, topicTitle))
  const auditoryAnchorMentionCount = countAnchorMentions(auditoryScriptText, preferredAnchors)
  const genericAuditoryScript = auditoryScriptEntries.find((entry) =>
    GENERIC_AUDITORY_SCRIPT_PATTERNS.filter((pattern) => pattern.test(String(entry?.markdown || ''))).length >= 2
  )
  const repeatedAuditoryScript = findRepeatedAuditoryScript(auditoryScriptEntries)
  const substantialVoiceScript = voiceScriptEntries.find((entry) => (
    normalizeText(entry?.markdown).length >= 420 && countSpeakerTurns(entry?.markdown) >= 8
  ))
  const duplicateBlockTitles = findDuplicateEntries(blocks.map((block) => block?.title), 12)
  const duplicateFlashcardFronts = findDuplicateEntries(flashcards.map((card) => card?.front), 12)
  const duplicateChatStarters = findDuplicateEntries(chatStarters, 18)
  const duplicateReviewPrompts = findDuplicateEntries(reviewPrompts, 18)
  const weakSupportPrompts = [...chatStarters, ...reviewPrompts].filter((entry) => (
    normalizeText(entry).length < 28 || GENERIC_PROMPT_PATTERNS.some((pattern) => pattern.test(normalizeText(entry)))
  ))
  const questionTopicFocus = extractQuestionTopicFocus(topicTitle)
  const hasQuestionFocusDefinition = questionTopicFocus
    ? new RegExp(`\\b${escapeRegExp(questionTopicFocus)}\\s+(is|lets|allows|powers|runs|works as)\\b`, 'i').test(allText)
    : true
  const hasQuestionFocusPayoff = questionTopicFocus
    ? (
      new RegExp(`\\b${escapeRegExp(questionTopicFocus)}\\s+(matters|helps|lets|allows|powers|is useful)\\b`, 'i').test(allText)
      || /\bwhy learn\b/i.test(allText)
      || /\bwhy it matters\b/i.test(allText)
    )
    : true

  const errors = []

  if (markdown.trim().length < 2200) {
    errors.push('Tutorial markdown is too thin to feel premium; expand the teaching walkthrough.')
  }

  if (headingCount < 8) {
    errors.push('Tutorial markdown needs stronger structure with multiple substantial sections.')
  }

  if (blockBodies < Math.min(4, blocks.length)) {
    errors.push('Too many tutorial blocks are underspecified; expand block bodies with real teaching content.')
  }

  if (substantialTeachingBlocks < 4) {
    errors.push('Core lesson blocks need more theory and explanation; the tutorial feels too thin.')
  }

  if (topicTitle && topicMentions < 6) {
    errors.push('The tutorial does not stay anchored enough to the specific topic.')
  }

  if (questionTopicFocus && (!hasQuestionFocusDefinition || !hasQuestionFocusPayoff)) {
    errors.push('Question-style topics must answer the topic directly in plain English and explain why learning it matters.')
  }

  if (concreteCueCount < 10) {
    errors.push('The tutorial needs more concrete examples, outcomes, or action-oriented cues.')
  }

  if (theoryCueCount < 12) {
    errors.push('The tutorial needs more theory, reasoning, or explanation of how the topic works.')
  }

  if (analogyCueCount < 3) {
    errors.push('The tutorial needs at least one meaningful analogy or intuitive comparison.')
  }

  if (practiceMoments < 4) {
    errors.push('The tutorial needs more practice moments so the learner can use the idea, not just read it.')
  }

  if (artifactCount < 6) {
    errors.push('The tutorial needs more teaching artifacts; add richer panels, labs, maps, or study assets.')
  }

  if (artifactTypes.size < 4) {
    errors.push('The tutorial needs a wider range of artifact types so the learning experience does not feel repetitive.')
  }

  if (markdownFeatureCount < 3) {
    errors.push('The tutorial is not using enough markdown-rich teaching elements such as tables, code blocks, images, quotes, or checklists.')
  }

  if (genericPhraseCount >= 3) {
    errors.push('The tutorial uses too much generic filler language.')
  }

  if (promptLeakMatch) {
    errors.push('Learner-facing content is leaking authoring or model instructions instead of real teaching copy.')
  }

  if (duplicateBlockTitles.length > 0) {
    errors.push('Tutorial block titles are too repetitive; each section should feel distinct and intentional.')
  }

  if (duplicateFlashcardFronts.length > 0 || duplicateChatStarters.length > 0 || duplicateReviewPrompts.length > 0) {
    errors.push('Review surfaces are repetitive; flashcards, chat starters, and review prompts should cover distinct angles.')
  }

  if (weakSupportPrompts.length >= 2) {
    errors.push('Chat starters or review prompts are too generic; they should reference the actual topic mechanism, example, or misconception.')
  }

  if (topicProfile.domainId !== 'generic' && anchorMentionCount < 6) {
    errors.push('The tutorial is not using enough topic-specific concrete terms for this domain.')
  }

  if (genericScenarioArtifact) {
    errors.push('Scenario lab is still using a generic template instead of a real topic-specific situation.')
  }

  if (scenarioArtifacts.length > 0 && weakScenarioArtifact) {
    errors.push('Scenario lab is too abstract; it must name concrete topic entities, decisions, and observable outcomes.')
  }

  if (genericCompareBoard) {
    errors.push('Compare board is too generic; it must use real topic parts, tradeoffs, signals, or layers instead of template buckets.')
  }

  if (compareBoards.length > 0 && weakCompareBoard) {
    errors.push('Compare board is not grounded enough in the real topic parts; rewrite it with actual entities and signals.')
  }

  if (style === 'Kinesthetic' && genericActionLab) {
    errors.push('Kinesthetic action lab is too generic; it must tell the learner what to manipulate or verify in the actual topic.')
  }

  if (style === 'Kinesthetic' && actionLabs.length > 0 && topicProfile.domainId !== 'generic' && weakActionLab) {
    errors.push('Kinesthetic action lab is not concrete enough; it must tell the learner exactly what to inspect, manipulate, predict, or verify.')
  }

  if (style === 'Kinesthetic' && genericKinestheticBlock) {
    errors.push('Kinesthetic teaching blocks still contain template language; replace it with topic-specific actions and signals.')
  }

  if (style === 'Kinesthetic' && topicProfile.domainId !== 'generic') {
    const kinestheticArtifactText = extractText(
      artifacts.filter((artifact) => ['action_lab', 'compare_board', 'scenario_lab', 'practice_board'].includes(artifact?.type))
    ).toLowerCase()
    const kinestheticAnchorMentions = countAnchorMentions(kinestheticArtifactText, topicProfile.anchorTerms)

    if (kinestheticAnchorMentions < 5) {
      errors.push('Kinesthetic artifacts are not concrete enough; they need more real topic entities, states, and observable outcomes.')
    }
  }

  if (style === 'Auditory') {
    if (auditoryScriptEntries.length === 0) {
      errors.push('Auditory tutorials need at least one real tutor-learner script or voice script artifact.')
    }

    if (voiceScriptEntries.length === 0) {
      errors.push('Auditory tutorials need a dedicated voice_script artifact for the main podcast episode.')
    }

    if (!substantialVoiceScript) {
      errors.push('Auditory tutorials need one substantial podcast-style voice_script artifact, not just a short prompt or excerpt.')
    }

    if (preferredAnchors.length > 0 && auditoryAnchorMentionCount < Math.min(2, preferredAnchors.length)) {
      errors.push('Auditory scripts are not grounded enough in concrete topic parts; use real entities instead of generic labels.')
    }

    if (weakAuditoryAnchorScript) {
      errors.push('Auditory scripts are naming weak title fragments instead of concrete topic parts.')
    }

    if (genericAuditoryScript) {
      errors.push('Auditory scripts still sound like generic coaching scaffolds instead of topic-specific teaching dialogue.')
    }

    if (repeatedAuditoryScript) {
      errors.push('Auditory scripts are repeating the same transcript across episode and dialogue surfaces; each audio surface should add something new.')
    }
  }

  if (flashcardQuality < 3) {
    errors.push('Flashcards are too shallow; they should feel like real review prompts.')
  }

  if (!recipe.qualityStandards || recipe.qualityStandards.length === 0) {
    errors.push('Learning style quality standards are missing for this tutorial.')
  }

  if (Array.isArray(recipe.requiredArtifactTypes) && recipe.requiredArtifactTypes.some((artifactType) => !artifactTypes.has(artifactType))) {
    errors.push(`The tutorial is missing one or more required ${style} artifact types.`)
  }

  return {
    isHighQuality: errors.length === 0,
    errors
  }
}
