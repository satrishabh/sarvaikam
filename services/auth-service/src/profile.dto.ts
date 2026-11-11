import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS, Permission } from './access.entity';
import { Role } from './user.entity';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class EmailDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254)
  email: string;
}

export class SignInDto extends EmailDto {
  @IsString() @MinLength(1) @MaxLength(128)
  password: string;
}

export class SignUpDto extends EmailDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  @Matches(/^[^\u0000-\u001f\u007f]+$/)
  name: string;
  @IsString() @MinLength(12) @MaxLength(128)
  password: string;
}

export class BusinessApplicationDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(160)
  organization: string;
  @Transform(trim) @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500)
  website: string;
  @Transform(trim) @IsString() @MinLength(20) @MaxLength(2000)
  reason: string;
}

export class ReviewDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(1000)
  note: string;
}

export class UserAccessDto {
  @IsOptional() @IsIn(['USER', 'BUSINESS', 'ADMIN'])
  role?: Role;
  @IsOptional() @IsBoolean()
  disabled?: boolean;
}

export class PolicyDto {
  @IsArray() @ArrayUnique() @IsIn(PERMISSIONS, { each: true })
  permissions: Permission[];
}

export class ReaderPreferencesDto {
  @IsIn([16, 18, 20, 22])
  size: 16 | 18 | 20 | 22;
  @IsIn(['sans', 'serif'])
  font: 'sans' | 'serif';
  @IsIn(['day', 'paper', 'night'])
  theme: 'day' | 'paper' | 'night';
  @IsIn(['comfortable', 'compact'])
  spacing: 'comfortable' | 'compact';
}
