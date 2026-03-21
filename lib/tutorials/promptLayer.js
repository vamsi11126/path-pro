import { getLearningStyleRecipe } from '@/lib/learning-styles/recipes'
import { buildTopicSignalProfile, buildTopicSpecificityGuidance, selectHighSignalAnchorTerms } from '@/lib/tutorials/topicSignals'

export const ARTIFACT_TYPE_DESCRIPTIONS = {
  concept_map: 'Diagram-led explanation, concept map, or visual flow. Often uses Mermaid, labeled bullets, or a compact visual summary.',
  compare_board: 'Side-by-side contrast, tradeoff board, or category comparison. Prefer markdown tables or clearly separated columns.',
  image_panel: 'Image-first teaching panel. Use markdown image syntax or <<IMAGE: specific search query>> with explanatory commentary.',
  voice_script: 'Speakable podcast episode script, narrated lesson segment, or tutor-learner exchange designed for multi-voice playback.',
  note_sheet: 'High-signal study notes, glossary, formula bank, or summary page that a learner could reuse directly.',
  action_lab: 'Hands-on prompt set that asks the learner to do, test, predict, observe, or reorder something now.',
  project_brief: 'Deliverable-oriented brief with milestone, constraints, acceptance criteria, and visible proof of progress.',
  code_lab: 'Runnable or inspectable code artifact with annotated explanation, debugging notes, or implementation checkpoints.',
  mistake_radar: 'Common mistakes, false intuitions, and correction cues that help the learner notice what goes wrong.',
  practice_board: 'Focused prompt board, retrieval sheet, question bank, or worked drill designed for active recall.',
  capability_checklist: 'Checklist of what the learner should now be able to explain, identify, build, or verify.',
  checklist: 'Compact checklist or revision list. Use markdown task list syntax when it improves clarity.',
  analogy_anchor: 'An intuition-first artifact that locks a concept to a memorable analogy, metaphor, or mental model.',
  scenario_lab: 'A realistic scenario walkthrough with constraints, decision points, and expected outcomes.',
  glossary_bank: 'A dense terminology bank or named concept sheet that speeds up revision and reduces ambiguity.'
}

function buildArtifactCatalogText(artifactTypes = []) {
  return artifactTypes
    .map((artifactType) => `- ${artifactType}: ${ARTIFACT_TYPE_DESCRIPTIONS[artifactType] || 'Reusable teaching artifact.'}`)
    .join('\n')
}

function getStyleArtifactRules(recipe) {
  const requiredTypes = Array.isArray(recipe.requiredArtifactTypes) ? recipe.requiredArtifactTypes : []
  const toolkit = Array.isArray(recipe.artifactToolkit) ? recipe.artifactToolkit : []

  return [
    `Artifact toolkit for this style: ${toolkit.join(', ')}.`,
    requiredTypes.length > 0
      ? `Required artifact types for this style: ${requiredTypes.join(', ')}.`
      : 'No additional required artifact types were provided.',
    'Artifacts must teach. They cannot be decorative wrappers around content already stated elsewhere.',
    'At least one artifact should use markdown affordances that the UI already supports well: code fences, Mermaid, tables, blockquotes, task lists, or markdown images.',
    'Artifacts should be distributed across the lesson instead of being stacked only at the end.'
  ].join('\n')
}

