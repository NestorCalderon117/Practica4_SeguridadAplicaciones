/*
  Warnings:

  - You are about to drop the column `mfaTokenExpiresAt` on the `Usuario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "mfaTokenExpiresAt",
ADD COLUMN     "correoVerificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaTokenExpiraEn" TIMESTAMP(3);
