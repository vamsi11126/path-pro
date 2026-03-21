const kinestheticLearningStyle = {
  id: 'Kinesthetic',
  badge: 'Kinesthetic tutorial',
  shortDescription: 'Action-oriented lessons with predict-observe-explain practice and hands-on artifact tasks.',
  preview: 'Expect move-this-now moments, manipulate-the-parts tasks, and action-based checkpoints.',
  graphGuidance: 'Bring forward application-friendly topics, stepwise actions, and practical transitions wherever possible.',
  tutorTone: 'Coach the learner through action, experimentation, and immediate application.',
  blockExpectations: [
    'lesson_intro',
    'micro_activity',
    'concept_walkthrough',
    'worked_example',
    'self_check',
    'recap',
    'review_bridge'
  ],
  interactionPatterns: [
    'Use do, predict, observe, and explain activity flow.',
    'Convert abstract ideas into actions, manipulations, or physical metaphors.',
    'Make recap about what the learner can now do.'
  ],
  artifactExpectations: [
    'A sortable or draggable artifact task tied to the concept.',
    'A worked example that feels like a sequence of actions, not static prose.',
    'Concrete "try this now" instructions or predict-then-check prompts.',
    'A recap framed as a capability checklist.',
    'Hands-on action cards that ask the learner to manipulate, test, or reorder parts of the concept.',
    'Compare boards and scenario labs must name the real parts, signals, or states of the topic instead of generic buckets.'
  ],
  artifactToolkit: [
    'action_lab',
    'practice_board',
    'compare_board',
    'capability_checklist',
    'mistake_radar',
    'scenario_lab',
    'analogy_anchor'
  ],
  requiredArtifactTypes: ['action_lab', 'capability_checklist'],
  qualityStandards: [
    'The learner should regularly do something, predict something, or manipulate something.',
    'Abstract explanation should be quickly converted into action and feedback.',
    'The lesson should create momentum and a sense of capability.'
  ],
  antiPatterns: [
    'Do not leave the learner passive for long stretches.',
    'Do not explain actions without making the learner perform or sequence them.',
    'Do not use abstract recap language when a capability checklist would be stronger.',
    'Do not use empty placeholders like input/action/output unless they are tied to actual topic entities and checks.'
  ],
  sectionBlueprint: [
    'Action hook',
    'What you are manipulating',
    'How the mechanism works',
    'Real-world physical metaphor',
    'Worked example',
    'Try-this-now practice',
    'Predict-observe-explain checkpoint',
    'Capability recap',
    'Review bridge'
  ],
  practiceBlueprint: [
    'Sorting or sequencing task',
    'Predict-then-check moment',
    'Applied checkpoint'
  ],
  markdownExpectations: [
    'Use verbs early and often: do, move, test, sort, check, try.',
    'Break explanations into actions and visible outcomes.',
    'Keep momentum high by alternating between instruction and learner action.',
    'Use the real nouns of the topic so the learner manipulates the concept itself, not a template.'
  ],
  engagementMoves: [
    'Hook the learner with a challenge they can manipulate quickly.',
    'Keep abstract explanation short and application frequent.',
    'Close with a sense of capability: what they can now perform or test.'
  ],
  flashcardStyle: 'Use apply, do-next, and scenario cards.',
  reviewPromptPrefix: 'Use an applied practice prompt.'
}

export default kinestheticLearningStyle
