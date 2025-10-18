import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTicketDto } from './DTOs/create-ticket.dto';
import { UpdateTicketDto } from './DTOs/update-ticket.dto';
import { TicketQueryDto } from './DTOs/ticket-query.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Crear un nuevo ticket
  @Post()
  @Roles('CLIENTE')
  async createTicket(@Request() req, @Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.createTicket(req.user.userId, createTicketDto);
  }

  // Obtener todos los tickets del usuario con filtros
  @Get()
  @Roles('CLIENTE')
  async getTickets(@Request() req, @Query() query: TicketQueryDto) {
    return this.ticketsService.getTickets(req.user.userId, query);
  }

  // Obtener estadísticas de tickets del usuario
  @Get('estadisticas')
  @Roles('CLIENTE')
  async getTicketStats(@Request() req) {
    return this.ticketsService.getTicketStats(req.user.userId);
  }

  // Obtener un ticket específico por ID
  @Get(':id')
  @Roles('CLIENTE')
  async getTicketById(@Request() req, @Param('id') id: string) {
    return this.ticketsService.getTicketById(req.user.userId, id);
  }

  // Actualizar un ticket
  @Put(':id')
  @Roles('CLIENTE')
  async updateTicket(
    @Request() req, 
    @Param('id') id: string, 
    @Body() updateTicketDto: UpdateTicketDto
  ) {
    return this.ticketsService.updateTicket(req.user.userId, id, updateTicketDto);
  }

  // Eliminar un ticket
  @Delete(':id')
  @Roles('CLIENTE')
  @HttpCode(HttpStatus.OK)
  async deleteTicket(@Request() req, @Param('id') id: string) {
    return this.ticketsService.deleteTicket(req.user.userId, id);
  }
}
