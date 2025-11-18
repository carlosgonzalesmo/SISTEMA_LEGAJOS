-- CreateTable
CREATE TABLE "LegajoHolderHistory" (
    "id" SERIAL NOT NULL,
    "legajoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LegajoHolderHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LegajoHolderHistory" ADD CONSTRAINT "LegajoHolderHistory_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegajoHolderHistory" ADD CONSTRAINT "LegajoHolderHistory_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
