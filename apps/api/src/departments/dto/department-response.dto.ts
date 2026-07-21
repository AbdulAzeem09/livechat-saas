import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DepartmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  routingWeight!: number;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty({ type: [String], description: "Membership ids of agents assigned to this department" })
  agentMembershipIds!: string[];

  @ApiProperty()
  agentCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
