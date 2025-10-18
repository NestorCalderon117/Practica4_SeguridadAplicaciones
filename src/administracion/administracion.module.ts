import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdministracionController],
  providers: [AdministracionService],
  exports: [AdministracionService],
})
export class AdministracionModule {}
