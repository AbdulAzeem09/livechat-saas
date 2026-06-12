import { ApiProperty } from "@nestjs/swagger";

export class RoleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  key!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class RoleAssignmentDto {
  @ApiProperty()
  membershipId!: string;

  @ApiProperty()
  roleId!: string;

  @ApiProperty({ type: [RoleDto] })
  roles!: RoleDto[];
}
