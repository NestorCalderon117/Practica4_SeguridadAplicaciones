import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get(':id')
	async getById(@Param('id') id: string) {
		const user = await this.usersService.findById(id);
		return { id: user.id, nombre: user.nombre, apellido: user.apellido, correo: user.correo, rol: user.rol };
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	async me(@Req() req: any) {
		return { id: req.user.userId, rol: req.user.role };
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	@Get('admin/ping')
	adminPing() {
		return { ok: true };
	}
}


