-- Zile sărbătoare legală (workspace): coloană portocalie + O.SD ca duminica
CREATE TABLE IF NOT EXISTS sarbatori_legale (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data date NOT NULL,
  PRIMARY KEY (workspace_id, data)
);

CREATE INDEX IF NOT EXISTS sarbatori_legale_workspace_data_idx
  ON sarbatori_legale (workspace_id, data);
