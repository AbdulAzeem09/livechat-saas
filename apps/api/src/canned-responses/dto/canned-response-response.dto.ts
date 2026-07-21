import { ApiProperty } from "@nestjs/swagger";

export class CannedResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ nullable: true })
  categoryId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  shortcut!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  isShared!: boolean;

  @ApiProperty()
  usageCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
