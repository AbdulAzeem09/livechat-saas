import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class CreateDepartmentDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ minimum: 0, description: "Higher weight receives more chats" })
  @IsInt()
  @Min(0)
  @IsOptional()
  routingWeight?: number;

  @ApiPropertyOptional({ description: "Default department for unrouted chats" })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
