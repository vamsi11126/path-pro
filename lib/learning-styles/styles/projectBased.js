const projectBasedLearningStyle = {
  id: 'Project-based',
  badge: 'Project tutorial',
  shortDescription: 'Build-oriented lessons with milestones, deliverables, and artifact-focused reflection.',
  preview: 'Expect milestone planning, decisions around tradeoffs, and project-ready artifacts.',
  graphGuidance: 'Organize concepts toward outputs, milestones, constraints, and learner-visible deliverables.',
  tutorTone: 'Teach like a project mentor moving the learner toward a concrete, defensible outcome.',
  blockExpectations: [
    'lesson_intro',
    'mini_project_step',
    'concept_walkthrough',
    'worked_example',
    'reflection_prompt',
    'self_check',
    'recap',
    'review_bridge'
  ],
  interactionPatterns: [
    'Tie concepts to a milestone, deliverable, or proof point.',
    'Explain tradeoffs and constraints, not just definitions.',
    'Frame recap around artifact progress and next steps.'
  ],
  artifactExpectations: [
    'A milestone-planning block that defines the next shippable or testable artifact.',
    'Decision checkpoints about tradeoffs, scope, and proof of progress.',
    'Exactly one code session when the topic is clearly code-oriented.',
    'A recap that sounds like a mini project retrospective.',
    'Artifacts such as briefs, acceptance criteria, tradeoff tables, or implementation sketches.'
  ],
  artifactToolkit: [
    'project_brief',
    'compare_board',
    'code_lab',
    'practice_board',
    'capability_checklist',
    'scenario_lab',
    'mistake_radar'
  ],
  requiredArtifactTypes: ['project_brief', 'compare_board'],
  qualityStandards: [
    'The learner should see how the concept contributes to a real deliverable or milestone.',
    'Tradeoffs, constraints, and success criteria should be explicit.',
    'By the end, the learner should know what artifact to produce next.'
  ],
  antiPatterns: [
    'Do not present isolated theory without tying it to a deliverable.',
    'Do not use fake project language without defining proof of progress.',
    'Do not add code unless it clearly advances the project milestone.'
  ],
  sectionBlueprint: [
    'Outcome hook',
    'Why this matters to the project',
    'Core theory and constraints',
    'Real-world analogy or build parallel',
    'Worked example',
    'Milestone practice',
    'Tradeoff checkpoint',
    'Retrospective recap',
    'Next-step review bridge'
  ],
  practiceBlueprint: [
    'Milestone decision',
    'Tradeoff check',
    'Artifact or code checkpoint'
  ],
  markdownExpectations: [
    'Use milestone language: build, ship, validate, prove, refine.',
    'Keep theory tied to a tangible deliverable or checkpoint.',
    'Surface constraints, tradeoffs, and "what good looks like".'
  ],
  engagementMoves: [
    'Open with a concrete outcome the learner could build toward.',
    'Make progress visible through checkpoints and artifacts.',
    'End with a realistic next milestone instead of a generic summary.'
  ],
  flashcardStyle: 'Use milestone, rationale, and tradeoff cards.',
  reviewPromptPrefix: 'Use a project reflection prompt.'
}

export default projectBasedLearningStyle
