-- Migration: add learner-specific tutorial variants for style-aware sessions

CREATE TABLE IF NOT EXISTS public.topic_tutorial_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_style TEXT NOT NULL,
  tutorial_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'ready',
  tutorial_markdown TEXT NOT NULL,
  tutorial_outline JSONB NOT NULL DEFAULT '[]'::jsonb,
  tutorial_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  flashcards JSONB,
  chat_starters JSONB,
  review_prompts JSONB,
  quality_report JSONB,
  source_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(topic_id, user_id, learning_style, tutorial_version)
);

CREATE INDEX IF NOT EXISTS idx_topic_tutorial_variants_user_updated
  ON public.topic_tutorial_variants(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_tutorial_variants_topic_style
  ON public.topic_tutorial_variants(topic_id, learning_style);

ALTER TABLE public.topic_tutorial_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tutorial variants" ON public.topic_tutorial_variants;
CREATE POLICY "Users can view own tutorial variants"
  ON public.topic_tutorial_variants
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tutorial variants" ON public.topic_tutorial_variants;
CREATE POLICY "Users can insert own tutorial variants"
  ON public.topic_tutorial_variants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tutorial variants" ON public.topic_tutorial_variants;
CREATE POLICY "Users can update own tutorial variants"
  ON public.topic_tutorial_variants
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tutorial variants" ON public.topic_tutorial_variants;
CREATE POLICY "Users can delete own tutorial variants"
  ON public.topic_tutorial_variants
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_topic_tutorial_variants_updated_at ON public.topic_tutorial_variants;
CREATE TRIGGER update_topic_tutorial_variants_updated_at
  BEFORE UPDATE ON public.topic_tutorial_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
