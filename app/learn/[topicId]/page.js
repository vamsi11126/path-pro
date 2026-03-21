'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Check, Clock, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { startLearningSession, completeLearning, logStudyActivity } from '@/lib/actions'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { sanitizeLatex } from '@/lib/latexToUnicode'
import { ThemeToggle } from '@/components/sub-components/theme-toggle'
import Flashcard from '@/components/sub-components/Flashcard'
import DoubtChat from '@/components/sub-components/DoubtChat'
import StickyNoteWidget from '@/components/sub-components/StickyNoteWidget'
import SelectionHighlighter from '@/components/sub-components/SelectionHighlighter'
import TutorialSessionRenderer from '@/components/tutorial/TutorialSessionRenderer'
import { fetchTutorialBundle } from '@/lib/tutorials/client'
import MarkdownComponents from '@/components/sub-components/MarkdownComponents'

const styleTutorialsEnabled = process.env.NEXT_PUBLIC_ENABLE_STYLE_TUTORIALS !== 'false'

export default function LearnPage() {
  const router = useRouter()
  const params = useParams()
  const topicId = params.topicId
  const supabase = createClient()

  const [topic, setTopic] = useState(null)
  const [subject, setSubject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [showFlashcards, setShowFlashcards] = useState(false)
  const [currentCard, setCurrentCard] = useState(0)
  const [flashcards, setFlashcards] = useState([])
  const [isFlipped, setIsFlipped] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tutorial, setTutorial] = useState(null)
  const [tutorialLoading, setTutorialLoading] = useState(false)

  const startTimeRef = useRef(Date.now())
  const sessionLoggedRef = useRef(false)
  const topicIdRef = useRef(topicId)

  useEffect(() => {
    topicIdRef.current = topicId
    startTimeRef.current = Date.now()
    sessionLoggedRef.current = false
  }, [topicId])

  useEffect(() => {
    return () => {
      if (!sessionLoggedRef.current && startTimeRef.current) {
        const duration = (Date.now() - startTimeRef.current) / 60000
        if (duration > 0.05) {
          logStudyActivity(topicIdRef.current, duration)
        }
      }
    }
  }, [])

  const loadTutorial = useCallback(async (targetTopicId = topicId) => {
    if (!styleTutorialsEnabled || !targetTopicId) return

    setTutorialLoading(true)
    try {
      const result = await fetchTutorialBundle({ topicId: targetTopicId })
      if (result?.tutorial) {
        setTutorial(result.tutorial)
      }
      if (Array.isArray(result?.flashcards) && result.flashcards.length > 0) {
        setFlashcards(result.flashcards)
      }
      if (result?.content) {
        setTopic((current) => current ? ({ ...current, content: current.content || result.content }) : current)
      }
    } catch (error) {
      console.error('Tutorial load error:', error)
    } finally {
      setTutorialLoading(false)
    }
  }, [topicId])

  const loadTopicData = useCallback(async () => {
    if (!topicId) return

    try {
      const { data: topicData, error: topicError } = await supabase
        .from('topics')
        .select('*, subjects(*)')
        .eq('id', topicId)
        .single()

      if (topicError) {
        console.error('Error loading topic:', topicError)
        toast.error('Failed to load topic')
        router.push('/dashboard')
        return
      }

      setTopic(topicData)
      setSubject(topicData.subjects)
      setLoading(false)

      if (styleTutorialsEnabled) {
        loadTutorial(topicData.id)
      }

      if (topicData.status === 'available') {
        startLearningSession(topicId).catch((error) => console.error('Start session error:', error))
      }
    } catch (error) {
      console.error('Unexpected error in loadTopicData:', error)
      setLoading(false)
      toast.error(`Could not load topic data: ${error.message || String(error)}`)
    }
  }, [loadTutorial, router, supabase, topicId])

  useEffect(() => {
    loadTopicData()
  }, [loadTopicData])

  useEffect(() => {
    if (!topic) return

    const durationMinutes = topic.estimated_minutes || 5
    const totalSeconds = durationMinutes * 60
    const incrementPerSecond = 100 / totalSeconds

    const timer = setInterval(() => {
      setProgress((previous) => {
        if (previous >= 100) {
          return 100
        }

        return Math.min(previous + incrementPerSecond, 100)
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [topic])

  const handleCompleteLearning = async () => {
    const durationMinutes = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 60000) : 0
    sessionLoggedRef.current = true

    const result = await completeLearning(topicId, durationMinutes)

    if (result.success) {
      toast.success('Topic completed! You can review it tomorrow.')
      router.push(`/subjects/${subject.id}`)
      return
    }

    toast.error('Failed to complete topic')
  }

  const handleRegenerateContent = async () => {
    setGenerating(true)
    try {
      const result = await fetchTutorialBundle({ topicId: topic.id })
      toast.success('Content generated successfully!')
      setTopic((current) => current ? ({ ...current, content: result.content }) : current)
      setTutorial(result.tutorial || null)
      if (Array.isArray(result.flashcards) && result.flashcards.length > 0) {
        setFlashcards(result.flashcards)
      }
    } catch (error) {
      console.error('Regeneration error:', error)
      toast.error(`Failed to generate content: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleShowFlashcards = async () => {
    setShowFlashcards(true)

    if (flashcards.length > 0) {
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/generate-topic-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate flashcards')
      }

      if (Array.isArray(result.flashcards) && result.flashcards.length > 0) {
        setFlashcards(result.flashcards)
        setCurrentCard(0)
        setIsFlipped(false)
      } else {
        throw new Error('No flashcards returned')
      }
    } catch (error) {
      console.error('Flashcard generation error:', error)
      toast.error('Could not generate AI flashcards. Falling back to default.')
      setFlashcards([
        { front: 'What is the main concept?', back: topic.description || 'Review the topic description.' },
        { front: 'Key takeaway', back: 'Reflect on the most important thing you learned from this section.' },
        { front: 'Self assessment', back: 'How confident do you feel about this material? (1-5)' }
      ])
    } finally {
      setGenerating(false)
    }
  }

  const handleNextCard = useCallback(() => {
    setIsFlipped(false)
    setTimeout(() => {
      setCurrentCard((previous) => (previous + 1) % flashcards.length)
    }, 150)
  }, [flashcards.length])

  const handlePrevCard = useCallback(() => {
    setIsFlipped(false)
    setTimeout(() => {
      setCurrentCard((previous) => (previous - 1 + flashcards.length) % flashcards.length)
    }, 150)
  }, [flashcards.length])

  useEffect(() => {
    if (!showFlashcards) return

    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setIsFlipped((previous) => !previous)
      } else if (event.code === 'ArrowRight') {
        event.preventDefault()
        handleNextCard()
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        handlePrevCard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextCard, handlePrevCard, showFlashcards])

  if (loading || !topic) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
          <Clock className="h-6 w-6 text-primary" />
          <span className="text-lg font-medium">Loading Topic...</span>
        </div>
      </div>
    )
  }

  const totalMinutes = topic.estimated_minutes || 5
  const totalSeconds = totalMinutes * 60
  const remainingSeconds = Math.max(0, totalSeconds - ((progress / 100) * totalSeconds))
  const renderedContent = tutorial?.tutorialMarkdown || topic.content
  const hasTutorial = Boolean(tutorial?.tutorialBlocks?.length)
  const hasDetailedContent = hasTutorial || Boolean(renderedContent && renderedContent !== topic.description && renderedContent.length > 50)

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (showFlashcards) {
    if (generating) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 selection:bg-primary/20 selection:text-primary overflow-hidden relative">
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
          <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Sparkles className="h-16 w-16 text-primary animate-spin-slow relative z-10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Synthesizing Flashcards...</h2>
            <p className="text-muted-foreground animate-pulse">Consulting the AI for key concepts</p>
          </div>
        </div>
      )
    }

    if (flashcards.length > 0) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-primary/20 selection:text-primary overflow-hidden">
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>

          <div className="relative z-10 w-full max-w-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Button variant="ghost" onClick={() => setShowFlashcards(false)} className="hover:bg-white/5 -ml-4 mb-2 md:mb-0">
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back to Content
                </Button>
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight">Flashcards</h2>
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono border border-primary/20">
                    {topic.title}
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-2xl md:text-3xl font-bold font-mono text-primary">
                  {String(currentCard + 1).padStart(2, '0')}
                  <span className="text-muted-foreground text-lg">/{String(flashcards.length).padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            <div className="w-full bg-white/5 h-1.5 rounded-full mb-8 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-sky-500 transition-all duration-500 ease-out"
                style={{ width: `${((currentCard + 1) / flashcards.length) * 100}%` }}
              />
            </div>

            <Flashcard
              front={flashcards[currentCard].front}
              back={flashcards[currentCard].back}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
            />

            <div className="mt-8 md:mt-12 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={handlePrevCard}
                className="w-full md:w-auto glass border-white/10 hover:bg-white/5 min-w-[120px]"
              >
                Previous
                <span className="ml-2 text-xs text-muted-foreground hidden md:inline-block border border-white/10 px-1.5 rounded bg-black/20">←</span>
              </Button>

              <div className="flex flex-col items-center gap-2 order-first md:order-none mb-4 md:mb-0">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium opacity-50">
                  Tap to Flip
                </span>
              </div>

              {currentCard === flashcards.length - 1 ? (
                <Button
                  size="lg"
                  onClick={handleCompleteLearning}
                  className="w-full md:w-auto bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 min-w-[120px]"
                >
                  <Check className="mr-2 h-5 w-5" />
                  Finish
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleNextCard}
                  className="w-full md:w-auto glass border-white/10 hover:bg-white/5 min-w-[120px]"
                >
                  Next
                  <span className="ml-2 text-xs text-muted-foreground hidden md:inline-block border border-white/10 px-1.5 rounded bg-black/20">→</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 selection:text-primary">
      <div className="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] bg-background/95 backdrop-blur-md border-b border-white/10 supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push(`/subjects/${subject.id}`)} className="hover:bg-white/5 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground truncate">{subject.title}</div>
                <h1 className="text-base md:text-2xl font-bold tracking-tight truncate">{topic.title}</h1>
              </div>
            </div>
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end md:gap-4">
              <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded-full border border-white/5 shrink-0">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium hidden md:inline">{formatTime(remainingSeconds)} remaining</span>
                <span className="text-sm font-medium md:hidden">{formatTime(remainingSeconds)}</span>
              </div>
              <ThemeToggle className="hidden md:flex" />
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 bg-white/5">
          <div className="container mx-auto px-4 md:px-6 py-3">
            <Progress value={progress} className="h-1.5 bg-white/10" />
            <div className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">
              Reading progress: {Math.round(progress)}%
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 md:px-6 pt-[calc(132px+env(safe-area-inset-top))] md:pt-[calc(140px+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]">
        <Card className="glass-card mb-8 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">{topic.title}</CardTitle>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Difficulty: {topic.difficulty}/5</span>
              <span className="hidden sm:inline">•</span>
              <span>Estimated: {topic.estimated_minutes} minutes</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 md:space-y-10">
            {topic.description ? (
              <section className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent p-5 md:p-7">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Topic Overview</div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground md:text-2xl">Start with the big picture</h3>
                <p className="mt-3 max-w-3xl text-base leading-8 text-muted-foreground md:text-[17px]">{topic.description}</p>
              </section>
            ) : null}

            {(hasTutorial || tutorialLoading) ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Personalized Session</div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                      Learn through your preferred style
                    </h3>
                  </div>
                  {tutorial?.learningStyle ? (
                    <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                      {tutorial.learningStyle}
                    </div>
                  ) : null}
                </div>
                {hasTutorial ? (
                  <TutorialSessionRenderer tutorial={tutorial} learningStyle={tutorial.learningStyle} />
                ) : (
                  <div className="rounded-3xl border border-primary/15 bg-primary/5 p-5 text-sm text-muted-foreground">
                    Building your tutorial structure...
                  </div>
                )}
              </section>
            ) : null}

            {(!styleTutorialsEnabled || (!tutorialLoading && !hasTutorial)) && renderedContent ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Detailed Walkthrough</div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                      Comprehensive guide
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Markdown lesson
                  </div>
                </div>
                <div className="rounded-[28px] border border-white/8 bg-gradient-to-br from-background via-background to-white/[0.03] p-5 md:p-8">
                  <div className="lesson-markdown markdown-content prose prose-slate dark:prose-invert max-w-none break-words prose-headings:scroll-mt-28 prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:border-t prose-h2:border-white/8 prose-h2:pt-8 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:text-muted-foreground prose-p:leading-8 prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={MarkdownComponents}
                    >
                      {sanitizeLatex(renderedContent)}
                    </ReactMarkdown>
                  </div>
                </div>
              </section>
            ) : null}

            {!hasDetailedContent && !tutorialLoading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/8 border-dashed bg-white/5 py-12 text-center text-muted-foreground">
                {generating || tutorialLoading ? (
                  <div className="flex flex-col items-center animate-pulse">
                    <Sparkles className="mb-4 h-10 w-10 animate-spin-slow text-primary" />
                    <p className="text-base">Generating personalized tutorial...</p>
                  </div>
                ) : (
                  <>
                    <Clock className="mb-4 h-10 w-10 opacity-50" />
                    <p className="mb-4 text-base">Content seems brief or missing.</p>
                    <Button onClick={handleRegenerateContent} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Personalized Tutorial
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col items-stretch justify-center gap-4 md:flex-row md:items-center">
          <Button variant="outline" size="lg" onClick={handleShowFlashcards} className="w-full md:w-auto glass border-white/10 hover:bg-white/5">
            Practice with Flashcards
          </Button>
          <Button size="lg" onClick={handleCompleteLearning} className="w-full md:w-auto h-12 md:h-11 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
            <Check className="mr-2 h-5 w-5" />
            Mark as Learned
          </Button>
        </div>
      </div>

      <DoubtChat
        topicId={topicId}
        topicTitle={topic.title}
        subjectTitle={subject.title}
        contentStatus={hasDetailedContent}
      />

      <StickyNoteWidget
        topicId={topicId}
        topicTitle={topic.title}
        initialNotes={topic.user_notes}
      />

      <SelectionHighlighter />
    </div>
  )
}
