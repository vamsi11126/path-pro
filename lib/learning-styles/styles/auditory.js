const auditoryLearningStyle = {
  id: 'Auditory',
  badge: 'Auditory tutorial',
  shortDescription: 'Podcast-shaped lessons with a strong spoken episode, chapter checkpoints, and recall moments that work out loud.',
  preview: 'Expect one main podcast-style lesson, chapter dialogue, and voice-friendly practice instead of text-heavy walkthroughs.',
  graphGuidance: 'Prefer concept progression that supports a spoken hook, chapter flow, example, misconception correction, and recap.',
  tutorTone: 'Sound like a calm, sharp host-tutor guiding a spoken lesson with a learner in the loop.',
  blockExpectations: [
    'lesson_intro',
    'dialogue_segment',
    'concept_walkthrough',
    'worked_example',
    'reflection_prompt',
    'self_check',
    'recap',
    'review_bridge'
  ],
  interactionPatterns: [
    'Use direct host-or-tutor-to-learner dialogue.',
    'Ask explain-it-back questions before moving forward.',
    'Correct likely misconceptions in conversational language.'
  ],
  artifactExpectations: [
    'A main podcast-style voice script that sounds natural when read aloud from start to finish.',
    'Dialogue-style blocks that work like chapter checkpoints instead of duplicating the full script.',
    'Decision checkpoints framed as "what should the tutor say next?"',
    'Recall prompts that work well as spoken answers.',
    'Recaps that read like a short voice note or coaching script.',
    'Call-and-response artifacts or talk tracks the learner could rehearse aloud.',
    'Voice scripts should use explicit speaker labels such as Tutor:, Learner:, Coach:, Host:, or Narrator: so multi-voice playback can map turns correctly.'
  ],
  artifactToolkit: [
    'voice_script',
    'compare_board',
    'analogy_anchor',
    'practice_board',
    'mistake_radar',
    'note_sheet',
    'scenario_lab'
  ],
  requiredArtifactTypes: ['voice_script', 'practice_board'],
  qualityStandards: [
    'The explanation should sound natural when spoken aloud and substantial enough to stand alone as the main lesson.',
    'Key ideas should be reinforced through echo-back, analogy, chapter transitions, and conversational correction.',
    'The learner should feel guided through a mini podcast episode rather than reading static notes.'
  ],
  antiPatterns: [
    'Do not dump textbook prose into a dialogue-shaped wrapper.',
    'Do not make the main audio lesson a short prompt or thin transcript.',
    'Do not repeat the same script twice across episode and dialogue blocks.',
    'Do not use long monologues without recall opportunities.',
    'Do not use stiff or robotic tutor language.'
  ],
  sectionBlueprint: [
    'Audio hook',
    'Plain-English explanation',
    'Podcast chapter dialogue',
    'Analogy the learner can say back',
    'Worked example',
    'Explain-it-back practice',
    'Misconception correction',
    'Spoken recap',
    'Review bridge'
  ],
  practiceBlueprint: [
    'Tutor-response decision',
    'Explain-it-back prompt',
    'Short spoken recall drill'
  ],
  markdownExpectations: [
    'Use short spoken paragraphs and call-and-response cadence.',
    'Make the main voice script feel like a coherent episode rather than isolated snippets.',
    'Include one strong analogy the learner could repeat from memory.',
    'Write lines that feel speakable rather than textbook-heavy.',
    'Use blockquotes, scripts, and short speaker turns instead of dense exposition.',
    'When writing conversational scripts, label each turn explicitly with the speaker name.'
  ],
  engagementMoves: [
    'Start with a spoken hook or framing question a learner would actually ask.',
    'Build momentum through chapter-like corrections, clarifications, and examples.',
    'Close with a short say-it-back summary the learner can rehearse aloud.'
  ],
  flashcardStyle: 'Use explain, respond, and spoken-summary style cards.',
  reviewPromptPrefix: 'Use an explain-it-back review prompt.'
}

export default auditoryLearningStyle
