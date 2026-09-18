import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateContactDto {
  @ApiPropertyOptional({ example: "Sara Ahmed" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: "sara@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+92 300 1234567" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: "Acme Ltd" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiPropertyOptional({ description: "Your own fields, e.g. plan or account id" })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateContactDto extends CreateContactDto {}

export class ListContactsQuery {
  @ApiPropertyOptional({ description: "Search name, email, phone or company" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CreateContactNoteDto {
  @ApiProperty({ example: "Wants a callback on Monday." })
  @IsString()
  @MaxLength(4000)
  body!: string;
}

export class ContactTagDto {
  @ApiProperty({ example: "vip" })
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class ContactNoteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ nullable: true }) authorName!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class ContactResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) company!: string | null;
  @ApiProperty() attributes!: Record<string, unknown>;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() conversationCount!: number;
  @ApiProperty({ nullable: true }) lastConversationAt!: Date | null;
  @ApiProperty({ type: [ContactNoteResponseDto] }) notes!: ContactNoteResponseDto[];
  @ApiProperty() createdAt!: Date;
}
