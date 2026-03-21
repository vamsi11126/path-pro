import { getLearningStyleRecipe } from '@/lib/learning-styles/recipes'
import { isCodeTopicContext } from '@/lib/tutorials/interactions'
import { buildFallbackCodeSnippet, inferCodeLanguage } from '@/lib/tutorials/codeLanguage'
import { buildTopicSignalProfile, selectHighSignalAnchorTerms } from '@/lib/tutorials/topicSignals'

function safeIdentifier(value, fallback = 'topic') {
  const normalized = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((segment, index) => {
      const lower = segment.toLowerCase()
      return index === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    })
    .join('')

  return normalized || fallback
}

function artifact(type, title, markdown, description = '') {
  return { type, title, markdown, description }
}

function buildVisualMermaidCode(topicTitle) {
  return `%%title: Visual map of ${topicTitle}
%%desc: Shows the setup, the mechanism, and the outcome.
flowchart LR
  setup["Starting point for ${topicTitle}"] --> mechanism["Key mechanism or transformation"]
  mechanism --> outcome["Outcome or decision you should notice"]`
}

function renderMarkdownTable(headers = [], rows = []) {
  const safeHeaders = headers.filter(Boolean)
  const safeRows = rows.filter((row) => Array.isArray(row) && row.length > 0)

  if (safeHeaders.length === 0 || safeRows.length === 0) {
    return ''
  }

  return [
    `| ${safeHeaders.join(' | ')} |`,
    `| ${safeHeaders.map(() => '---').join(' | ')} |`,
    ...safeRows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

function renderBulletList(items = []) {
  return items.filter(Boolean).map((item) => `- ${item}`).join('\n')
}

function joinAnchors(anchorTerms = [], fallback = 'the topic') {
  return anchorTerms.length > 0 ? anchorTerms.join(', ') : fallback
}

function joinAnchorsWithAnd(anchorTerms = [], fallback = 'the topic') {
  return anchorTerms.length > 0 ? anchorTerms.join(' and ') : fallback
}

function anchorOrFallback(topicProfile, index, fallback) {
  return topicProfile?.anchorTerms?.[index] || fallback
}

function sentenceCase(value, fallback = '') {
  const text = String(value || fallback).trim()
  if (!text) return ''
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function buildAuditoryPodcastScript({
  topicTitle,
  subjectTitle,
  topicProfile,
  spokenAnchors = []
}) {
  const anchorList = joinAnchors(spokenAnchors, topicTitle)
  const anchorPair = joinAnchorsWithAnd(spokenAnchors.slice(0, 2), topicTitle)
  const plainDefinition = topicProfile.plainDefinition || `${topicTitle} is best understood by naming the real parts involved and the job they do.`
  const whyItMatters = topicProfile.whyItMatters || `${topicTitle} matters because it helps you explain and apply the topic in ${subjectTitle || 'this subject'}.`
  const setupStep = topicProfile.processSteps[0] || `identify the live parts inside ${topicTitle}`
  const mechanismStep = topicProfile.processSteps[1] || `follow the mechanism that changes the system`
  const outcomeStep = topicProfile.processSteps[2] || `check the observable result`
  const observation = topicProfile.observationSignals[0] || `the outcome you can observe after ${topicTitle} takes effect`
  const misconception = topicProfile.misconceptions[0] || `treating ${topicTitle} like a label instead of a working system`

  return [
    `Host: Today we are turning ${topicTitle} into a spoken lesson, not a glossary entry. First, answer the obvious question directly: ${plainDefinition}`,
    'Learner: That helps, because I remember the title faster than I remember what is actually happening.',
    `Tutor: Now answer the second question learners usually ask. ${whyItMatters}`,
    `Host: Start with the setup. ${setupStep}. Stay with concrete parts like ${anchorList}, because if you cannot name the live parts first, the rest of the explanation floats.`,
    `Tutor: Then move into the mechanism. ${mechanismStep}. This is the part that tells the listener what changes and why the topic matters.`,
    `Learner: So a strong explanation has to connect ${anchorPair} to the mechanism instead of listing them like vocabulary words.`,
    `Host: Exactly. Use this analogy to keep it memorable: ${topicProfile.analogy}`,
    `Tutor: Now test the idea with a concrete example. ${topicProfile.workedExample}`,
    `Learner: That makes the result easier to hear, because I can now point to ${observation}.`,
    `Host: Watch for the common mistake. ${misconception}. When that happens, the explanation sounds confident but stops being useful.`,
    `Tutor: A better explanation names ${anchorList}, explains the change in order, and finishes with the outcome. ${outcomeStep}.`,
    `Narrator: Recap. ${topicTitle} becomes clear when you can describe ${sentenceCase(setupStep, topicTitle)}, explain ${sentenceCase(mechanismStep, 'the mechanism')}, and end with ${sentenceCase(outcomeStep, 'the result')} using real topic language like ${anchorList}.`
  ].join('\n\n')
}

function buildAuditoryDialogueChapter({
  topicTitle,
  subjectTitle,
  topicProfile,
  spokenAnchors = []
}) {
  const anchorList = joinAnchors(spokenAnchors, topicTitle)
  const plainDefinition = topicProfile.plainDefinition || `${topicTitle} is best understood by naming the real parts involved and the job they do.`
  const mechanismStep = topicProfile.processSteps[1] || `follow the key mechanism in ${topicTitle}`
  const observation = topicProfile.observationSignals[0] || `the visible result that proves the idea`

  return [
    `Tutor: Give me the short chapter version of ${topicTitle}. Which concrete parts would you name first?`,
    `Learner: I would start by saying this clearly: ${plainDefinition}`,
    `Tutor: Good. After the definition, which concrete parts would you name?`,
    `Learner: I would point to ${anchorList}, because those are the parts I can actually talk through.`,
    `Tutor: Good. Now make it causal. ${mechanismStep}.`,
    `Learner: So I should explain what changes between those parts and why that change leads to ${observation}.`,
    `Tutor: Exactly. End with the consequence so the listener can tell whether the explanation is complete.`
  ].join('\n\n')
}

function buildStyleMarkdownSection({ learningStyle, topicTitle, subjectTitle, mermaidCode }) {
  switch (learningStyle) {
    case 'Visual':
      return `## Visual Map

\`\`\`mermaid
${mermaidCode}
\`\`\`

Trace the lesson from left to right: setup, mechanism, then outcome.`
    case 'Auditory':
      return `## Podcast Lens

> "If I had to turn ${topicTitle} into a short podcast segment, what concrete parts would I name first, how would I explain the mechanism, and what result would I leave the listener with?"

Use that question to structure the episode, chapter checkpoints, and recap.`
    case 'Kinesthetic':
      return `## Action Lens

Read each section asking what you can do with ${topicTitle}: sort it, test it, predict it, or inspect its result.`
    case 'Project-based':
      return `## Project Lens

Treat ${topicTitle} as a milestone. Ask what artifact, checkpoint, or visible output would prove the concept has been used correctly.`
    case 'Reading/Writing':
    default:
      return `## Study Lens

Separate definition, mechanism, example, and consequence so the lesson turns into reusable notes.`
  }
}

function buildTutorialMarkdown({
  learningStyle,
  topicTitle,
  subjectTitle,
  description,
  mermaidCode,
  codeTopic,
  codeSnippet,
  inferredLanguage,
  topicProfile
}) {
  const styleSection = buildStyleMarkdownSection({
    learningStyle,
    topicTitle,
    subjectTitle,
    mermaidCode
  })

  const projectSection = learningStyle === 'Project-based'
    ? `## Milestone Thinking

Frame ${topicTitle} as a milestone with a clear proof point. The learner should know what to build, what to test, and what counts as visible progress.`
    : ''

  const codeSection = learningStyle === 'Project-based' && codeTopic
    ? `## Small Implementation Sketch

\`\`\`${codeSnippet.language}
${codeSnippet.starterCode}
\`\`\`

This sketch uses **${inferredLanguage.displayName}** because the lesson topic points there. Keep the implementation intentionally small because the goal is milestone proof, not full implementation scope.`
    : ''

  const theoryBullets = renderBulletList(topicProfile.processSteps)
  const observationBullets = renderBulletList(topicProfile.observationSignals)
  const practiceBullets = renderBulletList(topicProfile.handsOnActions)
  const mistakeBullets = renderBulletList(topicProfile.misconceptions)
  const plainDefinition = topicProfile.plainDefinition || description
  const whyItMatters = topicProfile.whyItMatters || `${topicTitle} matters because it helps you reason about real examples in ${subjectTitle || 'this subject'}.`

  return `## Lesson Goal

Learn **${topicTitle}** inside **${subjectTitle || 'this subject'}** by understanding what it is, why it matters, how it works, and how to recall or apply it without shallow memorization.

## Plain-English Definition

${plainDefinition}

## Why Learn It

${whyItMatters}

## Why This Matters

${topicTitle} often feels familiar before it feels usable. This lesson closes that gap by tying the concept to mechanism, example, and review cues.

## Big Picture

${description}

Focus on the real moving parts of ${topicTitle}: ${topicProfile.concreteElements.join('; ')}.

${styleSection}

## Core Theory

Learners usually lose the thread by jumping from a label to a result without explaining what changed in the middle. Keep the explanation concrete and ordered:

${theoryBullets}

## What To Observe

Use these checks to tell whether your explanation of ${topicTitle} is actually grounded:

${observationBullets}

## Real-World Analogy

${topicProfile.analogy}

## Worked Example

${topicProfile.workedExample}

## Practice Moves

Do not just reread. Use the topic directly:

${practiceBullets}

## Common Mistakes

${mistakeBullets}

${projectSection}
${codeSection}

## Recap

You should now be able to define ${topicTitle}, describe its mechanism in order, explain one concrete example, and correct at least one misconception using actual topic details instead of filler.

## Review Bridge

Before review mode, answer three questions from memory: what is the exact setup, what changes in the middle, and what observable outcome proves you understood ${topicTitle}?`
}

function buildArtifactSet({
  learningStyle,
  topicTitle,
  subjectTitle,
  description,
  mermaidCode,
  codeTopic,
  topicProfile
}) {
  const spokenAnchors = selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 3 })
  const spokenAnchorPair = selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 2 })
  const spokenAnchorList = joinAnchors(spokenAnchors, topicTitle)
  const spokenAnchorPairText = joinAnchorsWithAnd(spokenAnchorPair, topicTitle)
  const auditoryPodcastScript = buildAuditoryPodcastScript({
    topicTitle,
    subjectTitle,
    topicProfile,
    spokenAnchors
  })
  const compareBoardMarkdown = renderMarkdownTable(
    topicProfile.compareBoard?.headers,
    topicProfile.compareBoard?.rows
  )
  const glossaryMarkdown = renderMarkdownTable(
    ['Term', 'Why it matters'],
    topicProfile.glossaryRows
  )
  const mistakeTable = artifact(
    'mistake_radar',
    `Common mistakes in ${topicTitle}`,
    `| Mistake | Why it fails | Better move |\n| --- | --- | --- |\n| ${topicProfile.misconceptions[0]} | The learner loses the mechanism and falls back to labels. | Use one concrete example and point to the exact step or signal that fixes the misunderstanding. |\n| ${topicProfile.misconceptions[1]} | The explanation stops being testable. | Tie the explanation to a real situation in ${subjectTitle || 'the subject'}. |\n| ${topicProfile.misconceptions[2]} | The learner sounds confident without checking the outcome. | End with an observable result or verification step. |`,
    'Compact correction guide'
  )
  const analogyAnchor = artifact(
    'analogy_anchor',
    `Mental model for ${topicTitle}`,
    topicProfile.analogy,
    'Intuition-first anchor'
  )
  const scenarioLab = artifact(
    'scenario_lab',
    `Applied simulation: ${topicTitle}`,
    `## Scenario\n${topicProfile.scenario.setup}\n\n## Your task\n${renderBulletList(topicProfile.scenario.tasks)}\n\n## Success signal\n${topicProfile.scenario.successSignal}`,
    'Real-use-case practice'
  )
  const glossaryBank = artifact(
    'glossary_bank',
    `${topicTitle} terminology bank`,
    glossaryMarkdown,
    'Revision terminology bank'
  )

  switch (learningStyle) {
    case 'Visual':
      return {
        intro: [
          artifact('concept_map', `See ${topicTitle} as a flow`, `\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n\nUse the map to spot setup, mechanism, and outcome.`)
        ],
        support: [
          artifact('compare_board', topicProfile.compareBoard?.title || `System lenses for ${topicTitle}`, compareBoardMarkdown),
          artifact('image_panel', `Field snapshot: ${topicTitle}`, `![${topicTitle} reference](<<IMAGE: ${topicTitle} scientific diagram practical application ${subjectTitle || ''}>>)\n\nUse the image to connect the explanation to a real structure, device, environment, or measurable signal.`),
          scenarioLab
        ],
        worked: [mistakeTable, analogyAnchor],
        recap: [
          artifact('practice_board', `Visual review cues for ${topicTitle}`, renderBulletList([
            `Which concrete part of ${topicTitle} comes first?`,
            `What changes in the middle of ${topicTitle}?`,
            `What observable outcome proves the concept worked?`,
            `Which visual cue would help you explain ${topicTitle} tomorrow?`
          ]))
        ]
      }
    case 'Auditory':
      return {
        intro: [
          artifact(
            'voice_script',
            `Podcast episode for ${topicTitle}`,
            auditoryPodcastScript,
            'Main audio lesson script'
          )
        ],
        support: [
          artifact('compare_board', `Podcast chapter pivots for ${topicTitle}`, `| Spoken move | Why it works |\n| --- | --- |\n| Name the live parts first: ${spokenAnchorList} | This gives the listener something concrete to follow right away. |\n| Explain the mechanism in order: ${topicProfile.processSteps[1]} | This keeps the episode causal instead of sounding like a definition dump. |\n| End with the observable consequence: ${topicProfile.observationSignals[0]} | This gives the episode a clear payoff the listener can remember. |`),
          scenarioLab
        ],
        worked: [
          artifact('practice_board', `Spoken rehearsal prompts for ${topicTitle}`, renderBulletList([
            `Explain ${topicTitle} in one breath using ${spokenAnchorPairText}.`,
            'Give the analogy without rereading.',
            `Correct this misunderstanding aloud: ${topicProfile.misconceptions[0]}`,
            `End with the consequence or payoff you would observe in ${subjectTitle || 'the subject'}.`
          ])),
          mistakeTable,
          analogyAnchor
        ],
        recap: [
          artifact('note_sheet', `Voice-note recap of ${topicTitle}`, `> ${topicTitle} is worth remembering because it lets you explain ${sentenceCase(topicProfile.processSteps[0], topicTitle)}, ${sentenceCase(topicProfile.processSteps[1], 'the mechanism')}, and ${sentenceCase(topicProfile.processSteps[2], 'the observable result')} without falling back to vague labels.`)
        ]
      }
    case 'Kinesthetic':
      return {
        intro: [
          artifact('action_lab', `Do-this-now setup for ${topicTitle}`, topicProfile.handsOnActions.map((item, index) => `${index + 1}. ${item}`).join('\n'))
        ],
        support: [
          artifact('compare_board', topicProfile.compareBoard?.title || `Manipulate the live parts of ${topicTitle}`, compareBoardMarkdown),
          scenarioLab
        ],
        worked: [mistakeTable, analogyAnchor],
        recap: [
          artifact('capability_checklist', `Capability checklist for ${topicTitle}`, topicProfile.capabilityChecklist.map((item) => `- [ ] ${item}`).join('\n'))
        ]
      }
    case 'Project-based':
      return {
        intro: [
          artifact('project_brief', `Milestone brief for ${topicTitle}`, `## Milestone\nBuild the smallest useful artifact that proves ${topicTitle} is working.\n\n## Constraint\nDo not expand scope until the learner can show visible evidence.\n\n## Success criteria\n- The concept is applied to a concrete output.\n- The output can be inspected or tested.\n- The learner can justify why this milestone matters.`)
        ],
        support: [
          artifact('compare_board', `Milestone tradeoffs in ${topicTitle}`, `| Build move | Immediate upside | Project risk |\n| --- | --- | --- |\n| Prototype around ${anchorOrFallback(topicProfile, 0, topicTitle)} first | Fast signal on whether the core interface works | May ignore downstream constraints |\n| Expand across ${spokenAnchorPairText} | Richer proof and broader coverage | More variables can hide the core lesson |\n| Stay at theory level only | Faster to write up | No visible evidence or engineering confidence |`),
          scenarioLab
        ],
        worked: [
          codeTopic
            ? artifact('code_lab', `Implementation sketch for ${topicTitle}`, '')
            : mistakeTable,
          analogyAnchor
        ],
        recap: [
          artifact('capability_checklist', `Retrospective checklist for ${topicTitle}`, `- [ ] I can name the milestone.\n- [ ] I can explain the smallest artifact that proves progress.\n- [ ] I can justify one tradeoff.\n- [ ] I know the next refinement step.`)
        ]
      }
    case 'Reading/Writing':
    default:
      return {
        intro: [
          artifact('note_sheet', `Revision notes for ${topicTitle}`, `## Definition\n${topicTitle} is best understood as ${description.toLowerCase()}.\n\n## Why it matters\nIt gives the learner a stable way to explain and apply the idea.\n\n## Use case\nTie it to one realistic example in ${subjectTitle || 'the subject'}.`)
        ],
        support: [
          artifact('compare_board', `Definition vs operating logic in ${topicTitle}`, `| Writing lens | Strong answer |\n| --- | --- |\n| What is it? | A concise definition using real topic parts such as ${spokenAnchorPairText} |\n| How does it work? | ${topicProfile.processSteps[1]} |\n| What proves it matters? | A measurable consequence, design implication, or application you can actually observe |`),
          glossaryBank
        ],
        worked: [
          artifact('practice_board', `Written recall prompts for ${topicTitle}`, `1. Define ${topicTitle} without copying and use at least two concrete topic terms.\n2. Explain the mechanism in three sentences.\n3. Walk through this example: ${topicProfile.workedExample}\n4. Name one misconception and correct it.`),
          mistakeTable,
          scenarioLab
        ],
        recap: [
          artifact('checklist', `Revision checklist for ${topicTitle}`, `- [ ] Definition is clear.\n- [ ] Mechanism is explained.\n- [ ] Example is concrete.\n- [ ] Misconception is corrected.\n- [ ] Review prompt is answerable without rereading.`)
        ]
      }
  }
}

