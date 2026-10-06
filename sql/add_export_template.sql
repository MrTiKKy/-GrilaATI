BEGIN;
CREATE TABLE IF NOT EXISTS export_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tip text NOT NULL DEFAULT 'pdf' CHECK (tip = 'pdf'),
  nume text NOT NULL DEFAULT 'Implicit',
  setari jsonb NOT NULL,
  versiune int NOT NULL DEFAULT 1,
  updated_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, tip)
);
COMMIT;
