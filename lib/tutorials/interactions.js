export const SUPPORTED_INTERACTION_TYPES = [
  'sequence',
  'categorize',
  'decision',
  'code_session',
  'retrieval_grid'
]

export const LEARNING_STYLE_INTERACTION_RULES = {
  Visual: {
    minInteractions: 3,
    maxInteractions: 3,
    allowedInteractionTypes: ['sequence', 'categorize', 'decision'],
    requireMermaid: true,
    allowCodeSession: false
  },
  Auditory: {
    minInteractions: 3,
    maxInteractions: 3,
    allowedInteractionTypes: ['decision', 'retrieval_grid'],
    requireMermaid: false,
    allowCodeSession: false
  },
  'Reading/Writing': {
    minInteractions: 3,
    maxInteractions: 3,
    allowedInteractionTypes: ['retrieval_grid', 'decision'],
    requireMermaid: false,
    allowCodeSession: false
  },
  Kinesthetic: {
    minInteractions: 3,
    maxInteractions: 3,
    allowedInteractionTypes: ['sequence', 'categorize', 'decision'],
    requireMermaid: false,
    allowCodeSession: false
  },
  'Project-based': {
    minInteractions: 4,
    maxInteractions: 4,
    allowedInteractionTypes: ['sequence', 'categorize', 'decision', 'code_session'],
    requireMermaid: false,
    allowCodeSession: true
  }
}

const CODE_TOPIC_PATTERN = /\b(html|css|javascript|typescript|react|next\.?js|node|python|java|c\+\+|c#|sql|api|database|algorithm|data structure|function|component|class|object|loop|array|coding|programming|software|web app|frontend|backend|full stack|debugging|git)\b/i

function normalizeText(value) {
  return String(value || '').trim()
}

export function isSupportedInteractionType(type) {
  return SUPPORTED_INTERACTION_TYPES.includes(String(type || '').trim())
}

export function getLearningStyleInteractionRule(style) {
  return LEARNING_STYLE_INTERACTION_RULES[style] || LEARNING_STYLE_INTERACTION_RULES['Reading/Writing']
}

export function hasSupportedInteraction(block) {
  return isSupportedInteractionType(block?.interaction?.type)
}

export function countSupportedInteractions(blocks = []) {
  return Array.isArray(blocks)
    ? blocks.filter((block) => hasSupportedInteraction(block)).length
    : 0
}

export function isCodeTopicContext({
  subjectTitle = '',
  topicTitle = '',
  topicDescription = ''
}) {
  const combined = [
    normalizeText(subjectTitle),
    normalizeText(topicTitle),
    normalizeText(topicDescription)
  ].join(' ')

  return CODE_TOPIC_PATTERN.test(combined)
}

export function tutorialHasMermaidDiagram(bundle) {
  const markdown = String(bundle?.tutorialMarkdown || '')
  const blocks = Array.isArray(bundle?.tutorialBlocks) ? bundle.tutorialBlocks : []

  if (/```mermaid[\s\S]*?```/i.test(markdown)) {
    return true
  }

  return blocks.some((block) => String(block?.diagramCode || '').trim())
}

export function getInteractionDesignNotes({
  learningStyle,
  subjectTitle = '',
  topicTitle = '',
  topicDescription = ''
}) {
  const rule = getLearningStyleInteractionRule(learningStyle)
  const codeTopic = isCodeTopicContext({ subjectTitle, topicTitle, topicDescription })
  const mustUseCodeSession = rule.allowCodeSession && codeTopic

  return [
    `Supported interaction types: ${SUPPORTED_INTERACTION_TYPES.join(', ')}.`,
    `Allowed interaction types for ${learningStyle}: ${rule.allowedInteractionTypes.join(', ')}.`,
    `Interaction count for ${learningStyle}: between ${rule.minInteractions} and ${rule.maxInteractions}.`,
    'Use artifact-based tasks wherever possible: draggable cards, placed artifacts, sorted items, or sequenced steps.',
    rule.requireMermaid
      ? 'Visual tutorials must include at least one Mermaid flowchart in markdown and should also attach Mermaid diagramCode to the visual explainer block.'
      : 'Do not include Mermaid unless the style specifically benefits from it.',
    mustUseCodeSession
      ? 'Because this is a project-based code topic, include exactly one code_session interaction.'
      : rule.allowCodeSession
        ? 'Only include a code_session if the topic is clearly code-oriented and the learning style is project-based.'
        : `Do not include code_session blocks for ${learningStyle}.`
  ].join('\n')
}
