import { IsOptional, IsEnum, IsInt, Min, Max, IsDateString, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoEventoAuditoria } from '@prisma/client';

export class AuditQueryDto {
  @IsEnum(TipoEventoAuditoria)
  @IsOptional()
  tipo?: TipoEventoAuditoria;

  @IsString()
  @IsOptional()
  usuarioId?: string;

  @IsString()
  @IsOptional()
  adminId?: string;

  @IsDateString()
  @IsOptional()
  fechaDesde?: string;

  @IsDateString()
  @IsOptional()
  fechaHasta?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  offset?: number = 0;
}
