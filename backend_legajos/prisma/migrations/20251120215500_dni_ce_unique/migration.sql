-- Manual migration to add unique constraint on dniCe
ALTER TABLE "Legajo" ADD CONSTRAINT "Legajo_dniCe_key" UNIQUE("dniCe");
