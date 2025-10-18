import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  razon: string;

  @IsString()
  @IsOptional()
  duracion?: string; // "1h", "24h", "7d", "permanent"
}
