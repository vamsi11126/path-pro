import { generateWithGemini } from '@/lib/gemini'
import { buildLearningStylePromptContext, getLearningStyleRecipe } from '@/lib/learning-styles/recipes'
import { TUTORIAL_VERSION } from '@/lib/learning-styles/constants'
import { getInteractionDesignNotes, getLearningStyleInteractionRule } from '@/lib/tutorials/interactions'
import { buildLearnerPersonalizationGuidance, buildOutlineContract } from '@/lib/tutorials/promptLayer'
import { buildCodeExampleGuidance } from '@/lib/tutorials/codeLanguage'
import { buildTopicSpecificityGuidance } from '@/lib/tutorials/topicSignals'

export async function generateTutorialOutline({
  apiKey,
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription,
  difficulty,
  userProfile,
  learningStyle
}) {
  const recipe = getLearningStyleRecipe(learningStyle)
  const interactionRule = getLearningStyleInteractionRule(learningStyle)
  const codeExampleGuidance = buildCodeExampleGuidance({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const prompt = `You are designing a structured tutorial outline for a learner.

${buildOutlineContract({
  learningStyle,
  interactionRule,
  codeExampleGuidance,
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription
})}

Learner Profile:
- Education Level: ${userProfile?.education_level || 'General Audience'}
- Occupation: ${userProfile?.occupation || 'Not specified'}
- Learning Goals: ${userProfile?.learning_goals || 'To understand the topic deeply'}
- Preferred Learning Style: ${learningStyle}

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

Subject: ${subjectTitle}
Subject Description: ${subjectDescription || 'Not specified'}
Subject Syllabus: ${subjectSyllabus || 'Not specified'}
Topic: ${topicTitle}
Topic Description: ${topicDescription || topicTitle}
Difficulty: ${difficulty}/5
Tutorial Version: ${TUTORIAL_VERSION}`

  const response = await generateWithGemini([
    { role: 'system', content: 'You are an expert instructional designer. Return only valid JSON.' },
    { role: 'user', content: prompt }
  ], {
    apiKey,
    temperature: 0.45,
    maxOutputTokens: 5000
  })

  const raw = response.choices?.[0]?.message?.content
    ?.replace(/```json/gi, '')
    ?.replace(/```/g, '')
    ?.trim()

  if (!raw) {
    throw new Error('AI returned empty outline')
  }

  return JSON.parse(raw)
}