function buildWorkedExampleInteraction({ learningStyle, topicTitle, codeTopic, codeSnippet, inferredLanguage, topicProfile }) {
  if (learningStyle === 'Visual') {
    return {
      type: 'categorize',
        title: 'Sort the example into the right visual lanes',
        instructions: `Place each part of the ${topicTitle} example into structure, operating move, or visible consequence.`,
        categories: [
          { id: 'structure', label: 'Structure or interface', description: 'The real part, layer, or component you can point to' },
          { id: 'operation', label: 'Operating move', description: 'The transfer, change, or control logic that makes the concept work' },
          { id: 'consequence', label: 'Visible consequence', description: 'The result, signal, or behavior that proves the explanation holds' }
        ],
        items: [
          { id: 'part', label: topicProfile.concreteElements[0] || `Core structure inside ${topicTitle}`, category: 'structure' },
          { id: 'change', label: topicProfile.processSteps[1] || 'Key operating move', category: 'operation' },
          { id: 'result', label: topicProfile.observationSignals[0] || 'Observable takeaway', category: 'consequence' }
        ],
      successMessage: `You rebuilt the example structure for ${topicTitle}.`
    }
  }

  if (learningStyle === 'Auditory') {
      return {
        type: 'retrieval_grid',
      title: 'Speak the example back',
      instructions: 'Say the answer aloud before revealing the exemplar.',
      prompts: [
        {
          id: 'example',
          label: `Explain one concrete example of ${topicTitle}.`,
            answer: `Name the real parts first, then explain how ${anchorOrFallback(topicProfile, 1, 'the key signal or mechanism')} changes the system, then end with the measurable consequence that proves ${topicTitle} was understood.`
        },
        {
          id: 'analogy',
          label: 'State the analogy in plain English.',
          answer: topicProfile.analogy
        }
      ]
    }
  }

  if (learningStyle === 'Reading/Writing') {
    return {
      type: 'decision',
      title: 'Choose the strongest written example',
      instructions: `Pick the example structure that would make the clearest written explanation of ${topicTitle}.`,
      options: [
        {
          id: 'concrete',
          label: 'Use one concrete case, explain the mechanism, then state the consequence.',
          isCorrect: true,
          feedback: 'That gives the learner a reference-quality example instead of a vague paragraph.'
        },
        {
          id: 'abstract',
          label: 'Stay abstract and avoid examples so the explanation sounds formal.',
          isCorrect: false,
          feedback: 'Formal wording without an example usually makes revision harder.'
        }
      ],
      successMessage: 'Correct. A clear written example needs both mechanism and consequence.'
    }
  }

  if (learningStyle === 'Kinesthetic') {
    return {
      type: 'sequence',
      title: 'Order the worked-example moves',
      instructions: `Arrange the example steps for ${topicTitle} in the order you would perform or inspect them.`,
      items: [
        { id: 'start', label: topicProfile.concreteElements[0] || `Identify the live parts inside ${topicTitle}` },
        { id: 'apply', label: topicProfile.processSteps[1] || 'Apply or describe the key action' },
        { id: 'check', label: topicProfile.observationSignals[0] || 'Inspect the result and explain why it happened' }
      ],
      solutionOrder: ['start', 'apply', 'check'],
      successMessage: 'You sequenced the worked example correctly.'
    }
  }

  if (learningStyle === 'Project-based' && codeTopic) {
    return {
      type: 'code_session',
      title: 'Inspect the milestone implementation',
      instructions: `Read the starter implementation and explain how it creates visible proof for ${topicTitle}.`,
      language: codeSnippet.language,
      starterCode: codeSnippet.starterCode,
      tasks: [
        `Explain what the current implementation proves about ${topicTitle}.`,
        'Name one refinement you would postpone until after the milestone is validated.'
      ],
      checkpoints: [
        {
          id: 'proof',
          prompt: 'Why is the implementation intentionally small?',
          answer: 'Because project work needs the fastest possible artifact that still proves the concept is working.'
        },
        {
          id: 'output',
          prompt: 'What output would you expect?',
          answer: `The code should produce or expose ${codeSnippet.expectedOutput}, which keeps the example focused on the milestone rather than extra complexity.`
        }
      ],
      solutionCode: codeSnippet.solutionCode,
      mentorNotes: [
        'This is a milestone artifact, not a production system.',
        `Keep the proof small until the concept is validated, and keep the syntax in ${inferredLanguage.displayName}.`
      ],
      successMessage: 'You inspected the milestone implementation correctly.'
    }
  }

  if (learningStyle === 'Project-based') {
    return {
      type: 'sequence',
      title: 'Order the milestone work',
      instructions: `Arrange the milestone steps for ${topicTitle} from proof idea to visible outcome.`,
      items: [
        { id: 'goal', label: `State what ${topicTitle} needs to prove` },
        { id: 'artifact', label: 'Build the smallest artifact that proves it' },
        { id: 'review', label: 'Inspect the outcome and decide the next refinement' }
      ],
      solutionOrder: ['goal', 'artifact', 'review'],
      successMessage: 'You ordered the project milestone well.'
    }
  }

  return null
}

