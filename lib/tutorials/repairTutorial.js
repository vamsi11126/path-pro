import { generateWithGemini } from '@/lib/gemini'
import { buildLearningStylePromptContext } from '@/lib/learning-styles/recipes'
import { getInteractionDesignNotes, getLearningStyleInteractionRule, isCodeTopicContext } from '@/lib/tutorials/interactions'
import { buildLearnerPersonalizationGuidance, buildRepairRequirements, buildTutorialBundleContract } from '@/lib/tutorials/promptLayer'
import { buildCodeExampleGuidance } from '@/lib/tutorials/codeLanguage'
import { buildTopicSpecificityGuidance } from '@/lib/tutorials/topicSignals'

export async function repairTutorialBundle({
  apiKey,
  learningStyle,
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription,
  userProfile,
  errors,
  outline,
  brokenPayload
}) {
  const interactionRule = getLearningStyleInteractionRule(learningStyle)
  const shouldUseCodeSession = interactionRule.allowCodeSession && isCodeTopicContext({
    subjectTitle,
    topicTitle,
    topicDescription
  })
  const codeExampleGuidance = buildCodeExampleGuidance({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const prompt = `Repair the following tutorial bundle for the topic "${topicTitle}".

${buildTutorialBundleContract({
  learningStyle,
  interactionRule,
  shouldUseCodeSession,
  codeExampleGuidance,
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription
})}

${buildRepairRequirements({
  learningStyle,
  interactionRule,
  shouldUseCodeSession,
  codeExampleGuidance,
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription
})}

Learning Style: ${learningStyle}

${buildLearnerPersonalizationGuidance(userProfile)}
${buildTopicSpecificityGuidance({
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription
})}
${buildLearningStylePromptContext(learningStyle)}
${getInteractionDesignNotes({
  learningStyle,
  subjectTitle,
  topicTitle,
  topicDescription
})}
${codeExampleGuidance}

Validation errors:
${errors.map((error, index) => `${index + 1}. ${error}`).join('\n')}

Outline:
${JSON.stringify(outline, null, 2)}

Broken payload:
${typeof brokenPayload === 'string' ? brokenPayload : JSON.stringify(brokenPayload, null, 2)}`

  const response = await generateWithGemini([
    { role: 'system', content: 'You repair malformed educational JSON. Return only valid JSON.' },
    { role: 'user', content: prompt }
  ], {
    apiKey,
    temperature: 0.35,
    maxOutputTokens: 10000
  })

  const raw = response.choices?.[0]?.message?.content
    ?.replace(/```json/gi, '')
    ?.replace(/```/g, '')
    ?.trim()

  if (!raw) {
    throw new Error('AI returned empty repair content')
  }

  return JSON.parse(raw)
}
