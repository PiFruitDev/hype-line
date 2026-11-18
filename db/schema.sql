-- Hype Line database. Run with: npm run db:setup (needs DATABASE_URL).
-- Players are anonymous: a random id kept in a cookie, no sign-up.

create table if not exists guesses (
  player_id   uuid        not null,
  day         date        not null,           -- the player's local date for the puzzle
  round       smallint    not null check (round between 0 and 4),
  topic_id    text        not null,
  mode        text        not null check (mode in ('peak', 'free')),
  vals        real[]      not null,            -- 40 quarterly values, 0..100
  peak_month  smallint    not null,
  score       smallint    not null,
  created_at  timestamptz not null default now(),
  primary key (player_id, day, round)          -- first guess counts; replays are ignored
);

create index if not exists guesses_day_round on guesses (day, round);
