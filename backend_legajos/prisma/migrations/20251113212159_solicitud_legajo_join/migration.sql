/*
  Warnings:

  - You are about to drop the column `blockedReason` on the `Solicitud` table. All the data in the column will be lost.
  - You are about to drop the column `legajoId` on the `Solicitud` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Solicitud" DROP CONSTRAINT "Solicitud_legajoId_fkey";

-- AlterTable
ALTER TABLE "Solicitud" DROP COLUMN "blockedReason",
DROP COLUMN "legajoId";

-- CreateTable
CREATE TABLE "SolicitudLegajo" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "legajoId" INTEGER NOT NULL,

    CONSTRAINT "SolicitudLegajo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SolicitudLegajo" ADD CONSTRAINT "SolicitudLegajo_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudLegajo" ADD CONSTRAINT "SolicitudLegajo_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
