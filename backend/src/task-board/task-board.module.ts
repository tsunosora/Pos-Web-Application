import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TaskBoardService } from './task-board.service';
import { TaskBoardController } from './task-board.controller';
import { TaskBoardCron } from './task-board.cron';

@Module({
  imports: [PrismaModule],
  controllers: [TaskBoardController],
  providers: [TaskBoardService, TaskBoardCron],
})
export class TaskBoardModule {}
