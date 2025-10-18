import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

export class VerifyResetCodeDto {
	@IsEmail({}, { message: 'El correo no es válido' })
	@IsNotEmpty({ message: 'El correo es requerido' })
	correo!: string;

	@IsString({ message: 'El código de verificación debe ser una cadena de texto' })
	@IsNotEmpty({ message: 'El código de verificación es requerido' })
	@Length(6, 6, { message: 'El código de verificación debe tener exactamente 6 dígitos' })
	codigoVerificacion!: string;
}
