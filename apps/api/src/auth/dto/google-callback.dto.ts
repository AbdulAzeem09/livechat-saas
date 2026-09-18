import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

// Google appends extra query params to the redirect; they must be declared or the global
// validation pipe (forbidNonWhitelisted) rejects every callback.
export class GoogleCallbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authuser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;
}
