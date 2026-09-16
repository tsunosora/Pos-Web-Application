import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TaskBoardService } from './task-board.service';
import { TaskBoardController } from './task-board.controller';
import { TaskBoardPinController } from './task-board-pin.controller';
import { TaskBoardCron } from './task-board.cron';
import { TaskPiketService } from './task-piket.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaskBoardController, TaskBoardPinController],
  providers: [TaskBoardService, TaskPiketService, TaskBoardCron],
})
export class TaskBoardModule {}
