import { IsEmail, IsNotEmpty } from "class-validator";

export class ForgotPasswordDto {
	@IsEmail({}, { message: 'El correo no es válido' })
	@IsNotEmpty({ message: 'El correo es requerido' })
	correo!: string;
}
