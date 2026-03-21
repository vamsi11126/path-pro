'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  MessageSquareQuote,
  PencilLine,
  Route,
  Sparkles,
  Target
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import TutorialInteraction from '@/components/tutorial/TutorialInteraction'
import AuditoryVoicePlayer from '@/components/tutorial/AuditoryVoicePlayer'
import CodeBlock, { MermaidDiagram } from '@/components/sub-components/CodeBlock'
import MarkdownComponents from '@/components/sub-components/MarkdownComponents'
import { sanitizeLatex } from '@/lib/latexToUnicode'
import { getLearningStyleRecipe } from '@/lib/learning-styles/recipes'

const blockMeta = {
  lesson_intro: { icon: Target, accent: 'from-sky-500/20 via-sky-500/5 to-transparent', label: 'Lesson Intro' },
  concept_walkthrough: { icon: BookOpen, accent: 'from-primary/20 via-primary/5 to-transparent', label: 'Concept Walkthrough' },
  visual_explainer: { icon: Sparkles, accent: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent', label: 'Visual Explainer' },
  dialogue_segment: { icon: MessageSquareQuote, accent: 'from-amber-500/20 via-amber-500/5 to-transparent', label: 'Tutor Dialogue' },
  guided_notes: { icon: PencilLine, accent: 'from-emerald-500/20 via-emerald-500/5 to-transparent', label: 'Guided Notes' },
  worked_example: { icon: Lightbulb, accent: 'from-orange-500/20 via-orange-500/5 to-transparent', label: 'Worked Example' },
  micro_activity: { icon: ClipboardCheck, accent: 'from-lime-500/20 via-lime-500/5 to-transparent', label: 'Micro Activity' },
  mini_project_step: { icon: Route, accent: 'from-violet-500/20 via-violet-500/5 to-transparent', label: 'Project Step' },
  reflection_prompt: { icon: Brain, accent: 'from-rose-500/20 via-rose-500/5 to-transparent', label: 'Reflection Prompt' },
  self_check: { icon: CheckCircle2, accent: 'from-teal-500/20 via-teal-500/5 to-transparent', label: 'Self Check' },
  review_bridge: { icon: Route, accent: 'from-cyan-500/20 via-cyan-500/5 to-transparent', label: 'Review Bridge' },
  recap: { icon: Sparkles, accent: 'from-primary/25 via-primary/10 to-transparent', label: 'Recap' }
}

const artifactMeta = {
  concept_map: { icon: Sparkles, label: 'Concept Map', accent: 'border-fuchsia-500/20 bg-fuchsia-500/5' },
  compare_board: { icon: BookOpen, label: 'Compare Board', accent: 'border-sky-500/20 bg-sky-500/5' },
  image_panel: { icon: Sparkles, label: 'Image Panel', accent: 'border-cyan-500/20 bg-cyan-500/5' },
  voice_script: { icon: MessageSquareQuote, label: 'Voice Script', accent: 'border-amber-500/20 bg-amber-500/5' },
  note_sheet: { icon: PencilLine, label: 'Note Sheet', accent: 'border-emerald-500/20 bg-emerald-500/5' },
  action_lab: { icon: ClipboardCheck, label: 'Action Lab', accent: 'border-lime-500/20 bg-lime-500/5' },
  project_brief: { icon: Route, label: 'Project Brief', accent: 'border-violet-500/20 bg-violet-500/5' },
  code_lab: { icon: Lightbulb, label: 'Code Lab', accent: 'border-orange-500/20 bg-orange-500/5' },
  mistake_radar: { icon: Brain, label: 'Mistake Radar', accent: 'border-rose-500/20 bg-rose-500/5' },
  practice_board: { icon: CheckCircle2, label: 'Practice Board', accent: 'border-teal-500/20 bg-teal-500/5' },
  capability_checklist: { icon: CheckCircle2, label: 'Capability Checklist', accent: 'border-primary/20 bg-primary/5' },
  checklist: { icon: CheckCircle2, label: 'Checklist', accent: 'border-primary/20 bg-primary/5' },
  analogy_anchor: { icon: Sparkles, label: 'Analogy Anchor', accent: 'border-indigo-500/20 bg-indigo-500/5' },
  scenario_lab: { icon: Route, label: 'Scenario Lab', accent: 'border-cyan-500/20 bg-cyan-500/5' },
  glossary_bank: { icon: PencilLine, label: 'Glossary Bank', accent: 'border-emerald-500/20 bg-emerald-500/5' }
}

const stylePresentation = {
  Visual: {
    icon: Sparkles,
    panel: 'from-sky-500/15 via-cyan-500/10 to-background',
    border: 'border-sky-500/20',
    highlight: 'Visual-first lesson studio',
    cueLabel: 'Pattern cues'
  },
  Auditory: {
    icon: MessageSquareQuote,
    panel: 'from-amber-500/15 via-orange-500/10 to-background',
    border: 'border-amber-500/20',
    highlight: 'Podcast-led lesson studio',
    cueLabel: 'Audio cues'
  },
  'Reading/Writing': {
    icon: PencilLine,
    panel: 'from-emerald-500/15 via-teal-500/10 to-background',
    border: 'border-emerald-500/20',
    highlight: 'Study-sheet lesson studio',
    cueLabel: 'Revision cues'
  },
  Kinesthetic: {
    icon: ClipboardCheck,
    panel: 'from-lime-500/15 via-green-500/10 to-background',
    border: 'border-lime-500/20',
    highlight: 'Hands-on lesson studio',
    cueLabel: 'Action cues'
  },
  'Project-based': {
    icon: Route,
    panel: 'from-violet-500/15 via-fuchsia-500/10 to-background',
    border: 'border-violet-500/20',
    highlight: 'Milestone-driven lesson studio',
    cueLabel: 'Milestone cues'
  }
}

const tutorialMarkdownComponents = {
  ...MarkdownComponents,
  h1: ({ node, ...props }) => (
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-10 border-b border-white/10 pb-3 text-2xl font-semibold tracking-tight text-foreground md:text-[2rem]" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-7 text-lg font-semibold tracking-tight text-foreground md:text-xl" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-4 text-[15px] leading-8 text-muted-foreground md:text-base" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="my-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:text-primary" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-4 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:text-primary" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="pl-1 [&>p]:!my-0 [&>p]:!inline" {...props}>
      {props.children}
    </li>
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-6 rounded-2xl border border-primary/15 bg-primary/[0.05] px-5 py-4 text-base italic leading-7 text-foreground/85" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-white/10 bg-background/60">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/85" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border-b border-white/5 px-4 py-3 text-sm leading-7 text-muted-foreground align-top" {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-8 border-white/10" {...props} />
  )
}

const compactMarkdownComponents = {
  ...tutorialMarkdownComponents,
  h1: ({ node, ...props }) => (
    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-6 border-b border-white/8 pb-2 text-xl font-semibold tracking-tight text-foreground" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-3 text-sm leading-7 text-muted-foreground" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-muted-foreground marker:text-primary" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-muted-foreground marker:text-primary" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-4 rounded-xl border border-primary/10 bg-primary/[0.04] px-4 py-3 text-sm italic leading-7 text-foreground/85" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border-b border-white/5 px-3 py-2 text-sm leading-6 text-muted-foreground align-top" {...props} />
  )
}

function normalizeValue(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(normalizeValue).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    const preferredKeys = ['title', 'label', 'text', 'answer', 'question', 'body', 'content', 'description']
    for (const key of preferredKeys) {
      if (value[key]) return normalizeValue(value[key])
    }
    return Object.values(value).map(normalizeValue).filter(Boolean).join(' ')
  }
  return ''
}

function normalizeComparableText(value) {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return []
  return items.map(normalizeValue).filter(Boolean)
}

function extractMermaidContent(content = '') {
  const normalized = String(content || '').trim()
  if (!normalized) {
    return { diagramCode: '', markdown: '' }
  }

  const fencedMatch = normalized.match(/```mermaid\s*([\s\S]*?)```/i)
  if (fencedMatch) {
    return {
      diagramCode: fencedMatch[1].trim(),
      markdown: normalized.replace(fencedMatch[0], '').trim()
    }
  }

  const looksLikeMermaid = /^(mermaid\s*\n|%%title:|%%desc:|flowchart\b|graph\b|sequenceDiagram\b|classDiagram\b|erDiagram\b|journey\b|timeline\b|gantt\b|pie\b|mindmap\b)/i.test(normalized)
  if (!looksLikeMermaid) {
    return { diagramCode: '', markdown: normalized }
  }

  const parts = normalized.split(/\n\s*\n/)
  const [firstChunk, ...rest] = parts
  const cleanedCode = firstChunk.replace(/^mermaid\s*\n/i, '').trim()

  if (!/(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|journey|timeline|gantt|pie|mindmap)/i.test(cleanedCode)) {
    return { diagramCode: '', markdown: normalized }
  }

  return {
    diagramCode: cleanedCode,
    markdown: rest.join('\n\n').trim()
  }
}

function hasSpeakerTurns(content = '') {
  const normalized = String(content || '').replace(/\r/g, '').replace(/^>\s?/gm, '')
  const turnCount = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-z][A-Za-z\s/-]{1,30}:\s*\S+/.test(line))
    .length

  return turnCount > 1
}

