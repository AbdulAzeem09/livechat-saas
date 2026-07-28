import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ProvisionClientDto {
  @ApiProperty({ maxLength: 160, description: "Name of the client firm to provision" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;
}
