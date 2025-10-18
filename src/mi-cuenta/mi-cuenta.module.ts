import { Module } from '@nestjs/common';
import { MiCuentaController } from './mi-cuenta.controller';
import { MiCuentaService } from './mi-cuenta.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MiCuentaController],
  providers: [MiCuentaService],
  exports: [MiCuentaService],
})
export class MiCuentaModule {}
