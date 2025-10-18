import { IsString, IsNotEmpty, MinLength, MaxLength, IsEmail, Matches } from 'class-validator';

export class UpdateProfileDto {
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
}
