/*
  Warnings:

  - Changed the type of `tipo` on the `historial_actividad` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoEventoAuditoria" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'MFA_SENT', 'MFA_SUCCESS', 'MFA_FAILED', 'ROLE_CHANGED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'PASSWORD_CHANGED', 'EMAIL_CHANGED', 'EMAIL_VERIFIED', 'PROFILE_UPDATED', 'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_DELETED', 'SESSION_TERMINATED', 'ALL_SESSIONS_TERMINATED', 'MFA_REENROLL', 'USER_CREATED', 'USER_BLOCKED', 'USER_UNBLOCKED', 'MFA_RESET');

-- AlterTable
ALTER TABLE "historial_actividad" ADD COLUMN     "adminId" TEXT,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoEventoAuditoria" NOT NULL;

-- AddForeignKey
ALTER TABLE "historial_actividad" ADD CONSTRAINT "historial_actividad_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
