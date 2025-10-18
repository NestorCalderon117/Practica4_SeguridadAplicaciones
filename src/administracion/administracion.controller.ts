import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdministracionService } from './administracion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './DTOs/create-user.dto';
import { UpdateUserDto } from './DTOs/update-user.dto';
import { UsersQueryDto } from './DTOs/users-query.dto';
import { AuditQueryDto } from './DTOs/audit-query.dto';
import { BlockUserDto } from './DTOs/block-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdministracionController {
  constructor(private readonly administracionService: AdministracionService) {}

  // ========== GESTIÓN DE USUARIOS ==========

  // Crear un nuevo usuario
  @Post('users')
  @Roles('ADMIN')
  async createUser(@Request() req, @Body() createUserDto: CreateUserDto) {
    return this.administracionService.createUser(req.user.userId, createUserDto);
  }

  // Listar usuarios con filtros
  @Get('users')
  @Roles('ADMIN')
  async getUsers(@Query() query: UsersQueryDto) {
    return this.administracionService.getUsers(query);
  }

  // Obtener usuario por ID
  @Get('users/:id')
  @Roles('ADMIN')
  async getUserById(@Param('id') id: string) {
    return this.administracionService.getUserById(id);
  }

  // Actualizar usuario
  @Put('users/:id')
  @Roles('ADMIN')
  async updateUser(
    @Request() req, 
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.administracionService.updateUser(req.user.userId, id, updateUserDto);
  }

  // Bloquear usuario
  @Put('users/:id/block')
  @Roles('ADMIN')
  async blockUser(
    @Request() req, 
    @Param('id') id: string, 
    @Body() blockUserDto: BlockUserDto
  ) {
    return this.administracionService.blockUser(req.user.userId, id, blockUserDto);
  }

  // Desbloquear usuario
  @Put('users/:id/unblock')
  @Roles('ADMIN')
  async unblockUser(@Request() req, @Param('id') id: string) {
    return this.administracionService.unblockUser(req.user.userId, id);
  }

  // Reset MFA
  @Put('users/:id/reset-mfa')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async resetMfa(@Request() req, @Param('id') id: string) {
    return this.administracionService.resetMfa(req.user.userId, id);
  }

  // ========== AUDITORÍA ==========

  // Obtener historial de auditoría
  @Get('audit')
  @Roles('ADMIN')
  async getAuditLog(@Query() query: AuditQueryDto) {
    return this.administracionService.getAuditLog(query);
  }

  // Obtener estadísticas de auditoría
  @Get('audit/stats')
  @Roles('ADMIN')
  async getAuditStats() {
    return this.administracionService.getAuditStats();
  }
}