export function buildTutorialBundleContract({
  learningStyle,
  interactionRule,
  shouldUseCodeSession,
  codeExampleGuidance = '',
  subjectTitle = '',
  subjectDescription = '',
  subjectSyllabus = '',
  topicTitle = '',
  topicDescription = ''
}) {
  const recipe = getLearningStyleRecipe(learningStyle)
  const topicProfile = buildTopicSignalProfile({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const topicSpecificityGuidance = buildTopicSpecificityGuidance({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const preferredAnchors = selectHighSignalAnchorTerms({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  }, { profile: topicProfile, limit: 4 })

  return `Return ONLY valid JSON with this exact shape:
{
  "tutorialMarkdown": "string",
  "tutorialBlocks": [
    {
      "type": "lesson_intro",
      "title": "string",
      "body": "string",
      "markdown": "optional string",
      "items": ["optional strings"],
      "prompt": "optional string",
      "callout": "optional string",
      "diagramCode": "optional mermaid code string",
      "diagramCaption": "optional string",
      "artifacts": [
        {
          "type": "concept_map | compare_board | image_panel | voice_script | note_sheet | action_lab | project_brief | code_lab | mistake_radar | practice_board | capability_checklist | checklist | analogy_anchor | scenario_lab | glossary_bank",
          "title": "string",
          "description": "optional string",
          "markdown": "string"
        }
      ],
      "interaction": {
        "type": "sequence | categorize | decision | code_session | retrieval_grid",
        "title": "string",
        "instructions": "string",
        "items": [{ "id": "string", "label": "string", "hint": "optional string", "category": "optional string", "feedback": "optional string" }],
        "solutionOrder": ["optional ids"],
        "categories": [{ "id": "string", "label": "string", "description": "optional string" }],
        "options": [{ "id": "string", "label": "string", "isCorrect": true, "feedback": "string" }],
        "prompts": [{ "id": "string", "label": "string", "answer": "string", "hint": "optional string" }],
        "language": "optional string",
        "starterCode": "optional string",
        "tasks": ["optional strings"],
        "checkpoints": [{ "id": "string", "prompt": "string", "answer": "string" }],
        "solutionCode": "optional string",
        "mentorNotes": ["optional strings"],
        "successMessage": "optional string"
      }
    }
  ],
  "flashcards": [
    { "front": "string", "back": "string" }
  ],
  "chatStarters": ["string"],
  "reviewPrompts": ["string"]
}

Artifact type catalog for ${learningStyle}:
${buildArtifactCatalogText(recipe.artifactToolkit)}

${getStyleArtifactRules(recipe)}

${topicSpecificityGuidance}

Non-negotiable content rules:
- tutorialMarkdown must be a full premium lesson, not a short wrapper around the blocks.
- tutorialMarkdown must contain at least 9 substantial sections with real teaching content.
- tutorialMarkdown must cover theory, intuition, example, practice, misconceptions, recap, and review bridge.
- tutorialMarkdown must answer the learner's two basic questions directly: what the topic is in plain English, and why learning it is useful.
- tutorialMarkdown should usually exceed 2200 characters unless the topic is exceptionally small.
- tutorialBlocks must match the tutorial and stay ordered.
- Include at least one worked example block.
- Include between ${interactionRule.minInteractions} and ${interactionRule.maxInteractions} interaction blocks that use the interaction object.
- Include self_check, recap, and review_bridge blocks.
- Include at least 6 artifacts across the tutorialBlocks.
- Use at least 4 distinct artifact types, and they must come from this style toolkit when possible.
- At least 3 blocks must contain either block.markdown or artifacts.
- At least 4 blocks must contain artifacts.
- Use block.markdown whenever code fences, tables, images, or structured markdown will teach better than plain text.
- Balance theory, real-world analogy, and practice inside the lesson itself.
- In the opening section, define ${topicTitle || 'the topic'} plainly before moving into abstractions, frameworks, or meta commentary.
- Make the learner payoff explicit early: say why someone would learn ${topicTitle || 'the topic'} and what it lets them do.
- Make the tutorial materially different for ${learningStyle}.
- Treat ${learningStyle} as its own teaching system with its own artifacts, pacing, and engagement patterns.
- ${learningStyle === 'Auditory' ? 'For dialogue_segment blocks and voice_script artifacts, use explicit speaker labels like Tutor:, Learner:, Coach:, Host:, or Narrator: so the UI can render multi-voice playback cleanly.' : 'When you write scripts or dialogues, keep structure clear and readable.'}
- ${learningStyle === 'Auditory' ? 'Treat the main voice_script artifact as a podcast episode, not a tiny say-it-back prompt. It should have a clear hook, explanation, example, misconception correction, and recap.' : 'Keep learner-facing scripts materially useful rather than decorative.'}
- ${learningStyle === 'Auditory' ? 'The main voice_script should usually contain at least 8 labeled speaker turns and enough detail to stand alone as the primary auditory lesson.' : 'Use enough detail that artifacts can stand on their own.'}
- ${learningStyle === 'Auditory' ? 'dialogue_segment blocks should act like chapter excerpts or coaching checkpoints. Do not repeat the same script lines already used in the main voice_script artifact.' : 'Avoid repeating the same content across multiple blocks or artifacts.'}
- ${learningStyle === 'Auditory' ? `In the first part of the main voice_script, answer "${topicTitle || 'this topic'}" directly in plain English before shifting into analogy, coaching, or recall prompts.` : 'Answer the learner directly before shifting into practice or abstraction.'}
- Expand beyond the outline whenever the concept needs more explanation, examples, or practice.
- Examples must be concrete and topic-specific.
- Explain cause, effect, tradeoffs, and outcomes instead of repeating definitions.
- Include at least one real-world analogy, metaphor, or intuitive comparison that genuinely clarifies the topic.
- Never leak authoring instructions, prompt text, or model-facing directives into learner-facing output fields.
- Do not write meta lines such as "keep the explanation conversational", "ask for an explain-it-back response", "return only valid JSON", or anything addressed to the model or tutorial writer.
- Include at least four practice moments across prompts, checks, interactions, artifacts, or reflection blocks.
- Ensure lesson_intro, concept_walkthrough, worked_example, and recap contain substantial teaching content rather than placeholders.
- Make the recap strong enough to stand alone as a revision artifact.
- Flashcards must test real understanding rather than shallow recall.
- Include at least one scenario-driven artifact or practice move that feels like a real use case rather than an abstract placeholder.
- Include at least one misconception-correction artifact and one recap artifact worth revisiting later.
- Scenario labs must contain a named situation, concrete entities, decision points, and observable outcomes tied to ${topicTitle || 'the topic'}.
- Compare boards must compare real parts, signals, steps, or tradeoffs from ${topicTitle || 'the topic'} rather than empty teaching buckets.
- Action labs and kinesthetic practice must tell the learner what to inspect, manipulate, predict, or verify using actual topic parts.
- Do not use generic compare-board rows such as Setup, Mechanism, Outcome, Inputs, Actions, or Outputs unless the row names are replaced with real topic entities.
- Do not write scenario tasks like "state the setup" or "predict the outcome" unless those prompts already name the exact structures, signals, or constraints of the topic.
- For this topic, scenario labs should explicitly use entities such as: ${topicProfile.anchorTerms.slice(0, 6).join(', ')}.
- For this topic, compare boards should reuse real rows like: ${(topicProfile.compareBoard?.rows || []).slice(0, 3).map((row) => row.join(' | ')).join(' ; ')}.
- For this topic, hands-on actions should sound like: ${topicProfile.handsOnActions.join(' ')}.
- Preferred concrete anchors for learner-facing scripts and examples: ${preferredAnchors.join(', ') || topicTitle || 'the topic'}.
- In auditory dialogue, if the tutor says "name the real parts", the reply must name concrete entities such as ${preferredAnchors.join(', ') || topicTitle || 'the topic'}, not title fragments or generic labels.
- ${learningStyle === 'Auditory' ? `The episode should sound like a real mini-podcast for ${topicTitle || 'the topic'} and should reuse concrete anchors such as ${preferredAnchors.join(', ') || topicTitle || 'the topic'} throughout the script.` : 'Reuse concrete anchors throughout the lesson rather than only once.'}
- If a topic has named structures, fields, devices, stages, or artifacts, use them directly instead of generic nouns like "input", "action", and "output" by themselves.
- Sequence interactions must provide at least 3 items and a full solutionOrder.
- Categorize interactions must provide at least 2 categories and at least 3 items with a correct category.
- Decision interactions must provide at least 2 options and exactly one correct option.
- Retrieval grid interactions must provide at least 2 prompts with exemplar answers.
- Code session interactions must provide starterCode, at least 1 task, and at least 1 checkpoint.
- Only use interaction types from this allowlist for ${learningStyle}: ${interactionRule.allowedInteractionTypes.join(', ')}.
- ${interactionRule.requireMermaid ? 'Because this is the Visual style, tutorialMarkdown must contain at least one fenced ```mermaid block and the visual_explainer block must include diagramCode with valid Mermaid flowchart syntax.' : 'Do not add Mermaid flowcharts unless the style explicitly needs them.'}
- ${shouldUseCodeSession ? 'This is a project-based code topic, so include exactly one code_session interaction and at least one code_lab artifact.' : interactionRule.allowCodeSession ? 'Do not include a code_session unless the topic is code-oriented and the style is Project-based.' : `Do not include any code_session interaction for ${learningStyle}.`}
- ${codeExampleGuidance || 'If code examples are used, they must match the lesson language and technology.'}
- If an image would genuinely help, use markdown image syntax or <<IMAGE: very specific search query>> in tutorialMarkdown or an artifact markdown field.
- Do not output code fences around the JSON.
- Do not omit any keys.`
}

export function buildOutlineContract({
  learningStyle,
  interactionRule,
  codeExampleGuidance = '',
  subjectTitle = '',
  subjectDescription = '',
  subjectSyllabus = '',
  topicTitle = '',
  topicDescription = ''
}) {
  const recipe = getLearningStyleRecipe(learningStyle)
  const topicProfile = buildTopicSignalProfile({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const topicSpecificityGuidance = buildTopicSpecificityGuidance({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const preferredAnchors = selectHighSignalAnchorTerms({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  }, { profile: topicProfile, limit: 4 })

  return `Return ONLY valid JSON with this shape:
{
  "objective": "string",
  "sectionOrder": ["string"],
  "tutorialBlocksPlan": [
    {
      "type": "lesson_intro",
      "title": "string",
      "purpose": "string",
      "teachingGoal": "string",
      "artifactPlan": ["optional strings"],
      "interactionPlan": "optional string"
    }
  ],
  "interactionPlan": ["string"],
  "checkpointPlan": ["string"],
  "artifactPlan": ["string"],
  "reviewBridge": "string"
}

Requirements:
- Build a proper tutorial, not a reference article.
- The tutorial must include a clear objective, staged teaching progression, at least one worked example, between ${interactionRule.minInteractions} and ${interactionRule.maxInteractions} interactions, at least one checkpoint, a recap, and a bridge to review.
- Plan at least 9 substantial markdown sections so the lesson feels complete rather than templated.
- The plan must explicitly include an early plain-English definition section and an early why-it-matters section.
- Use the required block types for ${learningStyle}: ${recipe.blockExpectations.join(', ')}.
- Plan at least 6 artifacts across the lesson and mention which block owns them.
- Use at least 4 distinct artifact types.
- Use this style artifact toolkit: ${recipe.artifactToolkit.join(', ')}.
- Ensure the order teaches the topic progressively.
- Match the learner profile and style.
- Treat ${learningStyle} as a distinct content format, not a wording variant of another style.
- Plan artifact content around concrete topic entities, states, steps, or signals rather than generic placeholders.
- Scenario labs and compare boards must already name the real things the learner will inspect or manipulate.
- Do not plan meta authoring lines or prompt instructions as learner-facing content.
- Ban placeholder row names and prompt stems such as Setup, Mechanism, Outcome, Inputs, Actions, Outputs, "state the setup", and "predict the outcome" unless they are rewritten with topic-native nouns.
- Favor concrete anchors like ${preferredAnchors.join(', ') || topicTitle || 'the topic'} when planning scripts, boards, and examples.
- The planned compare-board rows should resemble these topic-grounded rows: ${(topicProfile.compareBoard?.rows || []).slice(0, 3).map((row) => row.join(' | ')).join(' ; ')}.
- The planned scenario should reuse this setup pattern: ${topicProfile.scenario?.setup || topicTitle}.
- Use these topic anchors while planning:
${topicSpecificityGuidance}
- ${codeExampleGuidance || 'Any code examples must match the topic language or technology.'}`
}

export function buildRepairRequirements({
  learningStyle,
  interactionRule,
  shouldUseCodeSession,
  codeExampleGuidance = '',
  subjectTitle = '',
  subjectDescription = '',
  subjectSyllabus = '',
  topicTitle = '',
  topicDescription = ''
}) {
  const recipe = getLearningStyleRecipe(learningStyle)
  const topicProfile = buildTopicSignalProfile({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const topicSpecificityGuidance = buildTopicSpecificityGuidance({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const preferredAnchors = selectHighSignalAnchorTerms({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  }, { profile: topicProfile, limit: 4 })

  return `Repair for quality, not just schema compliance.
- Rewrite bland, generic, or shallow sections.
- Make the content specific enough that a learner would feel it is worth studying.
- Keep the style identity strong and distinct.
- Restore the balance of theory, analogy, practice, and artifacts if the lesson leans too hard in one direction.
- Expand thin block bodies so the tutorial can stand on its own without a second guide.
- Restore missing artifacts, markdown-rich teaching panels, or interaction depth when they are required.
- Replace generic artifact templates with concrete topic content. For example, scenario labs must name the actual situation and compare boards must name the actual parts or signals.
- Remove any authoring instructions or model-facing prompt text that leaked into learner-facing content fields.
- For auditory scripts, replace weak title fragments with concrete anchors such as ${preferredAnchors.join(', ') || topicTitle || 'the topic'}.
- Ensure the repaired output still obeys the ${learningStyle} interaction limit of ${interactionRule.minInteractions}-${interactionRule.maxInteractions}.
- Ensure the repaired output uses artifacts from this toolkit where appropriate: ${recipe.artifactToolkit.join(', ')}.
- Repair with these topic anchors in mind:
${topicSpecificityGuidance}
- Restore any missing plain-English definition or missing why-learn payoff before polishing style.
- ${shouldUseCodeSession ? 'Keep exactly one code_session interaction and at least one code_lab artifact.' : 'Do not introduce a code_session unless the tutorial already qualifies for one.'}
- ${codeExampleGuidance || 'If code appears, it must match the lesson language or technology.'}`
}

export function buildLearnerPersonalizationGuidance(userProfile = {}) {
  const educationLevel = String(userProfile?.education_level || '').trim()
  const occupation = String(userProfile?.occupation || '').trim()
  const learningGoals = String(userProfile?.learning_goals || '').trim()

  return [
    'Personalization requirements:',
    educationLevel
      ? `- Calibrate depth and terminology for this education level: ${educationLevel}.`
      : '- Calibrate depth for a general but serious learner.',
    occupation
      ? `- When you need an example, analogy, or use case, prefer one that would feel believable for someone in or near this occupation: ${occupation}.`
      : '- Use realistic examples rather than generic classroom filler.',
    learningGoals
      ? `- Make the payoff and examples visibly relevant to these learner goals: ${learningGoals}.`
      : '- Make the payoff concrete and practical rather than vague.',
    '- Personalization must improve the examples, analogies, and review prompts. Do not just mention the profile in passing.',
    '- Avoid stale user-prompt phrasing. Write as if this tutorial was intentionally designed for this learner and this topic together.'
  ].join('\n')
}
