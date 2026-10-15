-- Impide que un mismo profesional tenga dos turnos activos superpuestos.
-- Lo garantiza la base de datos, incluso con dos reservas simultáneas.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_no_overlap"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'ATTENDED'));

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_valid_range" CHECK ("endsAt" > "startsAt");