function buildSelfCheckInteraction({ learningStyle, topicTitle, topicProfile }) {
  switch (learningStyle) {
    case 'Visual':
      return {
        type: 'decision',
        title: 'Pick the best visual takeaway',
        instructions: `Choose the statement that matches the map of ${topicTitle}.`,
        options: [
          {
            id: 'flow',
              label: `The concept becomes clear when you can track ${anchorOrFallback(topicProfile, 0, 'the structure')}, ${anchorOrFallback(topicProfile, 1, 'the operating move')}, and the visible consequence together.`,
            isCorrect: true,
            feedback: 'That matches the visual sequence you studied.'
          },
          {
            id: 'decoration',
            label: 'The visual is decorative rather than explanatory.',
            isCorrect: false,
            feedback: 'In a strong visual tutorial, the diagram carries real teaching weight.'
          }
        ],
        successMessage: 'Correct. The visual tells the teaching story.'
      }
    case 'Auditory':
      return {
        type: 'decision',
        title: 'Choose the best follow-up prompt',
        instructions: 'Pick the prompt that keeps the learner speaking rather than passively listening.',
        options: (() => {
          const spokenAnchorPair = selectHighSignalAnchorTerms({ topicTitle }, { profile: topicProfile, limit: 2 })
          const spokenAnchorPairText = joinAnchorsWithAnd(spokenAnchorPair, topicTitle)

          return [
            {
              id: 'echo',
              label: `Ask the learner to explain ${topicTitle} back using ${spokenAnchorPairText} in one spoken sentence.`,
              isCorrect: true,
              feedback: 'That reinforces the auditory loop and checks understanding.'
            },
            {
              id: 'read',
              label: 'Ask the learner to reread the full lesson silently.',
              isCorrect: false,
              feedback: 'Silent rereading is not the strongest move for this style.'
            }
          ]
        })(),
        successMessage: 'Correct. Auditory review should keep the learner talking.'
      }
    case 'Kinesthetic':
      return {
        type: 'decision',
        title: 'Pick the best next action',
        instructions: 'Choose the move that turns understanding into action.',
        options: [
          {
            id: 'predict',
              label: `Predict how ${anchorOrFallback(topicProfile, 1, 'the key mechanism')} will change the system before checking the response.`,
            isCorrect: true,
            feedback: 'Prediction creates a real action-feedback loop.'
          },
          {
            id: 'memorize',
            label: 'Memorize the definition without testing it.',
            isCorrect: false,
            feedback: 'This style needs action and feedback, not just recall.'
          }
        ],
        successMessage: 'Correct. Action-first review keeps the concept usable.'
      }
    case 'Project-based':
      return {
        type: 'decision',
        title: 'Choose the strongest project checkpoint',
        instructions: 'Pick the checkpoint that creates visible proof.',
        options: [
          {
            id: 'artifact',
            label: `Create an artifact that proves ${topicTitle} works.`,
            isCorrect: true,
            feedback: 'That is the right standard for project progress.'
          },
          {
            id: 'notes',
            label: 'Collect more theory without producing evidence.',
            isCorrect: false,
            feedback: 'Project learning still needs proof, not just notes.'
          }
        ],
        successMessage: 'Correct. The checkpoint must create evidence.'
      }
    case 'Reading/Writing':
    default:
      return {
        type: 'retrieval_grid',
        title: 'Run a written self-check',
        instructions: 'Answer in your own words before revealing the exemplar.',
        prompts: [
          {
            id: 'importance',
            label: `Why does ${topicTitle} matter?`,
            answer: `It matters because it lets you reason about ${joinAnchorsWithAnd(selectHighSignalAnchorTerms({ topicTitle }, { profile: topicProfile, limit: 2 }), topicTitle)} in a way that is specific enough to analyze, test, or design around.`
          },
          {
            id: 'mistake',
            label: 'Name one common mistake.',
            answer: topicProfile.misconceptions[0]
          }
        ]
      }
  }
}

