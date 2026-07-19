import {
  IsEmail, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsEmail({}, { message: 'Format email tidak valid.' })
  @MaxLength(100)
  email!: string;

  // Minimal 8 karakter, mengandung huruf & angka.
  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @MaxLength(72, { message: 'Password maksimal 72 karakter (batas bcrypt).' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password harus mengandung huruf dan angka.',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsOptional()
  @IsInt()
  branchId?: number;
}
