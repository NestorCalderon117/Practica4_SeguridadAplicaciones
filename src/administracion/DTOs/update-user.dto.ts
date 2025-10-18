import { IsString, IsOptional, IsEnum, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { Rol } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  apellido?: string;

  @IsEnum(Rol)
  @IsOptional()
  rol?: Rol;

  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;
}
