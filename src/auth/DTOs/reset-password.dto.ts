import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
	@IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
	@MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
	@IsNotEmpty({ message: 'La nueva contraseña es requerida' })
	nuevaContrasenia!: string;
}
