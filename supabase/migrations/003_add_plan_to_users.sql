-- Add plan tier to the users table.
-- Default 'free' keeps all existing rows valid.
-- The admin-users Edge Function reads and writes this column.
-- The app syncs this value to the local Zustand store on every cold start.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', 'guardian'));
