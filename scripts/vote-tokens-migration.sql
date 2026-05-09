-- Migration: tamper-resistant voting
-- Run this in the Supabase SQL editor (project: qumelyuoeutlnnouhguo)
--
-- 1. Creates vote_tokens table — records each browser's vote per day
-- 2. Replaces increment_vote() to enforce one vote per token per date at DB level
--
-- After running: deploy the updated VotingButtons.jsx (passes voter_token arg)

-- Step 1: vote_tokens table
CREATE TABLE IF NOT EXISTS vote_tokens (
  token   TEXT NOT NULL,
  date    DATE NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('agree', 'disagree')),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (token, date)
);

-- Anon can insert but not read, update, or delete
ALTER TABLE vote_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert vote token"
  ON vote_tokens FOR INSERT
  TO anon
  WITH CHECK (true);

-- Step 2: replace increment_vote() to accept voter_token
-- The INSERT into vote_tokens will raise a unique_violation (23505) if the
-- token has already voted today, which rolls back the whole function.
-- Note: record_date is TEXT to match the daily_weather_records.date column
-- type; cast to DATE only when inserting into vote_tokens.date.
--
-- If an old 2-argument version of this function exists, drop it first:
--   DROP FUNCTION IF EXISTS increment_vote(TEXT, TEXT);
CREATE OR REPLACE FUNCTION increment_vote(
  record_date TEXT,
  vote_type   TEXT,
  voter_token TEXT
) RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enforce one vote per token per day (raises 23505 on duplicate)
  INSERT INTO vote_tokens (token, date, vote_type)
  VALUES (voter_token, record_date::DATE, vote_type);

  -- Increment the counter
  IF vote_type = 'agree' THEN
    UPDATE daily_weather_records
    SET agree_count = agree_count + 1
    WHERE date = record_date;
  ELSIF vote_type = 'disagree' THEN
    UPDATE daily_weather_records
    SET disagree_count = disagree_count + 1
    WHERE date = record_date;
  ELSE
    RAISE EXCEPTION 'Invalid vote_type: %', vote_type;
  END IF;
END;
$$;
