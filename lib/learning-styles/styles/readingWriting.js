const readingWritingLearningStyle = {
  id: 'Reading/Writing',
  badge: 'Reading & writing tutorial',
  shortDescription: 'Text-first lessons with organized notes, precise definitions, and writing-driven recall.',
  preview: 'Expect study-sheet structure, key terms, short written responses, and clean summaries.',
  graphGuidance: 'Favor terminology, structured theory buildup, note-friendly sequencing, and definition-first progression.',
  tutorTone: 'Use precise, structured, note-friendly teaching with strong wording and concise explanations.',
  blockExpectations: [
    'lesson_intro',
    'guided_notes',
    'concept_walkthrough',
    'worked_example',
    'self_check',
    'recap',
    'review_bridge'
  ],
  interactionPatterns: [
    'Prompt the learner to summarize sections in their own words.',
    'Present key terms and short-answer checks.',
    'Make recap look like a study sheet worth revisiting.'
  ],
  artifactExpectations: [
    'A guided-notes block that could be copied into a revision notebook.',
    'Retrieval-grid or short-answer tasks with exemplar responses.',
    'A key-terms or definitions section that makes review faster.',
    'A recap that feels like a compact cheat sheet.',
    'Structured reference artifacts such as tables, glossaries, or checklists.'
  ],
  artifactToolkit: [
    'note_sheet',
    'glossary_bank',
    'compare_board',
    'practice_board',
    'mistake_radar',
    'checklist',
    'scenario_lab'
  ],
  requiredArtifactTypes: ['note_sheet', 'practice_board'],
  qualityStandards: [
    'The lesson should read like high-quality study material, not filler.',
    'Definitions, distinctions, and examples should be concise and precise.',
    'The learner should be able to revise from the recap alone.'
  ],
  antiPatterns: [
    'Do not pad the lesson with motivational fluff or empty transitions.',
    'Do not blur definitions, examples, and consequences into one paragraph.',
    'Do not use vague recap bullets that would be useless in revision.'
  ],
  sectionBlueprint: [
    'High-value summary',
    'Key definitions',
    'Core theory',
    'Real-world example',
    'Worked example',
    'Guided notes',
    'Short-answer practice',
    'Revision recap',
    'Review bridge'
  ],
  practiceBlueprint: [
    'Retrieval-grid prompt',
    'Short-answer explanation',
    'Definition vs example distinction check'
  ],
  markdownExpectations: [
    'Use crisp headings, short paragraphs, and concise bullets.',
    'Highlight definitions, distinctions, and example wording.',
    'Prefer clarity and reference value over conversational flourish.'
  ],
  engagementMoves: [
    'Open with a high-value summary that tells the learner what they will be able to write or explain.',
    'Give the learner note-taking structure instead of prose overload.',
    'End with a revision-friendly recap they would genuinely reuse.'
  ],
  flashcardStyle: 'Use define, summarize, and short-answer recall cards.',
  reviewPromptPrefix: 'Use a writing-based recall prompt.'
}

export default readingWritingLearningStyle
