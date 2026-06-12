import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Azeem Khan" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: "owner@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: "StrongPass123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: "Azeem Support" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  organizationName!: string;

  @ApiPropertyOptional({ example: "azeem-support" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  organizationSlug?: string;
}
