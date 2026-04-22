import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DesignersService } from './designers.service';
import { DesignersPublicController, DesignersAdminController } from './designers.controller';

@Module({
    imports: [PrismaModule],
    controllers: [DesignersPublicController, DesignersAdminController],
    providers: [DesignersService],
    exports: [DesignersService],
})
export class DesignersModule {}
