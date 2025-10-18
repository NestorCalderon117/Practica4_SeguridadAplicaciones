import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './DTOs/create-user.dto';
import { UpdateUserDto } from './DTOs/update-user.dto';
import { UsersQueryDto } from './DTOs/users-query.dto';
import { AuditQueryDto } from './DTOs/audit-query.dto';
import { BlockUserDto } from './DTOs/block-user.dto';
import { Rol, TipoEventoAuditoria } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class AdministracionService {
  private readonly logger = new Logger(AdministracionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========== GESTIÓN DE USUARIOS ==========

  // Crear un nuevo usuario
  async createUser(adminId: string, createUserDto: CreateUserDto) {
    const { nombre, apellido, correo, contrasenia, rol } = createUserDto;

    // Verificar que el correo no esté en uso
    const existingUser = await this.prisma.usuario.findUnique({
      where: { correo: correo.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está en uso');
    }

    // Hashear contraseña
    const contraseniaHash = await argon2.hash(contrasenia, { type: argon2.argon2id });

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre,
        apellido,
        correo: correo.toLowerCase(),
        contraseniaHash,
        rol: rol || Rol.CLIENTE,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estaActivo: true,
        correoVerificado: true,
        creado: true,
        actualizado: true,
      },
    });

    // Registrar en auditoría
    await this.registrarAuditoria(
      usuario.id,
      TipoEventoAuditoria.USER_CREATED,
      `Usuario creado por administrador`,
      { adminId, rol: usuario.rol },
      adminId
    );

    return {
      usuario,
      statusCode: 201,
    };
  }

  // Listar usuarios con filtros
  async getUsers(query: UsersQueryDto) {
    const { rol, estaActivo, limit = 10, offset = 0, search } = query;

    const where: any = {};

    if (rol) {
      where.rol = rol;
    }

    if (estaActivo !== undefined) {
      where.estaActivo = estaActivo;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { correo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [usuarios, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          correo: true,
          rol: true,
          estaActivo: true,
          correoVerificado: true,
          intentosFallidos: true,
          bloqueadoHasta: true,
          creado: true,
          actualizado: true,
        },
        orderBy: { creado: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.usuario.count({ where }),
    ]);

    return {
      usuarios,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      statusCode: 200,
    };
  }

  // Obtener usuario por ID
  async getUserById(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estaActivo: true,
        correoVerificado: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
        creado: true,
        actualizado: true,
        _count: {
          select: {
            tickets: true,
            sesiones: true,
            historialActividad: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      usuario,
      statusCode: 200,
    };
  }

  // Actualizar usuario
  async updateUser(adminId: string, userId: string, updateUserDto: UpdateUserDto) {
    const existingUser = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updateData: any = { ...updateUserDto };

    // Si se está cambiando el rol, registrar en auditoría
    if (updateUserDto.rol && updateUserDto.rol !== existingUser.rol) {
      await this.registrarAuditoria(
        userId,
        TipoEventoAuditoria.ROLE_CHANGED,
        `Rol cambiado de ${existingUser.rol} a ${updateUserDto.rol}`,
        { 
          rolAnterior: existingUser.rol, 
          rolNuevo: updateUserDto.rol 
        },
        adminId
      );
    }

    const usuario = await this.prisma.usuario.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estaActivo: true,
        correoVerificado: true,
        actualizado: true,
      },
    });

    return {
      usuario,
      statusCode: 200,
    };
  }

  // Bloquear usuario
  async blockUser(adminId: string, userId: string, blockUserDto: BlockUserDto) {
    const { razon, duracion = 'permanent' } = blockUserDto;

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!usuario.estaActivo) {
      throw new BadRequestException('El usuario ya está bloqueado');
    }

    let bloqueadoHasta: Date | null = null;

    if (duracion !== 'permanent') {
      const now = new Date();
      switch (duracion) {
        case '1h':
          bloqueadoHasta = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '24h':
          bloqueadoHasta = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7d':
          bloqueadoHasta = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          throw new BadRequestException('Duración inválida. Use: 1h, 24h, 7d, o permanent');
      }
    }

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        estaActivo: false,
        bloqueadoHasta,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        estaActivo: true,
        bloqueadoHasta: true,
      },
    });

    // Registrar en auditoría
    await this.registrarAuditoria(
      userId,
      TipoEventoAuditoria.ACCOUNT_LOCKED,
      `Usuario bloqueado: ${razon}`,
      { 
        razon, 
        duracion, 
        bloqueadoHasta: bloqueadoHasta?.toISOString() 
      },
      adminId
    );

    return {
      usuario: usuarioActualizado,
      mensaje: `Usuario bloqueado exitosamente. Duración: ${duracion}`,
      statusCode: 200,
    };
  }

  // Desbloquear usuario
  async unblockUser(adminId: string, userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (usuario.estaActivo) {
      throw new BadRequestException('El usuario no está bloqueado');
    }

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        estaActivo: true,
        bloqueadoHasta: null,
        intentosFallidos: 0,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        estaActivo: true,
        bloqueadoHasta: true,
      },
    });

    // Registrar en auditoría
    await this.registrarAuditoria(
      userId,
      TipoEventoAuditoria.ACCOUNT_UNLOCKED,
      'Usuario desbloqueado por administrador',
      {},
      adminId
    );

    return {
      usuario: usuarioActualizado,
      mensaje: 'Usuario desbloqueado exitosamente',
      statusCode: 200,
    };
  }

  // Reset MFA
  async resetMfa(adminId: string, userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Limpiar tokens MFA y dispositivos
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: userId },
        data: {
          mfaToken: null,
          mfaTokenExpiraEn: null,
          correoVerificado: false,
        },
      });

      await tx.dispositivoMfa.updateMany({
        where: { usuarioId: userId },
        data: { activo: false },
      });
    });

    // Registrar en auditoría
    await this.registrarAuditoria(
      userId,
      TipoEventoAuditoria.MFA_RESET,
      'MFA reseteado por administrador',
      {},
      adminId
    );

    return {
      mensaje: 'MFA reseteado exitosamente. El usuario deberá reconfigurar MFA en su próximo login.',
      statusCode: 200,
    };
  }

  // ========== AUDITORÍA ==========

  // Obtener historial de auditoría con filtros
  async getAuditLog(query: AuditQueryDto) {
    const { 
      tipo, 
      usuarioId, 
      adminId, 
      fechaDesde, 
      fechaHasta, 
      limit = 20, 
      offset = 0 
    } = query;

    const where: any = {};

    if (tipo) {
      where.tipo = tipo;
    }

    if (usuarioId) {
      where.usuarioId = usuarioId;
    }

    if (adminId) {
      where.adminId = adminId;
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) {
        where.fecha.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        where.fecha.lte = new Date(fechaHasta);
      }
    }

    const [actividades, total] = await Promise.all([
      this.prisma.historialActividad.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              correo: true,
              rol: true,
            },
          },
          admin: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              correo: true,
            },
          },
        },
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.historialActividad.count({ where }),
    ]);

    return {
      actividades,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      statusCode: 200,
    };
  }

  // Obtener estadísticas de auditoría
  async getAuditStats() {
    const stats = await this.prisma.historialActividad.groupBy({
      by: ['tipo'],
      _count: {
        tipo: true,
      },
    });

    const totalEventos = await this.prisma.historialActividad.count();

    const eventosPorDia = await this.prisma.$queryRaw<Array<{ fecha: Date; cantidad: bigint }>>`
      SELECT 
        DATE(fecha) as fecha,
        COUNT(*) as cantidad
      FROM historial_actividad 
      WHERE fecha >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(fecha)
      ORDER BY fecha DESC
    `;

    return {
      estadisticas: {
        total: totalEventos,
        porTipo: stats.reduce((acc, stat) => {
          acc[stat.tipo] = stat._count.tipo;
          return acc;
        }, {} as Record<string, number>),
        eventosPorDia: eventosPorDia.map(item => ({
          fecha: item.fecha,
          cantidad: Number(item.cantidad)
        })),
      },
      statusCode: 200,
    };
  }

  // ========== MÉTODOS AUXILIARES ==========

  private async registrarAuditoria(
    usuarioId: string,
    tipo: TipoEventoAuditoria,
    descripcion: string,
    metadata?: any,
    adminId?: string
  ) {
    await this.prisma.historialActividad.create({
      data: {
        usuarioId,
        tipo,
        descripcion,
        metadata,
        adminId,
      },
    });
  }
}
