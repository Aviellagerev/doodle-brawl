DROP TABLE IF EXISTS scratch             CASCADE;
DROP TABLE IF EXISTS match_replays       CASCADE;
DROP TABLE IF EXISTS match_chat          CASCADE;
DROP TABLE IF EXISTS turn_guesses        CASCADE;
DROP TABLE IF EXISTS match_turns         CASCADE;
DROP TABLE IF EXISTS match_participants  CASCADE;
DROP TABLE IF EXISTS matches             CASCADE;
DROP TABLE IF EXISTS sessions            CASCADE;
DROP TABLE IF EXISTS players             CASCADE;
DROP TABLE IF EXISTS users               CASCADE;

CREATE TABLE users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        UNIQUE NOT NULL,
  password_hash  TEXT        NOT NULL,
  username       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id            UUID        PRIMARY KEY,
  display_name  TEXT        NOT NULL,
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  TEXT        PRIMARY KEY,
  player_id   UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE matches (
  match_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT        NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ NOT NULL,
  settings    JSONB       NOT NULL
);

CREATE TABLE match_participants (
  match_id      UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES players(id),
  display_name  TEXT NOT NULL,
  final_score   INT  NOT NULL,
  placement     INT  NOT NULL,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE match_turns (
  turn_id     BIGSERIAL PRIMARY KEY,
  match_id    UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  round       INT  NOT NULL,
  drawer_points INT NOT NULL DEFAULT 0,
  turn_index  INT  NOT NULL,
  drawer_id   UUID NOT NULL REFERENCES players(id),
  word        TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  UNIQUE (match_id, round, drawer_id)
);

CREATE TABLE turn_ {{gggggggfgggggggggafsaaafg

ffssssfa

fsaaaaaasd

} (
  turn_id      BIGINT NOT NULL REFERENCES match_turns(turn_id) ON DELETE CASCADE,
  player_id    UUID   NOT NULL REFERENCES players(id),
  ms_to_guess  INT,
  points       INT    NOT NULL,
  PRIMARY KEY (turn_id, player_id)
);

CREATE TABLE match_chat (
  chat_id       BIGSERIAL PRIMARY KEY,
  match_id      UUID   NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  turn_id       BIGINT REFERENCES match_turns(turn_id) ON DELETE SET NULL,
  player_id     UUID   REFERENCES players(id),
  display_name  TEXT   NOT NULL,
  text          TEXT   NOT NULL,
  kind          TEXT   NOT NULL CHECK (kind IN ('chat', 'system', 'correct')),
  at            TIMESTAMPTZ NOT NULL
);

CREATE TABLE match_replays (
  turn_id    BIGINT   PRIMARY KEY REFERENCES match_turns(turn_id) ON DELETE CASCADE,
  format     SMALLINT NOT NULL,
  data       BYTEA    NOT NULL,
  byte_size  INT      NOT NULL
);

CREATE INDEX idx_players_user        ON players(user_id);
CREATE INDEX idx_sessions_player     ON sessions(player_id);
CREATE INDEX idx_participants_player ON match_participants(player_id);
CREATE INDEX idx_turns_match         ON match_turns(match_id, turn_index);
CREATE INDEX idx_guesses_player      ON turn_guesses(player_id);
CREATE INDEX idx_chat_match          ON match_chat(match_id, at);
