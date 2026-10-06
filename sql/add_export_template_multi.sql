BEGIN;

ALTER TABLE export_template DROP CONSTRAINT IF EXISTS export_template_workspace_id_tip_key;

ALTER TABLE export_template
  ADD COLUMN IF NOT EXISTS implicit boolean NOT NULL DEFAULT false;

UPDATE export_template SET implicit = true;

CREATE UNIQUE INDEX IF NOT EXISTS export_template_workspace_tip_nume_uidx
  ON export_template (workspace_id, tip, nume);

CREATE UNIQUE INDEX IF NOT EXISTS export_template_one_implicit_uidx
  ON export_template (workspace_id, tip)
  WHERE implicit = true;

COMMIT;
