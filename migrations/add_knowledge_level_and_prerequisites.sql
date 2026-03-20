-- Migration to support AI Curriculum Generation Knowledge Level & Prerequisites
ALTER TABLE public.subjects
ADD COLUMN knowledge_level TEXT DEFAULT 'Beginner',
ADD COLUMN core_prerequisites TEXT;

-- Verify changes
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subjects';
