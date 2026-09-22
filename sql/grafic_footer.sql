-- Texte footer grafic (editabile din panoul principal)
CREATE TABLE IF NOT EXISTS grafic_footer (
  key text PRIMARY KEY CHECK (key IN (
    'delegat_name',
    'delegat_label',
    'medic_sef',
    'as_sef'
  )),
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO grafic_footer (key, value) VALUES
  ('delegat_name', 'MARCULESCU'),
  ('delegat_label', 'DELEGAT'),
  ('medic_sef', '*MEDIC SEF: DR SUSANU CAROLIN*'),
  ('as_sef', 'AS SEF POPA NICOLETA')
ON CONFLICT (key) DO NOTHING;