function isRepeatedScript(candidate = '', againstEntries = []) {
  const normalizedCandidate = normalizeComparableText(candidate)
  if (!normalizedCandidate || normalizedCandidate.length < 80) {
    return false
  }

  return againstEntries.some((entry) => {
    const normalizedEntry = normalizeComparableText(entry)
    if (!normalizedEntry || normalizedEntry.length < 80) {
      return false
    }

    return normalizedEntry === normalizedCandidate
      || normalizedEntry.includes(normalizedCandidate)
      || normalizedCandidate.includes(normalizedEntry)
  })
}

function buildAuditoryPodcastEpisode(tutorial) {
  const blocks = Array.isArray(tutorial?.tutorialBlocks) ? tutorial.tutorialBlocks : []
  const candidates = []

  blocks.forEach((block, blockIndex) => {
    if (block?.type === 'dialogue_segment' && hasSpeakerTurns(block?.markdown)) {
      candidates.push({
        title: normalizeValue(block?.title) || 'Podcast chapter',
        content: String(block?.markdown || '').trim(),
        blockIndex,
        priority: 2
      })
    }

    const artifacts = Array.isArray(block?.artifacts) ? block.artifacts : []
    artifacts.forEach((artifact, artifactIndex) => {
      if (artifact?.type !== 'voice_script' || !hasSpeakerTurns(artifact?.markdown)) {
        return
      }

      candidates.push({
        title: normalizeValue(artifact?.title) || 'Podcast episode',
        content: String(artifact?.markdown || '').trim(),
        blockIndex,
        artifactIndex,
        priority: 1
      })
    })
  })

  if (candidates.length === 0) {
    return null
  }

  const sortedCandidates = [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority
    }
    return right.content.length - left.content.length
  })

  const primary = sortedCandidates[0]
  const segments = [primary]

  sortedCandidates.slice(1).forEach((entry) => {
    if (isRepeatedScript(entry.content, segments.map((segment) => segment.content))) {
      return
    }

    segments.push(entry)
  })

  const content = segments
    .flatMap((segment, index) => {
      if (index === 0) {
        return [segment.content]
      }

      return [
        `Narrator: Next chapter, ${segment.title}.`,
        segment.content
      ]
    })
    .join('\n\n')
    .trim()

  return {
    title: primary.title,
    content,
    chapterCount: segments.length
  }
}

