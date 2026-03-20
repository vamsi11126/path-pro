-- Classroom assessments, attempts, grading, and integrity events.
-- Apply after the classroom feature migration.

CREATE TABLE IF NOT EXISTS public.assessment_question_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  question_type TEXT NOT NULL CHECK (
    question_type IN ('mcq', 'multi_select', 'true_false', 'short_answer', 'long_answer', 'numeric', 'match')
  ),
  prompt TEXT NOT NULL,
  answer_key JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_explanation TEXT,
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  default_points NUMERIC(8,2) NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.classroom_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_course_id UUID REFERENCES public.classroom_courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  assessment_type TEXT NOT NULL DEFAULT 'graded' CHECK (
    assessment_type IN ('practice', 'graded', 'secure')
  ),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  created_via TEXT NOT NULL DEFAULT 'manual' CHECK (
    created_via IN ('manual', 'ai', 'template')
  ),
  ai_prompt TEXT,
  open_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
  pass_percentage NUMERIC(5,2) NOT NULL DEFAULT 40 CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
  show_results_immediately BOOLEAN NOT NULL DEFAULT FALSE,
  strict_mode BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
  question_id UUID,
  title TEXT NOT NULL,
  rubric_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.assessment_sections(id) ON DELETE SET NULL,
  question_bank_id UUID REFERENCES public.assessment_question_bank(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  question_type TEXT NOT NULL CHECK (
    question_type IN ('mcq', 'multi_select', 'true_false', 'short_answer', 'long_answer', 'numeric', 'match')
  ),
  prompt TEXT NOT NULL,
  answer_key JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_explanation TEXT,
  points NUMERIC(8,2) NOT NULL DEFAULT 1,
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assessment_rubrics
  DROP CONSTRAINT IF EXISTS assessment_rubrics_question_id_fkey;

ALTER TABLE public.assessment_rubrics
  ADD CONSTRAINT assessment_rubrics_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.assessment_questions(id)
  ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.assessment_question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  label TEXT,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  match_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (
    status IN ('not_started', 'in_progress', 'submitted', 'auto_graded', 'teacher_review_pending', 'finalized', 'expired', 'abandoned')
  ),
  delivery_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auto_graded_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  teacher_review_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  score NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  integrity_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, student_user_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.assessment_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_text TEXT,
  numeric_answer NUMERIC(12,4),
  selected_option_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  answer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN,
  auto_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  teacher_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  final_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  feedback TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.assessment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_severity TEXT NOT NULL DEFAULT 'low' CHECK (event_severity IN ('low', 'medium', 'high')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.classroom_assessments(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL DEFAULT 0,
  answered_questions INTEGER NOT NULL DEFAULT 0,
  correct_questions INTEGER NOT NULL DEFAULT 0,
  objective_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  subjective_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  teacher_feedback TEXT,
  mastery_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  topic_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_to_student BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classroom_assessments_classroom
  ON public.classroom_assessments(classroom_id, status, open_at, close_at);
CREATE INDEX IF NOT EXISTS idx_classroom_assessments_course
  ON public.classroom_assessments(classroom_course_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sections_assessment
  ON public.assessment_sections(assessment_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment
  ON public.assessment_questions(assessment_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_topic
  ON public.assessment_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_assessment_options_question
  ON public.assessment_question_options(question_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment
  ON public.assessment_attempts(assessment_id, student_user_id, status);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_classroom
  ON public.assessment_attempts(classroom_id, status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_attempt
  ON public.assessment_answers(attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_events_attempt
  ON public.assessment_events(attempt_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_assessment_events_assessment
  ON public.assessment_events(assessment_id, event_severity);
CREATE INDEX IF NOT EXISTS idx_assessment_results_assessment
  ON public.assessment_results(assessment_id, percentage);
CREATE INDEX IF NOT EXISTS idx_question_bank_teacher
  ON public.assessment_question_bank(teacher_user_id, subject_id, topic_id);

ALTER TABLE public.assessment_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own question bank" ON public.assessment_question_bank;
CREATE POLICY "Teachers manage own question bank"
  ON public.assessment_question_bank
  FOR ALL
  USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());

DROP POLICY IF EXISTS "Teachers and students view classroom assessments" ON public.classroom_assessments;
CREATE POLICY "Teachers and students view classroom assessments"
  ON public.classroom_assessments
  FOR SELECT
  USING (
    public.is_classroom_teacher(classroom_id)
    OR (
      status = 'published'
      AND public.is_classroom_student(classroom_id)
    )
  );

DROP POLICY IF EXISTS "Teachers insert classroom assessments" ON public.classroom_assessments;
CREATE POLICY "Teachers insert classroom assessments"
  ON public.classroom_assessments
  FOR INSERT
  WITH CHECK (
    teacher_user_id = auth.uid()
    AND public.is_classroom_teacher(classroom_id)
  );

DROP POLICY IF EXISTS "Teachers update classroom assessments" ON public.classroom_assessments;
CREATE POLICY "Teachers update classroom assessments"
  ON public.classroom_assessments
  FOR UPDATE
  USING (public.is_classroom_teacher(classroom_id))
  WITH CHECK (
    teacher_user_id = auth.uid()
    AND public.is_classroom_teacher(classroom_id)
  );

DROP POLICY IF EXISTS "Teachers delete classroom assessments" ON public.classroom_assessments;
CREATE POLICY "Teachers delete classroom assessments"
  ON public.classroom_assessments
  FOR DELETE
  USING (public.is_classroom_teacher(classroom_id));

DROP POLICY IF EXISTS "Teachers and students view assessment sections" ON public.assessment_sections;
CREATE POLICY "Teachers and students view assessment sections"
  ON public.assessment_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_sections.assessment_id
        AND (
          public.is_classroom_teacher(classroom_assessments.classroom_id)
          OR (
            classroom_assessments.status = 'published'
            AND public.is_classroom_student(classroom_assessments.classroom_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Teachers manage assessment sections" ON public.assessment_sections;
CREATE POLICY "Teachers manage assessment sections"
  ON public.assessment_sections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_sections.assessment_id
        AND public.is_classroom_teacher(classroom_assessments.classroom_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_sections.assessment_id
        AND public.is_classroom_teacher(classroom_assessments.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Teachers and students view assessment rubrics" ON public.assessment_rubrics;
CREATE POLICY "Teachers and students view assessment rubrics"
  ON public.assessment_rubrics
  FOR SELECT
  USING (
    assessment_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_rubrics.assessment_id
        AND (
          public.is_classroom_teacher(classroom_assessments.classroom_id)
          OR public.is_classroom_student(classroom_assessments.classroom_id)
        )
    )
  );

DROP POLICY IF EXISTS "Teachers manage assessment rubrics" ON public.assessment_rubrics;
CREATE POLICY "Teachers manage assessment rubrics"
  ON public.assessment_rubrics
  FOR ALL
  USING (
    teacher_user_id = auth.uid()
    AND (
      assessment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.classroom_assessments
        WHERE id = assessment_rubrics.assessment_id
          AND public.is_classroom_teacher(classroom_assessments.classroom_id)
      )
    )
  )
  WITH CHECK (
    teacher_user_id = auth.uid()
    AND (
      assessment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.classroom_assessments
        WHERE id = assessment_rubrics.assessment_id
          AND public.is_classroom_teacher(classroom_assessments.classroom_id)
      )
    )
  );

DROP POLICY IF EXISTS "Teachers and students view assessment questions" ON public.assessment_questions;
CREATE POLICY "Teachers and students view assessment questions"
  ON public.assessment_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_questions.assessment_id
        AND (
          public.is_classroom_teacher(classroom_assessments.classroom_id)
          OR (
            classroom_assessments.status = 'published'
            AND public.is_classroom_student(classroom_assessments.classroom_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Teachers manage assessment questions" ON public.assessment_questions;
CREATE POLICY "Teachers manage assessment questions"
  ON public.assessment_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_questions.assessment_id
        AND public.is_classroom_teacher(classroom_assessments.classroom_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_questions.assessment_id
        AND public.is_classroom_teacher(classroom_assessments.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Teachers and students view assessment options" ON public.assessment_question_options;
CREATE POLICY "Teachers and students view assessment options"
  ON public.assessment_question_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.assessment_questions
      JOIN public.classroom_assessments
        ON classroom_assessments.id = assessment_questions.assessment_id
      WHERE assessment_questions.id = assessment_question_options.question_id
        AND (
          public.is_classroom_teacher(classroom_assessments.classroom_id)
          OR (
            classroom_assessments.status = 'published'
            AND public.is_classroom_student(classroom_assessments.classroom_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Teachers manage assessment options" ON public.assessment_question_options;
CREATE POLICY "Teachers manage assessment options"
  ON public.assessment_question_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.assessment_questions
      JOIN public.classroom_assessments
        ON classroom_assessments.id = assessment_questions.assessment_id
      WHERE assessment_questions.id = assessment_question_options.question_id
        AND public.is_classroom_teacher(classroom_assessments.classroom_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assessment_questions
      JOIN public.classroom_assessments
        ON classroom_assessments.id = assessment_questions.assessment_id
      WHERE assessment_questions.id = assessment_question_options.question_id
        AND public.is_classroom_teacher(classroom_assessments.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Teachers and students view assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Teachers and students view assessment attempts"
  ON public.assessment_attempts
  FOR SELECT
  USING (
    student_user_id = auth.uid()
    OR public.is_classroom_teacher(classroom_id)
  );

DROP POLICY IF EXISTS "Students create assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Students create assessment attempts"
  ON public.assessment_attempts
  FOR INSERT
  WITH CHECK (
    student_user_id = auth.uid()
    AND public.is_classroom_student(classroom_id)
    AND EXISTS (
      SELECT 1
      FROM public.classroom_assessments
      WHERE id = assessment_attempts.assessment_id
        AND classroom_assessments.classroom_id = assessment_attempts.classroom_id
        AND classroom_assessments.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Students and teachers update assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Students and teachers update assessment attempts"
  ON public.assessment_attempts
  FOR UPDATE
  USING (
    student_user_id = auth.uid()
    OR public.is_classroom_teacher(classroom_id)
  )
  WITH CHECK (
    student_user_id = auth.uid()
    OR public.is_classroom_teacher(classroom_id)
  );

DROP POLICY IF EXISTS "Teachers and students view assessment answers" ON public.assessment_answers;
CREATE POLICY "Teachers and students view assessment answers"
  ON public.assessment_answers
  FOR SELECT
  USING (
    student_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessment_attempts
      WHERE id = assessment_answers.attempt_id
        AND public.is_classroom_teacher(assessment_attempts.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Students create and update own answers" ON public.assessment_answers;
CREATE POLICY "Students create and update own answers"
  ON public.assessment_answers
  FOR ALL
  USING (
    student_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessment_attempts
      WHERE id = assessment_answers.attempt_id
        AND public.is_classroom_teacher(assessment_attempts.classroom_id)
    )
  )
  WITH CHECK (
    student_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessment_attempts
      WHERE id = assessment_answers.attempt_id
        AND public.is_classroom_teacher(assessment_attempts.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Teachers and students view assessment events" ON public.assessment_events;
CREATE POLICY "Teachers and students view assessment events"
  ON public.assessment_events
  FOR SELECT
  USING (
    student_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessment_attempts
      WHERE id = assessment_events.attempt_id
        AND public.is_classroom_teacher(assessment_attempts.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Students and teachers insert assessment events" ON public.assessment_events;
CREATE POLICY "Students and teachers insert assessment events"
  ON public.assessment_events
  FOR INSERT
  WITH CHECK (
    student_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessment_attempts
      WHERE id = assessment_events.attempt_id
        AND public.is_classroom_teacher(assessment_attempts.classroom_id)
    )
  );

DROP POLICY IF EXISTS "Teachers and students view assessment results" ON public.assessment_results;
CREATE POLICY "Teachers and students view assessment results"
  ON public.assessment_results
  FOR SELECT
  USING (
    public.is_classroom_teacher(classroom_id)
    OR (
      student_user_id = auth.uid()
      AND (
        published_to_student
        OR EXISTS (
          SELECT 1
          FROM public.classroom_assessments
          WHERE id = assessment_results.assessment_id
            AND classroom_assessments.show_results_immediately = TRUE
        )
      )
    )
  );

DROP POLICY IF EXISTS "Teachers insert assessment results" ON public.assessment_results;
CREATE POLICY "Teachers insert assessment results"
  ON public.assessment_results
  FOR INSERT
  WITH CHECK (public.is_classroom_teacher(classroom_id));

DROP POLICY IF EXISTS "Teachers update assessment results" ON public.assessment_results;
CREATE POLICY "Teachers update assessment results"
  ON public.assessment_results
  FOR UPDATE
  USING (public.is_classroom_teacher(classroom_id))
  WITH CHECK (public.is_classroom_teacher(classroom_id));

DROP POLICY IF EXISTS "Teachers delete assessment results" ON public.assessment_results;
CREATE POLICY "Teachers delete assessment results"
  ON public.assessment_results
  FOR DELETE
  USING (public.is_classroom_teacher(classroom_id));

DROP TRIGGER IF EXISTS update_assessment_question_bank_updated_at ON public.assessment_question_bank;
CREATE TRIGGER update_assessment_question_bank_updated_at
  BEFORE UPDATE ON public.assessment_question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_classroom_assessments_updated_at ON public.classroom_assessments;
CREATE TRIGGER update_classroom_assessments_updated_at
  BEFORE UPDATE ON public.classroom_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_sections_updated_at ON public.assessment_sections;
CREATE TRIGGER update_assessment_sections_updated_at
  BEFORE UPDATE ON public.assessment_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_rubrics_updated_at ON public.assessment_rubrics;
CREATE TRIGGER update_assessment_rubrics_updated_at
  BEFORE UPDATE ON public.assessment_rubrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_questions_updated_at ON public.assessment_questions;
CREATE TRIGGER update_assessment_questions_updated_at
  BEFORE UPDATE ON public.assessment_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_attempts_updated_at ON public.assessment_attempts;
CREATE TRIGGER update_assessment_attempts_updated_at
  BEFORE UPDATE ON public.assessment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_answers_updated_at ON public.assessment_answers;
CREATE TRIGGER update_assessment_answers_updated_at
  BEFORE UPDATE ON public.assessment_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_results_updated_at ON public.assessment_results;
CREATE TRIGGER update_assessment_results_updated_at
  BEFORE UPDATE ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
