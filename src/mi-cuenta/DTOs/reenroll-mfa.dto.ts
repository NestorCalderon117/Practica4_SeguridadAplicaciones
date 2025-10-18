import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class ReenrollMfaDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['EMAIL', 'SMS', 'TOTP'])
  tipoDispositivo: string;

  @IsString()
  @IsNotEmpty()
  nombreDispositivo: string;
}
