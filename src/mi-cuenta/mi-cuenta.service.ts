import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoEventoAuditoria } from '@prisma/client';
import * as argon2 from 'argon2';
import * as brevo from '@getbrevo/brevo';
import { UpdateProfileDto } from './DTOs/update-profile.dto';
import { ChangePasswordDto } from './DTOs/change-password.dto';
import { ReenrollMfaDto } from './DTOs/reenroll-mfa.dto';
import { TerminateSessionDto } from './DTOs/terminate-session.dto';

@Injectable()
export class MiCuentaService {
  private readonly logger = new Logger(MiCuentaService.name);
  private readonly apiInstance: brevo.TransactionalEmailsApi;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.BREVO_API_KEY!;
    this.apiInstance = new brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  }

  // Obtener perfil del usuario
  async getProfile(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        correoVerificado: true,
        creado: true,
        actualizado: true,
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

  // Actualizar perfil del usuario
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { nombre, apellido, correo } = updateProfileDto;

    // Verificar si el usuario existe
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuarioExistente) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si el correo cambió, verificar que no esté en uso y enviar verificación
    if (correo !== usuarioExistente.correo) {
      const correoEnUso = await this.prisma.usuario.findUnique({
        where: { correo: correo.toLowerCase() },
      });

      if (correoEnUso && correoEnUso.id !== userId) {
        throw new ConflictException('El correo ya está en uso por otro usuario');
      }

      // Generar código de verificación para el nuevo correo
      await this.generateEmailVerificationCode(userId, correo);
    }

    // Actualizar datos del usuario
    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        nombre,
        apellido,
        correo: correo.toLowerCase(),
        ...(correo !== usuarioExistente.correo && { correoVerificado: false }),
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        correoVerificado: true,
        actualizado: true,
      },
    });

    // Registrar actividad
    await this.registrarActividad(userId, TipoEventoAuditoria.PROFILE_UPDATED, 'Perfil actualizado', {
      cambios: {
        nombre: { anterior: usuarioExistente.nombre, nuevo: nombre },
        apellido: { anterior: usuarioExistente.apellido, nuevo: apellido },
        correo: { anterior: usuarioExistente.correo, nuevo: correo },
      },
    });

    return {
      usuario: usuarioActualizado,
      mensaje: correo !== usuarioExistente.correo 
        ? 'Perfil actualizado. Se ha enviado un código de verificación al nuevo correo.'
        : 'Perfil actualizado exitosamente.',
      statusCode: 200,
    };
  }

  // Cambiar contraseña
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { contraseniaActual, nuevaContrasenia, confirmarContrasenia } = changePasswordDto;

    // Verificar que las contraseñas coincidan
    if (nuevaContrasenia !== confirmarContrasenia) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    // Obtener usuario
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const contraseniaValida = await argon2.verify(usuario.contraseniaHash, contraseniaActual);
    if (!contraseniaValida) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    // Verificar que no sea la misma contraseña
    const mismaContrasenia = await argon2.verify(usuario.contraseniaHash, nuevaContrasenia);
    if (mismaContrasenia) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    // Verificar historial de contraseñas (últimas 5)
    const historialContrasenias = await this.prisma.historialContrasenia.findMany({
      where: { usuarioId: userId },
      orderBy: { fechaCreacion: 'desc' },
      take: 5,
    });

    for (const historial of historialContrasenias) {
      const contraseniaUsada = await argon2.verify(historial.contraseniaHash, nuevaContrasenia);
      if (contraseniaUsada) {
        throw new BadRequestException('No puedes usar una contraseña que ya has utilizado anteriormente');
      }
    }

    // Hashear nueva contraseña
    const nuevaContraseniaHash = await argon2.hash(nuevaContrasenia, { type: argon2.argon2id });

    // Actualizar contraseña y guardar en historial
    await this.prisma.$transaction(async (tx) => {
      // Guardar contraseña anterior en historial
      await tx.historialContrasenia.create({
        data: {
          usuarioId: userId,
          contraseniaHash: usuario.contraseniaHash,
        },
      });

      // Actualizar contraseña actual
      await tx.usuario.update({
        where: { id: userId },
        data: {
          contraseniaHash: nuevaContraseniaHash,
        },
      });
    });

    // Registrar actividad
    await this.registrarActividad(userId, TipoEventoAuditoria.PASSWORD_CHANGED, 'Contraseña cambiada exitosamente');

    return {
      mensaje: 'Contraseña actualizada exitosamente',
      statusCode: 200,
    };
  }

  // Re-enrolamiento MFA
  async reenrollMfa(userId: string, reenrollMfaDto: ReenrollMfaDto) {
    const { tipoDispositivo, nombreDispositivo } = reenrollMfaDto;

    // Verificar que el usuario existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Crear nuevo dispositivo MFA
    const dispositivo = await this.prisma.dispositivoMfa.create({
      data: {
        usuarioId: userId,
        tipo: tipoDispositivo,
        nombre: nombreDispositivo,
        activo: true,
      },
    });

    // Registrar actividad
    await this.registrarActividad(userId, TipoEventoAuditoria.MFA_REENROLL, `Dispositivo MFA registrado: ${nombreDispositivo}`, {
      dispositivoId: dispositivo.id,
      tipo: tipoDispositivo,
    });

    return {
      dispositivo,
      mensaje: 'Dispositivo MFA registrado exitosamente',
      statusCode: 201,
    };
  }

  // Obtener dispositivos MFA
  async getMfaDevices(userId: string) {
    const dispositivos = await this.prisma.dispositivoMfa.findMany({
      where: { usuarioId: userId, activo: true },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        ultimoUso: true,
        creado: true,
      },
      orderBy: { creado: 'desc' },
    });

    return {
      dispositivos,
      statusCode: 200,
    };
  }

  // Obtener sesiones activas
  async getActiveSessions(userId: string) {
    const sesiones = await this.prisma.sesionUsuario.findMany({
      where: { 
        usuarioId: userId, 
        activa: true,
        expiraEn: { gt: new Date() },
      },
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        ipAddress: true,
        ubicacion: true,
        ultimaActividad: true,
        expiraEn: true,
        creada: true,
      },
      orderBy: { ultimaActividad: 'desc' },
    });

    return {
      sesiones,
      statusCode: 200,
    };
  }

  // Terminar sesión específica
  async terminateSession(userId: string, terminateSessionDto: TerminateSessionDto) {
    const { sessionId } = terminateSessionDto;

    const sesion = await this.prisma.sesionUsuario.findFirst({
      where: { 
        id: sessionId, 
        usuarioId: userId,
        activa: true,
      },
    });

    if (!sesion) {
      throw new NotFoundException('Sesión no encontrada');
    }

    await this.prisma.sesionUsuario.update({
      where: { id: sessionId },
      data: { activa: false },
    });

    // Registrar actividad
    await this.registrarActividad(userId, TipoEventoAuditoria.SESSION_TERMINATED, 'Sesión terminada manualmente', {
      sessionId,
      deviceId: sesion.deviceId,
    });

    return {
      mensaje: 'Sesión terminada exitosamente',
      statusCode: 200,
    };
  }

  // Terminar todas las sesiones excepto la actual
  async terminateAllOtherSessions(userId: string, currentSessionId: string) {
    await this.prisma.sesionUsuario.updateMany({
      where: { 
        usuarioId: userId, 
        activa: true,
        id: { not: currentSessionId },
      },
      data: { activa: false },
    });

    // Registrar actividad
    await this.registrarActividad(userId, TipoEventoAuditoria.ALL_SESSIONS_TERMINATED, 'Todas las sesiones excepto la actual fueron terminadas');

    return {
      mensaje: 'Todas las demás sesiones han sido terminadas',
      statusCode: 200,
    };
  }

  // Obtener historial de actividad
  async getActivityHistory(userId: string, limit: number = 20) {
    const actividades = await this.prisma.historialActividad.findMany({
      where: { usuarioId: userId },
      select: {
        id: true,
        tipo: true,
        descripcion: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        fecha: true,
      },
      orderBy: { fecha: 'desc' },
      take: limit,
    });

    return {
      actividades,
      statusCode: 200,
    };
  }

  // Verificar cambio de correo
  async verifyEmailChange(userId: string, codigoVerificacion: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      !usuario.mfaToken ||
      usuario.mfaToken !== codigoVerificacion ||
      !usuario.mfaTokenExpiraEn ||
      new Date() > new Date(usuario.mfaTokenExpiraEn)
    ) {
      throw new BadRequestException('Código de verificación inválido o expirado');
    }

    // Verificar correo y limpiar token
    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        correoVerificado: true,
        mfaToken: null,
        mfaTokenExpiraEn: null,
      },
    });

    // Registrar actividad
    await this.registrarActividad(userId, TipoEventoAuditoria.EMAIL_VERIFIED, 'Correo verificado exitosamente');

    return {
      mensaje: 'Correo verificado exitosamente',
      statusCode: 200,
    };
  }

  // Métodos privados auxiliares
  private async generateEmailVerificationCode(userId: string, nuevoCorreo: string) {
    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEn = new Date();
    expiraEn.setMinutes(expiraEn.getMinutes() + 15); // 15 minutos

    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        mfaToken: codigoVerificacion,
        mfaTokenExpiraEn: expiraEn,
      },
    });

    await this.sendEmailVerificationCode(nuevoCorreo, codigoVerificacion);
  }

  private async sendEmailVerificationCode(email: string, codigo: string) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = 'Verificación de Cambio de Correo';
    sendSmtpEmail.htmlContent = `
      <html>
        <body>
          <h2>Verificación de Cambio de Correo</h2>
          <p>Tu código de verificación es: <strong>${codigo}</strong></p>
          <p>Este código expira en 15 minutos.</p>
          <p>Si no solicitaste este cambio, contacta a soporte inmediatamente.</p>
        </body>
      </html>
    `;
    sendSmtpEmail.sender = {
      email: process.env.BREVO_SENDER_EMAIL!,
      name: 'Sistema de Verificación',
    };
    sendSmtpEmail.to = [{ email }];
    sendSmtpEmail.headers = {
      'X-Entity-Ref-ID': 'email-change-verification'
    };

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Email verification code sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Error sending email verification code to ${email}: ${error.message}`);
      throw new BadRequestException('Error enviando el código de verificación');
    }
  }

  private async registrarActividad(
    userId: string, 
    tipo: TipoEventoAuditoria, 
    descripcion: string, 
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    await this.prisma.historialActividad.create({
      data: {
        usuarioId: userId,
        tipo,
        descripcion,
        metadata,
        ipAddress,
        userAgent,
      },
    });
  }
}
