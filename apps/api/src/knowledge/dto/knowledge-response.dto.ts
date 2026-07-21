import { ApiProperty } from "@nestjs/swagger";

export class KnowledgeArticleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  published!: boolean;

  @ApiProperty()
  views!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
