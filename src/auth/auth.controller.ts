import { Body, Controller, HttpCode, HttpStatus, Post, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './DTOs/register.dto';
import { LoginDto } from './DTOs/login.dto';
import { ValidateMfaDto } from './DTOs/validate-mfa.dto';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	async register(@Body() body: RegisterDto) {
		return this.authService.register(body);
	}

	@HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    @Post('login')
	async login(@Body() body: LoginDto) {
		return this.authService.login(body);
	}

	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 3, ttl: 60 } })
	@Post('validate-mfa')
	async validateMfa(@Body() body: ValidateMfaDto) {
		return this.authService.validateMfaToken(body);
	}

	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 3, ttl: 300 } }) // 3 intentos cada 5 minutos
	@Post('resend-mfa/:correo')
	async resendMfa(@Param('correo') correo: string) {
		return this.authService.resendMfaToken(correo);
	}
}


