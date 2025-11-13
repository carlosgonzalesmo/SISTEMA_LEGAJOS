-- CreateEnum
CREATE TYPE "DevolucionStatus" AS ENUM ('PENDING_RETURN', 'RETURNED');

-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "currentHolderId" INTEGER;

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "approvedFileIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "blockedFileIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "status" "DevolucionStatus" NOT NULL DEFAULT 'PENDING_RETURN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionLegajo" (
    "id" SERIAL NOT NULL,
    "devolucionId" INTEGER NOT NULL,
    "legajoId" INTEGER NOT NULL,

    CONSTRAINT "DevolucionLegajo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionLegajo" ADD CONSTRAINT "DevolucionLegajo_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionLegajo" ADD CONSTRAINT "DevolucionLegajo_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
