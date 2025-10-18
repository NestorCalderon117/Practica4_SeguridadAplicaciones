import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Rol, Usuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	async createUser(data: {
		nombre: string;
		apellido: string;
		correo: string;
		contraseniaHash: string;
		rol?: Rol;
	}): Promise<Usuario> {
		try {
			return await this.prisma.usuario.create({
				data: {
					nombre: data.nombre,
					apellido: data.apellido,
					correo: data.correo.toLowerCase(),
					contraseniaHash: data.contraseniaHash,
					rol: data.rol ?? Rol.CLIENTE,
				},
			});
		} catch (error) {
			if (this.isUniqueViolation(error, 'User_correo_key')) {
				throw new ConflictException('El correo ya está registrado');
			}
			throw error;
		}
	}

	async findByCorreo(correo: string): Promise<Usuario | null> {
		return this.prisma.usuario.findUnique({ where: { correo: correo.toLowerCase() } });
	}

	async findById(id: string): Promise<Usuario> {
		const usuario = await this.prisma.usuario.findUnique({ where: { id } });
		if (!usuario) {
			throw new NotFoundException('Usuario no encontrado');
		}
		return usuario;
	}

	async resetLoginState(usuarioId: string): Promise<void> {
		await this.prisma.usuario.update({
			where: { id: usuarioId },
			data: { intentosFallidos: 0, bloqueadoHasta: null },
		});
	}

	async increaseFailedAttempts(usuarioId: string, bloqueadoHasta: Date | null): Promise<void> {
		await this.prisma.usuario.update({
			where: { id: usuarioId },
			data: {
				intentosFallidos: { increment: 1 },
				bloqueadoHasta,
			},
		});
	}

	async updateMfaToken(usuarioId: string, mfaToken: string, mfaTokenExpiraEn: Date): Promise<void> {
		await this.prisma.usuario.update({
			where: { id: usuarioId },
			data: {
				mfaToken,
				mfaTokenExpiraEn,
			},
		});
	}

	async verifyEmail(usuarioId: string): Promise<void> {
		await this.prisma.usuario.update({
			where: { id: usuarioId },
			data: {
				correoVerificado: true,
				mfaToken: null,
				mfaTokenExpiraEn: null,
			},
		});
	}

	async markResetCodeAsVerified(usuarioId: string): Promise<void> {
		await this.prisma.usuario.update({
			where: { id: usuarioId },
			data: {
				codigoRecuperacionVerificado: true,
			},
		});
	}

	async updatePassword(usuarioId: string, nuevaContraseniaHash: string): Promise<void> {
		await this.prisma.usuario.update({
			where: { id: usuarioId },
			data: {
				contraseniaHash: nuevaContraseniaHash,
				mfaToken: null,
				mfaTokenExpiraEn: null,
				codigoRecuperacionVerificado: false, // Resetear solo el flag de recuperación
				correoVerificado: true, // Marcar correo como verificado al cambiar contraseña
			},
		});
	}

	private isUniqueViolation(error: unknown, constraint: string): boolean {
		const e = error as Prisma.PrismaClientKnownRequestError;
		return e?.code === 'P2002' && Array.isArray((e as any).meta?.target) && (e as any).meta?.target.includes('correo');
	}
}


