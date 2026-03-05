import { Module } from '@nestjs/common';
import { HppService } from './hpp.service';
import { HppController } from './hpp.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [HppController],
    providers: [HppService],
})
export class HppModule { }
