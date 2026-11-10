-- Migración propia: Drizzle no tiene `exclude()`. Impide dos turnos no
-- cancelados del mismo profesor que se pisen (`&&` = los rangos se superponen;
-- `[)` incluye el inicio y excluye el fin, así 10-11 y 11-12 no chocan).
-- `btree_gist` permite usar `=` sobre `uuid` dentro de un índice GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_profesor_sin_solapamiento"
  EXCLUDE USING gist (
    "profesor_id" WITH =,
    tstzrange("inicia_en", "termina_en", '[)') WITH &&
  ) WHERE ("estado" <> 'cancelado');