function buildBlocks({
  learningStyle,
  topicTitle,
  subjectTitle,
  description,
  recipe,
  mermaidCode,
  codeTopic,
  codeSnippet,
  inferredLanguage,
  topicProfile
}) {
  const artifacts = buildArtifactSet({
    learningStyle,
    topicTitle,
    subjectTitle,
    description,
    mermaidCode,
    codeTopic,
    topicProfile
  })
  const auditoryDialogueChapter = learningStyle === 'Auditory'
    ? buildAuditoryDialogueChapter({
      topicTitle,
      subjectTitle,
      topicProfile,
      spokenAnchors: selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 3 })
    })
    : ''
  if (learningStyle === 'Project-based' && codeTopic && artifacts.worked[0]?.type === 'code_lab') {
    artifacts.worked[0] = artifact(
      'code_lab',
      `Implementation sketch for ${topicTitle}`,
      `\`\`\`${codeSnippet.language}\n${codeSnippet.starterCode}\n\`\`\`\n\nThis sketch uses ${inferredLanguage.displayName} so the artifact matches the lesson instead of falling back to a generic language.`,
      'Language-matched code artifact'
    )
  }
  const workedInteraction = buildWorkedExampleInteraction({ learningStyle, topicTitle, codeTopic, codeSnippet, inferredLanguage, topicProfile })
  const selfCheckInteraction = buildSelfCheckInteraction({ learningStyle, topicTitle, topicProfile })

  const styleBlock = (() => {
    switch (learningStyle) {
      case 'Visual':
        return {
          type: 'visual_explainer',
          title: `Rebuild the visual story of ${topicTitle}`,
          body: `Use the flow to see what comes first, what changes, and what outcome you should notice.`,
          markdown: 'Study the diagram first. If you cannot narrate the flow in order, the concept is still too fuzzy.',
          diagramCode: mermaidCode,
          diagramCaption: `Visual map of ${topicTitle}`,
          artifacts: artifacts.support,
          interaction: {
            type: 'sequence',
            title: 'Put the visual steps in order',
            instructions: `Arrange the flow for ${topicTitle} so the visual story makes sense.`,
            items: [
              { id: 'setup', label: `Starting point for ${topicTitle}` },
              { id: 'mechanism', label: 'Key mechanism or transformation' },
              { id: 'outcome', label: 'Outcome or decision you should notice' }
            ],
            solutionOrder: ['setup', 'mechanism', 'outcome'],
            successMessage: `You rebuilt the main visual flow for ${topicTitle}.`
          }
        }
      case 'Auditory':
        return {
          type: 'dialogue_segment',
          title: `Guide the explanation of ${topicTitle}`,
          body: `This chapter checkpoint turns the main podcast into a shorter explain-it-back exchange focused on concrete parts, mechanism, and result.`,
          markdown: auditoryDialogueChapter,
          artifacts: artifacts.support,
          interaction: {
            type: 'decision',
            title: 'Choose the best tutor response',
            instructions: 'Pick the line that keeps the lesson speakable and precise.',
            options: [
              {
                id: 'plain',
                label: `Restate ${topicTitle} in plain English and ask the learner to say it back.`,
                isCorrect: true,
                feedback: 'That creates the auditory loop this style depends on.'
              },
              {
                id: 'lecture',
                label: 'Keep talking without pausing for learner recall.',
                isCorrect: false,
                feedback: 'Auditory learners need conversational checkpoints, not uninterrupted lecture.'
              }
            ],
            successMessage: 'Correct. The tutor should create a response loop, not a monologue.'
          }
        }
      case 'Kinesthetic':
        return {
          type: 'micro_activity',
          title: `Move the parts of ${topicTitle}`,
          body: `Treat ${topicTitle} like a system you can sort, inspect, and verify using the real parts of the topic.`,
          markdown: `The goal is momentum: do something, predict something, then check something. Focus on ${topicProfile.concreteElements.join('; ')}.`,
          artifacts: artifacts.support,
          interaction: {
            type: 'categorize',
            title: 'Place the parts into the right buckets',
            instructions: `Sort the pieces of ${topicTitle} into starting state, mechanism action, or observable result.`,
            categories: [
              { id: 'input', label: 'Starting state', description: 'What exists before the mechanism acts' },
              { id: 'action', label: 'Mechanism action', description: 'What changes, forwards, transforms, or decides' },
              { id: 'output', label: 'Observable result', description: 'What you inspect at the end to verify understanding' }
            ],
            items: [
              { id: 'context', label: topicProfile.concreteElements[0] || `Starting state for ${topicTitle}`, category: 'input' },
              { id: 'mechanism', label: topicProfile.processSteps[1] || 'Key action or transformation', category: 'action' },
              { id: 'result', label: topicProfile.observationSignals[0] || 'Observable result', category: 'output' }
            ],
            successMessage: `You sorted the moving parts of ${topicTitle}.`
          }
        }
      case 'Project-based':
        return {
          type: 'mini_project_step',
          title: `Define the next milestone for ${topicTitle}`,
          body: 'Treat the lesson as a build step with visible proof.',
          markdown: 'A strong milestone is small enough to validate quickly but concrete enough to inspect.',
          artifacts: artifacts.support,
          interaction: {
            type: 'decision',
            title: 'Choose the strongest milestone move',
            instructions: 'Pick the action that creates evidence without inflating scope.',
            options: [
              {
                id: 'small-proof',
                label: `Build the smallest artifact that proves ${topicTitle} is working.`,
                isCorrect: true,
                feedback: 'That keeps the learner focused on validation.'
              },
              {
                id: 'expand',
                label: 'Broaden the scope before proving the concept.',
                isCorrect: false,
                feedback: 'Scope should expand only after the milestone has evidence.'
              }
            ],
            successMessage: 'Correct. Milestone-first thinking keeps project learning honest.'
          }
        }
      case 'Reading/Writing':
      default:
        return {
          type: 'guided_notes',
          title: `Build clear study notes for ${topicTitle}`,
          body: 'Separate definition, mechanism, example, and consequence so the notes stay useful later.',
          markdown: `Good notes for ${topicTitle} should be precise enough to revise from and short enough to scan quickly.`,
          artifacts: artifacts.support,
          interaction: {
            type: 'retrieval_grid',
            title: 'Complete the study sheet',
            instructions: `Write the core notes for ${topicTitle} before revealing the exemplar.`,
            prompts: [
              {
                id: 'definition',
                label: 'Definition',
                  answer: `${topicTitle} is best understood by naming the real structures, interfaces, or signals involved and the job they perform in context.`
              },
              {
                id: 'mechanism',
                label: 'Mechanism',
                  answer: topicProfile.processSteps[1] || 'Explain the sequence that turns the concept from a label into a working mechanism.'
              }
            ]
          }
        }
    }
  })()

  const reflectionBlock = learningStyle === 'Project-based'
    ? {
      type: 'reflection_prompt',
      title: 'Inspect the tradeoff',
      body: `Decide whether your current plan for ${topicTitle} is proving progress or only adding scope.`,
      markdown: 'Strong project reflection names the tradeoff explicitly: what are you gaining, what are you risking, and what evidence do you still need?',
      interaction: {
        type: 'categorize',
        title: 'Sort milestone statements by purpose',
        instructions: 'Place each statement into proof, scope, or risk.',
        categories: [
          { id: 'proof', label: 'Proof', description: 'Creates visible validation' },
          { id: 'scope', label: 'Scope', description: 'Expands the work' },
          { id: 'risk', label: 'Risk', description: 'Could slow or weaken the milestone' }
        ],
        items: [
          { id: 'demo', label: 'Build a small demo artifact', category: 'proof' },
          { id: 'rewrite', label: 'Rewrite adjacent systems before validating', category: 'scope' },
          { id: 'unknown', label: 'Skip testing and assume the concept works', category: 'risk' }
        ],
        successMessage: 'You sorted the tradeoff statements correctly.'
      }
    }
    : {
      type: 'reflection_prompt',
      title: 'Pause and explain what feels stable',
      body: `Name what part of ${topicTitle} now feels clear and what still needs one more example.`,
      prompt: `If you had to teach ${topicTitle} tomorrow, which concrete part would you trust yourself to explain first: ${joinAnchors(selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 3 }), topicTitle)}?`
    }

  return [
    {
      type: 'lesson_intro',
      title: `Start with the core idea of ${topicTitle}`,
      body: `${topicProfile.plainDefinition || description} ${topicProfile.whyItMatters || ''} Pay attention to ${topicProfile.concreteElements.join(', ')} as you move through the lesson.`,
      markdown: `This lesson uses the **${recipe.id}** learning style. That means the content is organized around ${recipe.shortDescription.toLowerCase()}\n\n## Concrete focus\n${renderBulletList(topicProfile.concreteElements)}`,
      callout: recipe.preview,
      artifacts: artifacts.intro
    },
    styleBlock,
    {
      type: 'concept_walkthrough',
      title: `Build the mechanism of ${topicTitle}`,
      body: 'Move from definition to mechanism to consequence so the topic becomes explainable instead of fragile.',
      markdown: `## Theory in plain terms\n${renderBulletList(topicProfile.processSteps)}\n\n## What to focus on\n${renderBulletList(topicProfile.observationSignals)}`,
      items: [
        `Define ${topicTitle} precisely.`,
        topicProfile.processSteps[1] || 'Name the mechanism in order.',
        topicProfile.observationSignals[0] || 'Tie the mechanism to one concrete outcome.',
        recipe.qualityStandards?.[0] || recipe.shortDescription
      ]
    },
    {
      type: 'worked_example',
      title: `Work through one concrete example of ${topicTitle}`,
      body: 'A worked example should make the mechanism visible and show why the outcome follows from it.',
      markdown: topicProfile.workedExample,
      artifacts: artifacts.worked,
      interaction: workedInteraction
    },
    reflectionBlock,
    {
      type: 'self_check',
      title: `Check whether ${topicTitle} is now usable`,
      body: 'Do not ask whether the term feels familiar. Ask whether you can explain, recognize, or apply it.',
      markdown: `A strong self-check for ${topicTitle} should make you reconstruct the concept rather than reread it. Use checks like these:\n\n${renderBulletList(topicProfile.observationSignals)}`,
      interaction: selfCheckInteraction
    },
    {
      type: 'recap',
      title: `Recap ${topicTitle} in a reusable format`,
      body: 'Keep the summary compact enough that you would actually revisit it later.',
      markdown: `The recap should stand on its own as a revision artifact.\n\n${renderBulletList([
        `Definition focus: explain ${topicTitle} with real topic language.`,
        `Mechanism focus: ${topicProfile.processSteps[1] || 'state the key mechanism clearly.'}`,
        `Example focus: ${topicProfile.workedExample}`,
        `Caution: ${topicProfile.misconceptions[0]}`
      ])}`,
      artifacts: artifacts.recap
    },
    {
      type: 'review_bridge',
      title: 'Bridge into review mode',
      body: 'Before moving into review, answer a few recall prompts from memory so the lesson does not stay passive.',
      markdown: `Use the review prompts to recall ${topicProfile.processSteps[0].toLowerCase()} ${topicProfile.processSteps[1].toLowerCase()} and ${topicProfile.processSteps[2].toLowerCase()} without looking back at the lesson.`
    }
  ]
}

