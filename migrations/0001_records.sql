CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  handle_key TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE auth_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX auth_limits_expiry ON auth_limits(window_start);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  summary TEXT NOT NULL CHECK (json_valid(summary)),
  saved_at INTEGER NOT NULL
);
CREATE INDEX runs_history ON runs(account_id, saved_at DESC, id DESC);
