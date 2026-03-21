const visualLearningStyle = {
  id: 'Visual',
  badge: 'Visual tutorial',
  shortDescription: 'Diagram-led lessons with high-signal visuals, structured comparisons, and pattern spotting.',
  preview: 'Expect Mermaid flowcharts, concept maps, labeled comparisons, and image-like mental anchors.',
  graphGuidance: 'Prefer concept clusters, before-vs-after structure, diagram-first sequencing, and strong spatial grouping.',
  tutorTone: 'Guide the learner with visual anchors, contrasts, and what-to-notice language.',
  blockExpectations: [
    'lesson_intro',
    'visual_explainer',
    'concept_walkthrough',
    'worked_example',
    'self_check',
    'recap',
    'review_bridge'
  ],
  interactionPatterns: [
    'Ask the learner what belongs first, what changes in the middle, and what appears at the end.',
    'Use diagram-first explanations, comparison prompts, and visual checkpoints.',
    'Turn recap into a map, ladder, flow, or side-by-side comparison.'
  ],
  artifactExpectations: [
    'At least one Mermaid flowchart or concept map inside tutorialMarkdown.',
    'A visual_explainer block with diagramCode and diagramCaption.',
    'A sequence or categorization task that mirrors the visual artifact.',
    'A compact comparison table or visual checklist when the topic has tradeoffs or categories.',
    'An image-oriented panel when a real-world object, diagram, or phenomenon would improve the explanation.'
  ],
  artifactToolkit: [
    'concept_map',
    'compare_board',
    'image_panel',
    'analogy_anchor',
    'mistake_radar',
    'practice_board',
    'scenario_lab'
  ],
  requiredArtifactTypes: ['concept_map', 'compare_board'],
  qualityStandards: [
    'The learner should be able to picture the concept after the first screen.',
    'Every major explanation should map to a visual structure, contrast, or observable pattern.',
    'Avoid generic prose when a flow, map, ladder, or comparison would teach faster.'
  ],
  antiPatterns: [
    'Do not write a plain article with a diagram pasted in as decoration.',
    'Do not use vague phrases like "important concept" without showing what to notice.',
    'Do not explain stages without making the order visually obvious.'
  ],
  sectionBlueprint: [
    'Visual hook',
    'Map of the concept',
    'Core theory in visible stages',
    'Real-world comparison',
    'Worked example',
    'Practice reconstruction',
    'Common confusions',
    'Recap map',
    'Review bridge'
  ],
  practiceBlueprint: [
    'Sequence reconstruction task',
    'Pattern spotting check',
    'Comparison or categorization drill'
  ],
  markdownExpectations: [
    'Use short sections, clear headings, and strong whitespace.',
    'Convert long abstract descriptions into visible stages and comparisons.',
    'Prefer "notice", "trace", "compare", and "spot the pattern" phrasing.',
    'Use tables, diagrams, and image markdown when they teach faster than prose.'
  ],
  engagementMoves: [
    'Open with a strong visual metaphor or a map of the topic.',
    'Make the learner reconstruct the flow rather than only read it.',
    'End with a single-screen visual summary worth revisiting.'
  ],
  flashcardStyle: 'Use identify, compare, label, and pattern-recognition prompts.',
  reviewPromptPrefix: 'Use a visual recap and pattern recognition prompt.'
}

export default visualLearningStyle
