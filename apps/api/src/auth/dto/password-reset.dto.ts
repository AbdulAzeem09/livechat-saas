import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "owner@example.com" })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "Token from the reset email link" })
  @IsString()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 8, example: "NewStrongPass123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: "Token from the verification email link" })
  @IsString()
  @MaxLength(200)
  token!: string;
}
