import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";




export class RegisterDto {
	@IsString({ message: 'El nombre debe ser una cadena de texto' })
	@IsNotEmpty({ message: 'El nombre es requerido' })
	nombre!: string;

	@IsString({ message: 'El apellido debe ser una cadena de texto' })
	@IsNotEmpty({ message: 'El apellido es requerido' })
	apellido!: string;

	@IsEmail({}, { message: 'El correo no es válido' })
	@IsNotEmpty({ message: 'El correo es requerido' })
	correo!: string;

	@IsString({ message: 'La contraseña debe ser una cadena de texto' })
	@MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
	@IsNotEmpty({ message: 'La contraseña es requerida' })
	contrasenia!: string;
}