-- AddForeignKey
ALTER TABLE "Legajo" ADD CONSTRAINT "Legajo_currentHolderId_fkey" FOREIGN KEY ("currentHolderId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
