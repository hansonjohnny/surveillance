-- Migration 004: Plan self-upgrade restriction + atomic AI usage increment RPC

-- 1. Prevent authenticated users from changing their own plan column.
--    The service_role key (used by all Edge Functions) bypasses RLS entirely,
--    so admin-users and upgrade-plan Edge Functions can still assign plans.
--    The RESTRICTIVE qualifier means this policy is ANDed with all others.
CREATE POLICY "users_no_self_plan_upgrade"
  ON users
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    plan = (SELECT u.plan FROM users u WHERE u.id = auth.uid())
  );

-- 2. Ensure ai_usage table exists.
--    The analyse-image Edge Function reads and writes this table.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       text NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_usage' AND policyname = 'ai_usage_own_rows'
  ) THEN
    CREATE POLICY "ai_usage_own_rows" ON ai_usage
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Atomic AI usage increment.
--    Increments call_count only when it is below p_cap (avoids the
--    read-then-upsert race condition). Returns (new_count, capped_out).
--    SECURITY DEFINER lets Edge Functions (service role) call this RPC
--    without needing a JWT-authenticated session.
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid,
  p_date    text,
  p_cap     integer
)
RETURNS TABLE (new_count integer, capped_out boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO ai_usage (user_id, date, call_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET call_count = ai_usage.call_count + 1
    WHERE ai_usage.call_count < p_cap
  RETURNING ai_usage.call_count INTO v_count;

  IF v_count IS NULL THEN
    -- No row was modified: the cap was already reached.
    SELECT ai_usage.call_count INTO v_count
    FROM ai_usage
    WHERE ai_usage.user_id = p_user_id AND ai_usage.date = p_date;
    RETURN QUERY SELECT v_count, true;
  ELSE
    RETURN QUERY SELECT v_count, false;
  END IF;
END;
$$;
