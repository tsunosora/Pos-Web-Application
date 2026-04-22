import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController, CustomersPublicController } from './customers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CustomersPublicController, CustomersController],
    providers: [CustomersService],
})
export class CustomersModule { }
