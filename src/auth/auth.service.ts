import { BadRequestException, ForbiddenException, HttpStatus, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import * as brevo from '@getbrevo/brevo';
import { ValidateMfaDto } from './DTOs/validate-mfa.dto';

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	private readonly apiInstance: brevo.TransactionalEmailsApi;

	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
	) {
		const apiKey = process.env.BREVO_API_KEY!;
		this.apiInstance = new brevo.TransactionalEmailsApi();
		this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
	}

	async register(data: { nombre: string; apellido: string; correo: string; contrasenia: string }) {
		if (!data.contrasenia || data.contrasenia.length < 8) {
			throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
		}
		const hash = await argon2.hash(data.contrasenia, { type: argon2.argon2id });
		const usuario = await this.usersService.createUser({
			nombre: data.nombre,
			apellido: data.apellido,
			correo: data.correo,
			contraseniaHash: hash,
		});
		
		// Generar y enviar token MFA después del registro
		await this.generateMfaToken(usuario);
		
		return { 
			usuario: { 
				correo: usuario.correo,
				correoVerificado: usuario.correoVerificado,
			}, 
			statusCode: HttpStatus.CREATED 
		};
	}

	private isLocked(now: Date, bloqueadoHasta: Date | null | undefined): boolean {
		return !!(bloqueadoHasta && now < bloqueadoHasta);
	}

	private nextLockUntil(now: Date, intentosFallidos: number): Date | null {
		if (intentosFallidos < 5) return null;
		// bloqueo exponencial simple: 2^(n-5) minutos, max 30m
		const minutes = Math.min(30, Math.pow(2, intentosFallidos - 5));
		return new Date(now.getTime() + minutes * 60 * 1000);
	}

	async login(data: { correo: string; contrasenia: string }) {
		const usuario = await this.usersService.findByCorreo(data.correo);
		if (!usuario || !usuario.estaActivo) {
			throw new UnauthorizedException('Credenciales inválidas');
		}
		const now = new Date();
		if (this.isLocked(now, usuario.bloqueadoHasta)) {
			throw new ForbiddenException('Cuenta bloqueada temporalmente. Intenta más tarde');
		}
		const ok = await argon2.verify(usuario.contraseniaHash, data.contrasenia);
		if (!ok) {
			const bloqueadoHasta = this.nextLockUntil(now, usuario.intentosFallidos + 1);
			await this.usersService.increaseFailedAttempts(usuario.id, bloqueadoHasta);
			throw new UnauthorizedException('Credenciales inválidas');
		}
		
		// Siempre generar y enviar token MFA después de login exitoso
		await this.generateMfaToken(usuario);
		
		await this.usersService.resetLoginState(usuario.id);
		return { 
			usuario: { 
				correo: usuario.correo,
				correoVerificado: usuario.correoVerificado,
			}, 
			statusCode: HttpStatus.OK 
		};
	}

	private async generateMfaToken(usuario: any) {
		const mfaToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
		const mfaTokenExpiraEn = new Date();
		mfaTokenExpiraEn.setMinutes(mfaTokenExpiraEn.getMinutes() + 5); // 5 minutes

		await this.usersService.updateMfaToken(usuario.id, mfaToken, mfaTokenExpiraEn);

		return await this.sendMfaToken(usuario.correo, mfaToken);
	}

	private async sendMfaToken(email: string, mfaToken: string) {
		const sendSmtpEmail = new brevo.SendSmtpEmail();
		
		sendSmtpEmail.subject = 'Código de Verificación - MFA';
		sendSmtpEmail.htmlContent = `
			<html>
				<body>
					<h2>Código de Verificación</h2>
					<p>Tu código de verificación es: <strong>${mfaToken}</strong></p>
					<p>Este código expira en 5 minutos.</p>
					<p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
				</body>
			</html>
		`;
		sendSmtpEmail.sender = {
			email: process.env.BREVO_SENDER_EMAIL!,
			name: 'Sistema de Verificación',
		};
		sendSmtpEmail.to = [{ email }];
		sendSmtpEmail.headers = {
			'X-Entity-Ref-ID': 'mfa-verification'
		};

		try {
			const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
			this.logger.log(`MFA token sent successfully to ${email}`);
			return { message: 'Código de verificación enviado' };
		} catch (error) {
			this.logger.error(`Error sending MFA token to ${email}: ${error.message}`);
			throw new BadRequestException('Error enviando el código de verificación');
		}
	}

	async validateMfaToken(validateMfaDto: ValidateMfaDto) {
		const { correo, mfaToken } = validateMfaDto;

		const usuario = await this.usersService.findByCorreo(correo);

		if (
			!usuario ||
			!usuario.mfaToken ||
			usuario.mfaToken !== mfaToken ||
			!usuario.mfaTokenExpiraEn ||
			new Date() > new Date(usuario.mfaTokenExpiraEn)
		) {
			throw new BadRequestException(
				'Código de verificación inválido o expirado',
			);
		}

		// Verificar correo y limpiar token MFA
		await this.usersService.verifyEmail(usuario.id);

		// Generar JWT token para el usuario verificado
		const payload = { sub: usuario.id, rol: usuario.rol };
		const accessToken = await this.jwtService.signAsync(payload);
		const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;

		return { 
			accessToken,
			usuario: { 
				nombre: usuario.nombre, 
				apellido: usuario.apellido, 
				correo: usuario.correo, 
				rol: usuario.rol, 
				nombreCompleto 
			},
			statusCode: HttpStatus.OK 
		};
	}

	async resendMfaToken(correo: string) {
		const usuario = await this.usersService.findByCorreo(correo);
		
		if (!usuario) {
			throw new BadRequestException('Usuario no encontrado');
		}

		if (!usuario.estaActivo) {
			throw new BadRequestException('El usuario no está activo');
		}

		await this.generateMfaToken(usuario);

		return { 
			message: 'Se ha enviado un nuevo código de verificación a tu correo.',
			statusCode: HttpStatus.OK 
		};
	}
}


