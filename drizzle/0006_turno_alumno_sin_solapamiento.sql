-- Migración propia, como la 0003: impide que un alumno tenga dos turnos no
-- cancelados que se pisen, aunque sean con profesores distintos (la 0003 lo
-- impide solo por profesor). Mismo rango `[)`: 10-11 y 11-12 no chocan.
-- `btree_gist` ya lo creó la 0003.
ALTER TABLE "turno" ADD CONSTRAINT "turno_alumno_sin_solapamiento"
  EXCLUDE USING gist (
    "alumno_id" WITH =,
    tstzrange("inicia_en", "termina_en", '[)') WITH &&
  ) WHERE ("estado" <> 'cancelado');