function RichMarkdown({ content, className = '', compact = false }) {
  const normalized = String(content || '').trim()
  const { diagramCode, markdown } = extractMermaidContent(normalized)

  if (!diagramCode && !markdown) return null

  return (
    <div className={cn('space-y-4', className)}>
      {diagramCode ? (
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-background/70 p-3 md:p-4">
          <MermaidDiagram code={diagramCode} allowAddToNotes={false} />
        </div>
      ) : null}
      {markdown ? (
        <div className="lesson-markdown markdown-content prose prose-slate dark:prose-invert max-w-none break-words prose-headings:scroll-mt-28 prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-8 prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={compact ? compactMarkdownComponents : tutorialMarkdownComponents}>
            {sanitizeLatex(markdown)}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  )
}

function ArtifactCard({ artifact, hideVoicePlayback = false }) {
  const meta = artifactMeta[artifact?.type] || artifactMeta.practice_board
  const Icon = meta.icon
  const title = normalizeValue(artifact?.title) || meta.label
  const description = normalizeValue(artifact?.description)
  const isVoiceScript = artifact?.type === 'voice_script'

  return (
    <div className={cn('overflow-hidden rounded-3xl border p-4 md:p-6', meta.accent)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-background/70">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {meta.label}
          </div>
          <div className="mt-1 break-words text-sm font-semibold text-foreground">{title}</div>
        </div>
      </div>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {isVoiceScript && !hideVoicePlayback ? (
        <AuditoryVoicePlayer
          title={title}
          content={artifact?.markdown}
          className="mt-4"
        />
      ) : null}
      {isVoiceScript && hideVoicePlayback ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-background/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
          This script is included in the podcast player above.
        </div>
      ) : null}
      {!isVoiceScript ? <RichMarkdown content={artifact?.markdown} compact className="mt-4" /> : null}
    </div>
  )
}

function renderItemList(items = []) {
  const normalizedItems = normalizeItems(items)
  if (normalizedItems.length === 0) return null

  return (
    <ul className="mt-4 space-y-2 pl-5 text-sm leading-6 text-muted-foreground marker:text-primary">
      {normalizedItems.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  )
}

function TutorialBlockCard({
  block,
  index,
  suppressVoicePlayback = false,
  hideVoiceScriptArtifacts = false
}) {
  const meta = blockMeta[block?.type] || blockMeta.concept_walkthrough
  const Icon = meta.icon
  const body = normalizeValue(block?.body)
  const prompt = normalizeValue(block?.prompt)
  const callout = normalizeValue(block?.callout)
  const diagramCode = normalizeValue(block?.diagramCode)
  const diagramCaption = normalizeValue(block?.diagramCaption)
  const artifacts = Array.isArray(block?.artifacts) ? block.artifacts.filter(Boolean) : []
  const hasInteraction = Boolean(block?.interaction?.type)
  const usesVoicePlayback = block?.type === 'dialogue_segment' && hasSpeakerTurns(block?.markdown)
  const visibleArtifacts = hideVoiceScriptArtifacts
    ? artifacts.filter((artifact) => artifact?.type !== 'voice_script')
    : artifacts
  const hiddenVoiceScriptCount = hideVoiceScriptArtifacts
    ? artifacts.filter((artifact) => artifact?.type === 'voice_script').length
    : 0

  return (
    <Card className="overflow-hidden border-border/60 bg-background/75 shadow-sm">
      <div className={cn('h-1 w-full bg-gradient-to-r', meta.accent)} />
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px] sm:tracking-[0.22em]">
                Step {String(index + 1).padStart(2, '0')} - {meta.label}
              </div>
              <CardTitle className="mt-1 break-words text-base leading-7 sm:text-lg md:text-xl">
                {normalizeValue(block?.title) || meta.label}
              </CardTitle>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">
              {meta.label}
            </Badge>
            {artifacts.length > 0 ? (
              <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
                {artifacts.length} artifact{artifacts.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
            {hasInteraction ? (
              <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/5 text-emerald-300">
                Interactive
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {body ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground md:text-[15px]">
            {body}
          </p>
        ) : null}
        {!usesVoicePlayback ? (
          <RichMarkdown content={block?.markdown} compact className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 md:px-5" />
        ) : null}
        {usesVoicePlayback && suppressVoicePlayback ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-muted-foreground md:px-5">
            This conversation is included in the podcast player above.
          </div>
        ) : null}
        {renderItemList(block?.items)}
        {diagramCode ? (
          <div className="rounded-3xl border border-white/10 bg-background/60 p-4">
            <CodeBlock className="language-mermaid" allowAddToNotes={false}>
              {diagramCode}
            </CodeBlock>
            {diagramCaption ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{diagramCaption}</p>
            ) : null}
          </div>
        ) : null}
        {prompt ? (
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
              Learner Prompt
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground/85">{prompt}</p>
          </div>
        ) : null}
        {callout ? (
          <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Why This Matters
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{callout}</p>
          </div>
        ) : null}
        {block?.type === 'dialogue_segment' && !suppressVoicePlayback ? (
          <AuditoryVoicePlayer
            title={normalizeValue(block?.title) || meta.label}
            content={block?.markdown || [body, prompt].filter(Boolean).join('\n')}
          />
        ) : null}
        {hiddenVoiceScriptCount > 0 ? (
          <div className="rounded-2xl border border-white/8 bg-background/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
            {hiddenVoiceScriptCount} voice script artifact{hiddenVoiceScriptCount === 1 ? '' : 's'} included in the podcast player above.
          </div>
        ) : null}
        {visibleArtifacts.length > 0 ? (
          <div className="space-y-3">
            {visibleArtifacts.map((entry, artifactIndex) => (
              <ArtifactCard
                key={`${entry?.type || 'artifact'}-${artifactIndex}`}
                artifact={entry}
                hideVoicePlayback={hideVoiceScriptArtifacts}
              />
            ))}
          </div>
        ) : null}
        {hasInteraction ? (
          <TutorialInteraction interaction={block.interaction} blockTitle={normalizeValue(block?.title) || meta.label} />
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function TutorialSessionRenderer({
  tutorial,
  learningStyle,
  mode = 'learn',
  className = ''
}) {
  const blocks = Array.isArray(tutorial?.tutorialBlocks) ? tutorial.tutorialBlocks : []
  const reviewPrompts = normalizeItems(Array.isArray(tutorial?.reviewPrompts) ? tutorial.reviewPrompts : [])
  const interactionCount = blocks.filter((block) => block?.interaction?.type).length
  const artifactCount = blocks.reduce((count, block) => count + (Array.isArray(block?.artifacts) ? block.artifacts.length : 0), 0)
  const markdownLesson = String(tutorial?.tutorialMarkdown || '').trim()
  const recipe = getLearningStyleRecipe(learningStyle)
  const styleMeta = stylePresentation[learningStyle] || stylePresentation['Reading/Writing']
  const StyleIcon = styleMeta.icon
  const auditoryPodcast = learningStyle === 'Auditory' ? buildAuditoryPodcastEpisode(tutorial) : null

  if (!tutorial || (blocks.length === 0 && reviewPrompts.length === 0)) return null

  if (mode === 'review') {
    return (
      <Card className={cn('border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-background', className)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                Style-Aware Review
              </div>
              <CardTitle className="mt-1 text-xl">Recall using your {learningStyle} tutorial cues</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewPrompts.slice(0, 4).map((prompt, index) => (
            <div key={`${prompt}-${index}`} className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Review Prompt {index + 1}
              </div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{prompt}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4 md:space-y-5', className)}>
      <div className={cn('overflow-hidden rounded-[28px] border bg-gradient-to-br shadow-[0_20px_80px_-50px_rgba(59,130,246,0.45)]', styleMeta.panel, styleMeta.border)}>
        <div className="border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">
                  {learningStyle || 'Personalized'} tutorial
                </Badge>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                  {styleMeta.highlight}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/70">
                  <StyleIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                    {recipe.badge}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground md:text-[15px]">
                    {recipe.preview}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:min-w-[280px] lg:w-auto lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-background/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">Blocks</div>
                <div className="mt-2 text-lg font-semibold text-foreground sm:text-2xl">{blocks.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">Artifacts</div>
                <div className="mt-2 text-lg font-semibold text-foreground sm:text-2xl">{artifactCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">Interactions</div>
                <div className="mt-2 text-lg font-semibold text-foreground sm:text-2xl">{interactionCount}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {recipe.engagementMoves.slice(0, 3).map((move, index) => (
              <div key={`${move}-${index}`} className="rounded-2xl border border-white/10 bg-background/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {styleMeta.cueLabel} {index + 1}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{move}</p>
              </div>
            ))}
          </div>
        </div>

        {auditoryPodcast ? (
          <div className="border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-100">
                    Podcast episode
                  </Badge>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                    Audio-first lesson flow
                  </div>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  The auditory lesson is delivered as one continuous episode. Supporting blocks below act as chapter notes, practice, and review instead of repeating the transcript.
                </p>
              </div>
              <div className="w-full sm:w-auto">
                <div className="rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  {auditoryPodcast.chapterCount} chapter{auditoryPodcast.chapterCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <AuditoryVoicePlayer
              title={auditoryPodcast.title}
              content={auditoryPodcast.content}
            />
          </div>
        ) : null}

        {markdownLesson && !auditoryPodcast ? (
          <div className="border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
                Full lesson walkthrough
              </Badge>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Theory, analogy, examples, and review
              </div>
            </div>
            <RichMarkdown content={markdownLesson} className="prose-h2:mt-10 prose-h2:border-t prose-h2:border-white/8 prose-h2:pt-6 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl" />
          </div>
        ) : null}

        <div className="grid gap-3 px-4 py-4 md:px-6 md:py-5">
          {blocks.map((block, index) => (
            <TutorialBlockCard
              key={`${block?.type || 'block'}-${index}`}
              block={block}
              index={index}
              suppressVoicePlayback={Boolean(auditoryPodcast)}
              hideVoiceScriptArtifacts={Boolean(auditoryPodcast)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