export function buildFallbackTutorialBundle({
  learningStyle,
  topicTitle,
  topicDescription,
  subjectTitle
}) {
  const recipe = getLearningStyleRecipe(learningStyle)
  const description = String(topicDescription || `Learn the essentials of ${topicTitle}.`).trim()
  const topicProfile = buildTopicSignalProfile({
    subjectTitle,
    topicTitle,
    topicDescription
  })
  const mermaidCode = buildVisualMermaidCode(topicTitle)
  const inferredLanguage = inferCodeLanguage({
    subjectTitle,
    topicTitle,
    topicDescription
  })
  const codeSnippet = buildFallbackCodeSnippet({
    topicTitle,
    languageId: inferredLanguage.id
  })
  const codeTopic = isCodeTopicContext({
    subjectTitle,
    topicTitle,
    topicDescription
  })

  return {
    tutorialMarkdown: buildTutorialMarkdown({
      learningStyle,
      topicTitle,
      subjectTitle,
      description,
      mermaidCode,
      codeTopic,
      codeSnippet,
      inferredLanguage,
      topicProfile
    }),
    tutorialBlocks: buildBlocks({
      learningStyle,
      topicTitle,
      subjectTitle,
      description,
      recipe,
      mermaidCode,
      codeTopic,
      codeSnippet,
      inferredLanguage,
      topicProfile
    }),
    flashcards: [
      {
        front: `Explain ${topicTitle} without using the original definition.`,
        back: `Use real topic language such as ${joinAnchors(selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 3 }), topicTitle)}. Then describe the mechanism in order and end with the outcome that proves the concept works.`
      },
      {
        front: `Why does ${topicTitle} matter in ${subjectTitle || 'the subject'}?`,
        back: `It matters because it changes how you interpret, apply, or validate real situations in ${subjectTitle || 'the subject'}, especially when you need to reason about ${joinAnchorsWithAnd(selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 2 }), topicTitle)}.`
      },
      {
        front: `What is one common mistake learners make with ${topicTitle}?`,
        back: topicProfile.misconceptions[0]
      }
    ],
    chatStarters: [
      `Quiz me on ${topicTitle} using my ${learningStyle} style.`,
      `Explain ${topicTitle} with another example because I still feel weak on ${joinAnchorsWithAnd(selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 2 }), topicTitle)}.`,
      `What is the most common mistake people make with ${topicTitle}, and how would you correct it using a concrete example?`
    ],
    reviewPrompts: [
      `State the setup, mechanism, and outcome of ${topicTitle} from memory using ${joinAnchorsWithAnd(selectHighSignalAnchorTerms({ subjectTitle, topicTitle, topicDescription: description }, { profile: topicProfile, limit: 2 }), topicTitle)}.`,
      `Give one concrete example of ${topicTitle} and explain why it works: ${topicProfile.workedExample}`,
      `Name one misconception about ${topicTitle} and correct it: ${topicProfile.misconceptions[0]}`
    ]
  }
}
