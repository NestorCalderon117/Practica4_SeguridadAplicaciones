import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoriaTicket, EstadoTicket } from '@prisma/client';

export class TicketQueryDto {
  @IsEnum(EstadoTicket)
  @IsOptional()
  estado?: EstadoTicket;

  @IsEnum(CategoriaTicket)
  @IsOptional()
  categoria?: CategoriaTicket;

  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  prioridad?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  offset?: number = 0;
}
