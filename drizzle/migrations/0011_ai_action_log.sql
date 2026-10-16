CREATE TABLE public.ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_action_log TO authenticated;
GRANT ALL ON public.ai_action_log TO service_role;
ALTER TABLE public.ai_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read ai log" ON public.ai_action_log FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "Owners insert own ai log" ON public.ai_action_log FOR INSERT TO authenticated WITH CHECK (public.is_owner() AND user_id = auth.uid());
CREATE INDEX ai_action_log_user_time ON public.ai_action_log(user_id, created_at);