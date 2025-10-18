import { IsString, IsNotEmpty, IsEmail, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Rol } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  apellido: string;

  @IsEmail()
  @IsNotEmpty()
  correo: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  contrasenia: string;

  @IsEnum(Rol)
  @IsOptional()
  rol?: Rol;
}
