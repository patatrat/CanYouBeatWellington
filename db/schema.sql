-- Reference snapshot of the Neon production schema (project: can-you-beat-wellington
-- / dawn-queen-51598624), introspected from the live database on 2026-07-02.
-- This file is documentation, not a migration runner — the live DB is the source
-- of truth; keep this in sync when the schema changes.

CREATE TABLE daily_weather_records (
  date           date PRIMARY KEY,
  temperature    numeric NOT NULL,
  wind_speed     numeric NOT NULL,
  rain           numeric NOT NULL DEFAULT 0,
  -- Coldest apparent ("feels like") temperature during the 6am-6pm daytime
  -- window — wind chill/humidity/radiation-adjusted, from Open-Meteo's
  -- apparent_temperature. Nullable like sunniness: added 2026-08, so rows
  -- older than the ~92-day cron backfill window never get a value.
  feels_like     numeric,
  -- Daily snowfall total (cm) from Open-Meteo's snowfall_sum — Wellington
  -- snow is rare enough to be newsworthy when it happens. Same nullable/
  -- backfill caveat as feels_like.
  snowfall       numeric,
  sunniness      integer,
  agree_count    integer NOT NULL DEFAULT 0,
  disagree_count integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- One vote per browser identity per day, enforced at the DB level.
CREATE TABLE vote_tokens (
  token text NOT NULL,
  date  date NOT NULL,
  PRIMARY KEY (token, date)
);

-- Inserts the vote token first so the (token, date) primary key rejects
-- duplicate votes with a 23505 unique violation before any count changes.
-- Unknown vote_type values fall through without touching the counts —
-- callers must validate vote_type ('agree' | 'disagree') before calling.
CREATE OR REPLACE FUNCTION increment_vote(record_date date, vote_type text, voter_token text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO vote_tokens (token, date) VALUES (voter_token, record_date);
  IF vote_type = 'agree' THEN
    UPDATE daily_weather_records SET agree_count = agree_count + 1 WHERE date = record_date;
  ELSIF vote_type = 'disagree' THEN
    UPDATE daily_weather_records SET disagree_count = disagree_count + 1 WHERE date = record_date;
  END IF;
END;
$function$;

-- What a special occasion *is* (definition); when it *happens* lives in
-- special_date_occurrences. See src/lib/special-dates.ts and CLAUDE.md.
CREATE TABLE special_date_defs (
  id              serial PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('fixed_rule', 'moveable', 'sporting', 'oneoff')),
  recurrence_rule text,
  recurring       boolean NOT NULL DEFAULT false,
  quip_override   text,
  -- Weather-scenario-dependent quips for this date (e.g. Christmas Day wants
  -- a different line for a good day than a cold or rainy one) — a partial
  -- JSON map of scenario key -> quip text. Keys: all_bad, cold, rain, wind,
  -- great, good (see getSpecialDayScenario() in special-dates-logic.ts).
  -- Checked ahead of the global scenario quips whenever this def is the
  -- active special date; a scenario with no entry falls through to the
  -- global quip system. Independent of quip_override (a single fixed
  -- string, used for e.g. sporting results, which wins outright when set).
  scenario_quips  jsonb,
  background_key  text,
  effect          text NOT NULL DEFAULT 'none' CHECK (effect IN ('none', 'confetti', 'balloons')),
  link_url        text,
  link_label      text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE special_date_occurrences (
  id               serial PRIMARY KEY,
  def_id           integer NOT NULL REFERENCES special_date_defs(id) ON DELETE CASCADE,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  status           text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  verdict_override boolean,
  outcome_note     text,
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT occurrence_date_order CHECK (end_date >= start_date)
);

CREATE INDEX idx_occurrences_date_range ON special_date_occurrences (start_date, end_date);

-- Guards ensureUpcomingOccurrences() against double-inserting the same
-- occurrence if the cron ever runs concurrently.
CREATE UNIQUE INDEX special_date_occurrences_def_start_key ON special_date_occurrences (def_id, start_date);
