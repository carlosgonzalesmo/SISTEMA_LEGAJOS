/*
  Warnings:

  - Made the column `codigo` on table `Legajo` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Legajo" ALTER COLUMN "codigo" SET NOT NULL;
