-- RLS Policies for UBB Pro Signal System
-- Apply in Supabase SQL Editor

-- ── user_profiles ─────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles: own row only"
  ON user_profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── user_alert_config ─────────────────────────────────────────
ALTER TABLE user_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_alert_config: own row only"
  ON user_alert_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── user_position_state ───────────────────────────────────────
ALTER TABLE user_position_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_position_state: own rows only"
  ON user_position_state
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── watchlist ─────────────────────────────────────────────────
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Users see only their own rows; service_role bypasses RLS automatically
CREATE POLICY "watchlist: own rows only"
  ON watchlist
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Backend service role (used by FastAPI via service_role key) bypasses RLS.
-- If using anon/authenticated key in backend, add a service policy:
-- CREATE POLICY "watchlist: service role full access"
--   ON watchlist FOR ALL TO service_role USING (true) WITH CHECK (true);
