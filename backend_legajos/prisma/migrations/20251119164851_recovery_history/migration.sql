-- CreateTable
CREATE TABLE "LegajoRecoveryHistory" (
    "id" SERIAL NOT NULL,
    "legajoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegajoRecoveryHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LegajoRecoveryHistory" ADD CONSTRAINT "LegajoRecoveryHistory_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegajoRecoveryHistory" ADD CONSTRAINT "LegajoRecoveryHistory_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
