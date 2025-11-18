/*
  Warnings:

  - A unique constraint covering the columns `[codigo]` on the table `Legajo` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "codigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Legajo_codigo_key" ON "Legajo"("codigo");
