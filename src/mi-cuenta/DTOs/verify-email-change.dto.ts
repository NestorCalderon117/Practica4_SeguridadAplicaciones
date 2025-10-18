import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailChangeDto {
  @IsString()
  @IsNotEmpty()
  codigoVerificacion: string;
}
