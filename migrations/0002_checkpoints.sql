CREATE TABLE checkpoints (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  checkpoint TEXT NOT NULL CHECK (json_valid(checkpoint))
);
