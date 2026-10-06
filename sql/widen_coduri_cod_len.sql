-- Lărgește CHECK pe coduri.cod: 6 → 20 (doar limita; restul neschimbat).
-- Aplicat pe prod 2026-09-29 într-o singură tranzacție.

BEGIN;

ALTER TABLE coduri DROP CONSTRAINT coduri_cod_len;
ALTER TABLE coduri
  ADD CONSTRAINT coduri_cod_len
  CHECK (char_length(cod) BETWEEN 1 AND 20);

COMMIT;
