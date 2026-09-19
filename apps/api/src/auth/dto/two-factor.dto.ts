import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, MinLength } from "class-validator";

export class VerifyTwoFactorDto {
  @ApiProperty({ description: "Handed out by /auth/login when two-factor is on" })
  @IsString()
  @MinLength(10)
  challengeToken!: string;

  @ApiProperty({ example: "123456", description: "Authenticator code, or a recovery code" })
  @IsString()
  @Length(6, 16)
  code!: string;
}

export class EnableTwoFactorDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: "Your account password" })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class TwoFactorChallengeDto {
  @ApiProperty({ example: true })
  twoFactorRequired!: true;

  @ApiProperty({ description: "Send this back with the code to finish signing in" })
  challengeToken!: string;
}
