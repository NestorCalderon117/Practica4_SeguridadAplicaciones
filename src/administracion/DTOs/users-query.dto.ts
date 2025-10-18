import { IsOptional, IsEnum, IsInt, Min, Max, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Rol } from '@prisma/client';

export class UsersQueryDto {
  @IsEnum(Rol)
  @IsOptional()
  rol?: Rol;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  estaActivo?: boolean;

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

  @IsString()
  @IsOptional()
  search?: string; // Para buscar por nombre, apellido o correo
}
