-- Weekly classroom rewards, badge state, and review audit metadata.
-- Apply after the classroom feature and classroom assessments migrations.

ALTER TABLE public.study_logs
ADD COLUMN IF NOT EXISTS scheduled_review_at TIMESTAMPTZ;

ALTER TABLE public.study_logs
ADD COLUMN IF NOT EXISTS review_completed_on_time BOOLEAN;

CREATE TABLE IF NOT EXISTS public.classroom_weekly_awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  winner_student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_title TEXT,
  teacher_note TEXT,
  badge_active_from TIMESTAMPTZ NOT NULL,
  badge_active_to TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (classroom_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_study_logs_classroom_review_schedule
  ON public.study_logs(classroom_id, scheduled_review_at)
  WHERE source_type = 'classroom' AND scheduled_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classroom_weekly_awards_classroom_week
  ON public.classroom_weekly_awards(classroom_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_classroom_weekly_awards_active_badge
  ON public.classroom_weekly_awards(classroom_id, badge_active_from, badge_active_to);

ALTER TABLE public.classroom_weekly_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers and students view classroom weekly awards" ON public.classroom_weekly_awards;
CREATE POLICY "Teachers and students view classroom weekly awards"
  ON public.classroom_weekly_awards
  FOR SELECT
  USING (
    public.is_classroom_teacher(classroom_id)
    OR public.is_classroom_student(classroom_id)
  );

DROP POLICY IF EXISTS "Teachers manage classroom weekly awards" ON public.classroom_weekly_awards;
CREATE POLICY "Teachers manage classroom weekly awards"
  ON public.classroom_weekly_awards
  FOR ALL
  USING (public.is_classroom_teacher(classroom_id))
  WITH CHECK (public.is_classroom_teacher(classroom_id));

DROP TRIGGER IF EXISTS update_classroom_weekly_awards_updated_at ON public.classroom_weekly_awards;
CREATE TRIGGER update_classroom_weekly_awards_updated_at
  BEFORE UPDATE ON public.classroom_weekly_awards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
