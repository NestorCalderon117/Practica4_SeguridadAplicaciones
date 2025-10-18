-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('ABIERTO', 'EN_PROGRESO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CategoriaTicket" AS ENUM ('TECNICO', 'FACTURACION', 'GENERAL', 'BUG_REPORT', 'FEATURE_REQUEST');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "CategoriaTicket" NOT NULL DEFAULT 'GENERAL',
    "estado" "EstadoTicket" NOT NULL DEFAULT 'ABIERTO',
    "prioridad" INTEGER NOT NULL DEFAULT 3,
    "usuarioId" TEXT NOT NULL,
    "creado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado" TIMESTAMP(3) NOT NULL,
    "cerrado" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
