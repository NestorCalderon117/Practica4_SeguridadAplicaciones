import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './DTOs/create-ticket.dto';
import { UpdateTicketDto } from './DTOs/update-ticket.dto';
import { TicketQueryDto } from './DTOs/ticket-query.dto';
import { CategoriaTicket, EstadoTicket } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear un nuevo ticket
  async createTicket(userId: string, createTicketDto: CreateTicketDto) {
    const { titulo, descripcion, categoria, prioridad } = createTicketDto;

    const ticket = await this.prisma.ticket.create({
      data: {
        titulo,
        descripcion,
        categoria: categoria || CategoriaTicket.GENERAL,
        prioridad: prioridad || 3,
        usuarioId: userId,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            correo: true,
          },
        },
      },
    });

    return {
      ticket,
      statusCode: 201,
    };
  }

  // Obtener todos los tickets del usuario con filtros
  async getTickets(userId: string, query: TicketQueryDto) {
    const { estado, categoria, prioridad, limit = 10, offset = 0 } = query;

    const where: any = {
      usuarioId: userId,
    };

    if (estado) {
      where.estado = estado;
    }

    if (categoria) {
      where.categoria = categoria;
    }

    if (prioridad) {
      where.prioridad = prioridad;
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              correo: true,
            },
          },
        },
        orderBy: [
          { prioridad: 'asc' },
          { creado: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      statusCode: 200,
    };
  }

  // Obtener un ticket específico por ID
  async getTicketById(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            correo: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    // Verificar que el ticket pertenece al usuario
    if (ticket.usuarioId !== userId) {
      throw new ForbiddenException('No tienes permisos para acceder a este ticket');
    }

    return {
      ticket,
      statusCode: 200,
    };
  }

  // Actualizar un ticket
  async updateTicket(userId: string, ticketId: string, updateTicketDto: UpdateTicketDto) {
    // Primero verificar que el ticket existe y pertenece al usuario
    const existingTicket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!existingTicket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    if (existingTicket.usuarioId !== userId) {
      throw new ForbiddenException('No tienes permisos para modificar este ticket');
    }

    // Validaciones específicas para el estado
    if (updateTicketDto.estado) {
      await this.validateStateTransition(existingTicket.estado, updateTicketDto.estado);
    }

    const updateData: any = { ...updateTicketDto };

    // Si se está cerrando el ticket, agregar fecha de cierre
    if (updateTicketDto.estado === EstadoTicket.CERRADO && existingTicket.estado !== EstadoTicket.CERRADO) {
      updateData.cerrado = new Date();
    }

    // Si se está reabriendo el ticket, quitar fecha de cierre
    if (updateTicketDto.estado && updateTicketDto.estado !== EstadoTicket.CERRADO && existingTicket.estado === EstadoTicket.CERRADO) {
      updateData.cerrado = null;
    }

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            correo: true,
          },
        },
      },
    });

    return {
      ticket,
      statusCode: 200,
    };
  }

  // Eliminar un ticket
  async deleteTicket(userId: string, ticketId: string) {
    // Verificar que el ticket existe y pertenece al usuario
    const existingTicket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!existingTicket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    if (existingTicket.usuarioId !== userId) {
      throw new ForbiddenException('No tienes permisos para eliminar este ticket');
    }

    // No permitir eliminar tickets que están en progreso
    if (existingTicket.estado === EstadoTicket.EN_PROGRESO) {
      throw new BadRequestException('No se puede eliminar un ticket que está en progreso');
    }

    await this.prisma.ticket.delete({
      where: { id: ticketId },
    });

    return {
      mensaje: 'Ticket eliminado exitosamente',
      statusCode: 200,
    };
  }

  // Obtener estadísticas de tickets del usuario
  async getTicketStats(userId: string) {
    const stats = await this.prisma.ticket.groupBy({
      by: ['estado'],
      where: { usuarioId: userId },
      _count: {
        estado: true,
      },
    });

    const totalTickets = await this.prisma.ticket.count({
      where: { usuarioId: userId },
    });

    const statsByCategory = await this.prisma.ticket.groupBy({
      by: ['categoria'],
      where: { usuarioId: userId },
      _count: {
        categoria: true,
      },
    });

    return {
      estadisticas: {
        total: totalTickets,
        porEstado: stats.reduce((acc, stat) => {
          acc[stat.estado] = stat._count.estado;
          return acc;
        }, {} as Record<string, number>),
        porCategoria: statsByCategory.reduce((acc, stat) => {
          acc[stat.categoria] = stat._count.categoria;
          return acc;
        }, {} as Record<string, number>),
      },
      statusCode: 200,
    };
  }

  // Métodos auxiliares privados
  private async validateStateTransition(currentState: EstadoTicket, newState: EstadoTicket) {
    const validTransitions: Record<EstadoTicket, EstadoTicket[]> = {
      [EstadoTicket.ABIERTO]: [EstadoTicket.EN_PROGRESO, EstadoTicket.CERRADO, EstadoTicket.CANCELADO],
      [EstadoTicket.EN_PROGRESO]: [EstadoTicket.ABIERTO, EstadoTicket.CERRADO, EstadoTicket.CANCELADO],
      [EstadoTicket.CERRADO]: [EstadoTicket.ABIERTO],
      [EstadoTicket.CANCELADO]: [EstadoTicket.ABIERTO],
    };

    if (!validTransitions[currentState].includes(newState)) {
      throw new BadRequestException(
        `No se puede cambiar el estado de ${currentState} a ${newState}. Transiciones válidas: ${validTransitions[currentState].join(', ')}`
      );
    }
  }
}
