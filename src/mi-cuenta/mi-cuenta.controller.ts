import { 
  Controller, 
  Get, 
  Put, 
  Post, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MiCuentaService } from './mi-cuenta.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateProfileDto } from './DTOs/update-profile.dto';
import { ChangePasswordDto } from './DTOs/change-password.dto';
import { VerifyEmailChangeDto } from './DTOs/verify-email-change.dto';
import { ReenrollMfaDto } from './DTOs/reenroll-mfa.dto';
import { TerminateSessionDto } from './DTOs/terminate-session.dto';

@Controller('mi-cuenta')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MiCuentaController {
  constructor(private readonly miCuentaService: MiCuentaService) {}

  // Perfil: ver/editar nombre y correo
  @Get('perfil')
  @Roles('CLIENTE', 'ADMIN')
  async getProfile(@Request() req) {
    return this.miCuentaService.getProfile(req.user.userId);
  }

  @Put('perfil')
  @Roles('CLIENTE', 'ADMIN')
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.miCuentaService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('perfil/verificar-correo')
  @Roles('CLIENTE', 'ADMIN')
  async verifyEmailChange(@Request() req, @Body() verifyEmailChangeDto: VerifyEmailChangeDto) {
    return this.miCuentaService.verifyEmailChange(req.user.userId, verifyEmailChangeDto.codigoVerificacion);
  }

  // Cambio de contraseña
  @Put('contrasenia')
  @Roles('CLIENTE', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.miCuentaService.changePassword(req.user.userId, changePasswordDto);
  }

  // MFA: re-enrolamiento y gestión de dispositivos
  @Post('mfa/reenroll')
  @Roles('CLIENTE', 'ADMIN')
  async reenrollMfa(@Request() req, @Body() reenrollMfaDto: ReenrollMfaDto) {
    return this.miCuentaService.reenrollMfa(req.user.userId, reenrollMfaDto);
  }

  @Get('mfa/dispositivos')
  @Roles('CLIENTE', 'ADMIN')
  async getMfaDevices(@Request() req) {
    return this.miCuentaService.getMfaDevices(req.user.userId);
  }

  // Sesiones activas
  @Get('sesiones')
  @Roles('CLIENTE', 'ADMIN')
  async getActiveSessions(@Request() req) {
    return this.miCuentaService.getActiveSessions(req.user.userId);
  }

  @Delete('sesiones/:sessionId')
  @Roles('CLIENTE', 'ADMIN')
  async terminateSession(@Request() req, @Param('sessionId') sessionId: string) {
    return this.miCuentaService.terminateSession(req.user.userId, { sessionId });
  }

  @Delete('sesiones')
  @Roles('CLIENTE', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async terminateAllOtherSessions(@Request() req, @Query('currentSessionId') currentSessionId: string) {
    return this.miCuentaService.terminateAllOtherSessions(req.user.userId, currentSessionId);
  }

  // Historial de actividad
  @Get('historial')
  @Roles('CLIENTE', 'ADMIN')
  async getActivityHistory(@Request() req, @Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.miCuentaService.getActivityHistory(req.user.userId, limitNumber);
  }
}
