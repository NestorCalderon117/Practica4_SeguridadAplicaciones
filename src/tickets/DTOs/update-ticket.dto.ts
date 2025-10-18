import { IsString, IsOptional, IsEnum, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';
import { CategoriaTicket, EstadoTicket } from '@prisma/client';

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(100)
  titulo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  descripcion?: string;

  @IsEnum(CategoriaTicket)
  @IsOptional()
  categoria?: CategoriaTicket;

  @IsEnum(EstadoTicket)
  @IsOptional()
  estado?: EstadoTicket;

  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  prioridad?: number; // 1=Alta, 2=Media, 3=Baja
}
