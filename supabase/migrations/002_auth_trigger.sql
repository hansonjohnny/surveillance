-- =============================================================
-- Surveillance AI — Auth Trigger (standalone reference)
-- =============================================================
-- This migration documents the handle_new_user trigger as a
-- standalone file for teaching clarity.
--
-- When a user registers via supabase.auth.signUp(), Supabase
-- creates a row in auth.users. This trigger immediately inserts
-- a matching row into public.users so all downstream tables
-- (sessions, events, alerts, contacts, settings) have a valid
-- foreign key parent from the first moment the user exists.
--
-- CREATE OR REPLACE means running this file a second time is
-- safe — it updates the function in place without error.
--
-- ON CONFLICT DO NOTHING prevents a duplicate-key error if the
-- trigger somehow fires twice for the same user ID, which can
-- happen with social login providers (Google, Apple) added in
-- a later step.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, created_at)
  VALUES (new.id, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- DROP ... IF EXISTS prevents a "trigger already exists" error
-- when running this file against a database that already has
-- the trigger from 001_initial_schema.sql.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
