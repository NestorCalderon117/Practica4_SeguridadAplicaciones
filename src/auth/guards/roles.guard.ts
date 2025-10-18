import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
			context.getHandler(),
			context.getClass(),
		]);
		if (!requiredRoles || requiredRoles.length === 0) return true;
		const request = context.switchToHttp().getRequest();
		const usuario = request.user as { userId: string; role: string } | undefined;
		if (!usuario || !requiredRoles.includes(usuario.role)) {
			throw new ForbiddenException('No tienes permisos para acceder a este recurso');
		}
		return true;
	}
}


