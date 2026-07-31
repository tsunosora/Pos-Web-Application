import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
  MaxLength,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

const FREQ = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'];
const PRIO = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUS = ['TODO', 'IN_PROGRESS', 'DONE'];

export class CreateScheduleDto {
  @IsString() @MaxLength(255) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(FREQ) frequency!: string;
  @IsOptional() @IsString() @MaxLength(20) daysOfWeek?: string; // "1,3,5"
  @IsOptional() @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @IsOptional() @IsBoolean() skipWeekends?: boolean;
  @IsOptional() @IsString() @MaxLength(5) timeOfDay?: string; // "09:00"
  @IsOptional() @IsIn(PRIO) priority?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsString() @MaxLength(20) targetRole?: string;
  @IsOptional() @IsInt() branchId?: number; // owner boleh set; staff diabaikan
}

export class UpdateScheduleDto extends CreateScheduleDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateTaskItemDto {
  @IsString() @MaxLength(255) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(PRIO) priority?: string;
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() branchId?: number;
}

export class UpdateTaskItemDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(PRIO) priority?: string;
  @IsOptional() @IsIn(STATUS) status?: string;
  @IsOptional() @IsInt() index?: number;
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsBoolean() verified?: boolean; // owner acknowledge
}

export class MoveTaskItemDto {
  @IsIn(STATUS) status!: string;
  @IsInt() index!: number;
}
