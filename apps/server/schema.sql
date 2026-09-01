DROP TABLE IF EXISTS scratch;

CREATE TABLE scratch (
  id          SERIAL PRIMARY KEY,
  label       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO scratch (label) VALUES ('hello from psql');

SELECT * FROM scratch;

\d scratch