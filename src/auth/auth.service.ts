import { BadRequestException, ForbiddenException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
	) {}

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
		const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;
		return { usuario: { nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo, rol: usuario.rol, nombreCompleto }, statusCode: HttpStatus.CREATED };
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
		await this.usersService.resetLoginState(usuario.id);
		const payload = { sub: usuario.id, rol: usuario.rol };
		const accessToken = await this.jwtService.signAsync(payload);
		const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;
		return { accessToken, usuario: { nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo, rol: usuario.rol, nombreCompleto }, statusCode: HttpStatus.OK };
	}
}


