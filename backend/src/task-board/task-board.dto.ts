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
  IsArray,
  Matches,
  MinLength,
} from 'class-validator';

const FREQ = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'];
const PRIO = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUS = ['TODO', 'IN_PROGRESS', 'DONE'];
const SHIFT_SLOT = ['PAGI', 'KEDUA'];
const CHECKIN_SHIFT = ['PAGI', 'KEDUA', 'LIBUR'];

/** Karyawan memilih shift hari ini → checklist khusus shift itu dibuat. */
export class ShiftCheckinDto {
  @IsIn(CHECKIN_SHIFT) shift!: 'PAGI' | 'KEDUA' | 'LIBUR';
}

/** Teguran manual owner/manajer ke satu karyawan. */
export class CreateWarningDto {
  @IsInt() userId!: number;
  @IsString() @MinLength(3) @MaxLength(2000) message!: string;
}

/** Tandai teguran sudah dibaca (tanpa ids = semua teguran milik sendiri). */
export class AckWarningsDto {
  @IsOptional() @IsArray() @IsInt({ each: true }) ids?: number[];
}

/** Autentikasi PIN karyawan (halaman /so-designer, /produksi, /cetak). */
export class PinAuthDto {
  @IsInt() designerId!: number;
  @IsString() @MaxLength(20) pin!: string;
}
export class PinCheckinDto extends PinAuthDto {
  @IsIn(CHECKIN_SHIFT) shift!: 'PAGI' | 'KEDUA' | 'LIBUR';
}
export class PinAckDto extends PinAuthDto {
  @IsOptional() @IsArray() @IsInt({ each: true }) ids?: number[];
}

/** Atur tanggal akhir masa uji coba piket (null = akhiri uji coba). */
export class SetTrialDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) until?: string | null;
}

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
  @IsOptional() @IsInt() groupId?: number;
  @IsOptional() @IsString() @MaxLength(20) targetRole?: string;
  @IsOptional() @IsBoolean() targetAll?: boolean;
  @IsOptional() @IsInt() branchId?: number; // owner boleh set; staff diabaikan
  @IsOptional() @IsIn(SHIFT_SLOT) shiftSlot?: string | null; // piket: hanya utk yg pilih shift ini
  @IsOptional() @IsString() @MaxLength(255) @Matches(/^\d+(,\d+)*$/)
  rotationUserIds?: string | null; // giliran harian "18,19,24,9" (dihitung dari startDate)
}

export class UpdateScheduleDto extends CreateScheduleDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateTaskItemDto {
  @IsString() @MaxLength(255) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(PRIO) priority?: string;
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsInt() groupId?: number;
  @IsOptional() @IsString() @MaxLength(20) targetRole?: string;
  @IsOptional() @IsBoolean() targetAll?: boolean;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[]; // lampiran gambar brief
}

export class CreateGroupDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) memberIds?: number[];
  @IsOptional() @IsInt() branchId?: number;
}

export class UpdateGroupDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) memberIds?: number[];
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
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[]; // ubah lampiran
}

export class MoveTaskItemDto {
  @IsIn(STATUS) status!: string;
  @IsInt() index!: number;
}
