import { IsString, IsNotEmpty } from 'class-validator';

export class TerminateSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
