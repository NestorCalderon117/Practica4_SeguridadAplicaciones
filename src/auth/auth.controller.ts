import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

class RegisterDto {
	@IsString()
	@IsNotEmpty()
	nombre!: string;

	@IsString()
	@IsNotEmpty()
	apellido!: string;

	@IsEmail()
	correo!: string;

	@IsString()
	@MinLength(8)
	contrasenia!: string;
}

class LoginDto {
	@IsEmail()
	correo!: string;

	@IsString()
	@MinLength(8)
	contrasenia!: string;
}

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
}


