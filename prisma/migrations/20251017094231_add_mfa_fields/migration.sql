-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "mfaToken" TEXT,
ADD COLUMN     "mfaTokenExpiresAt" TIMESTAMP(3);
