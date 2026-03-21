import { generateWithGemini } from '@/lib/gemini'
import { buildLearningStylePromptContext, getLearningStyleRecipe } from '@/lib/learning-styles/recipes'
import { TUTORIAL_VERSION } from '@/lib/learning-styles/constants'
import {
  getInteractionDesignNotes,
  getLearningStyleInteractionRule,
  isCodeTopicContext
} from '@/lib/tutorials/interactions'
import { buildLearnerPersonalizationGuidance, buildTutorialBundleContract } from '@/lib/tutorials/promptLayer'
import { buildCodeExampleGuidance } from '@/lib/tutorials/codeLanguage'
import { buildTopicSpecificityGuidance } from '@/lib/tutorials/topicSignals'

export async function generateTutorialBundle({
  apiKey,
  subjectTitle,
  subjectDescription,
  subjectSyllabus,
  topicTitle,
  topicDescription,
  difficulty,
  userProfile,
  learningStyle,
  outline
}) {
  const recipe = getLearningStyleRecipe(learningStyle)
  const interactionRule = getLearningStyleInteractionRule(learningStyle)
  const codeTopic = isCodeTopicContext({
    subjectTitle,
    topicTitle,
    topicDescription
  })
  const shouldUseCodeSession = interactionRule.allowCodeSession && codeTopic
  const codeExampleGuidance = buildCodeExampleGuidance({
    subjectTitle,
    subjectDescription,
    subjectSyllabus,
    topicTitle,
    topicDescription
  })
  const prompt = `You are generating a style-specific interactive tutorial.

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

Additional generation requirements:
- Use the outline as a floor, not a rigid template.
- Include a dedicated theory-building section, a real-world analogy section, a worked example section, a practice section, and a misconception section in the markdown lesson.
- Avoid generic filler, motivational fluff, vague statements, and reusable boilerplate.
- Write the kind of lesson a serious learner would want to save and revisit.
- Build explanations, examples, and review prompts that feel intentionally personalized rather than mass-produced.
- Reject shallow artifact templates. If you include a compare board, scenario lab, or action lab, fill it with the real parts and signals of the topic.

Tutorial outline:
${JSON.stringify(outline, null, 2)}

Learner Profile:
- Education Level: ${userProfile?.education_level || 'General Audience'}
- Occupation: ${userProfile?.occupation || 'Not specified'}
- Learning Goals: ${userProfile?.learning_goals || 'To learn effectively'}
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

Style-specific flashcard guidance: ${recipe.flashcardStyle}

Subject: ${subjectTitle}
Subject Description: ${subjectDescription || 'Not specified'}
Subject Syllabus: ${subjectSyllabus || 'Not specified'}
Topic: ${topicTitle}
Topic Description: ${topicDescription || topicTitle}
Difficulty: ${difficulty}/5
Tutorial Version: ${TUTORIAL_VERSION}`

  const response = await generateWithGemini([
    { role: 'system', content: 'You are an expert tutor and curriculum writer. Return only valid JSON.' },
    { role: 'user', content: prompt }
  ], {
    apiKey,
    temperature: 0.65,
    maxOutputTokens: 10000
  })

  const raw = response.choices?.[0]?.message?.content
    ?.replace(/```json/gi, '')
    ?.replace(/```/g, '')
    ?.trim()

  if (!raw) {
    throw new Error('AI returned empty tutorial bundle')
  }

  return JSON.parse(raw)
}
