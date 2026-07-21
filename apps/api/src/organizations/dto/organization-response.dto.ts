import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OrganizationMembershipDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ nullable: true })
  title!: string | null;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  agentStatus!: string;

  @ApiProperty()
  maxOpenChats!: number;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class OrganizationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  planCode!: string;

  @ApiProperty({ nullable: true })
  trialEndsAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: Object, description: "Company details & custom fields" })
  metadata!: Record<string, unknown>;

  @ApiPropertyOptional({ type: OrganizationMembershipDto })
  membership?: OrganizationMembershipDto | undefined;
}

export class OrganizationMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ nullable: true })
  title!: string | null;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  agentStatus!: string;

  @ApiProperty()
  maxOpenChats!: number;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty()
  createdAt!: Date;
}

export class InvitationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  roleId!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ nullable: true })
  acceptedAt!: Date | null;

  @ApiProperty({ nullable: true })
  revokedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    nullable: true,
    description: "Raw invite token — returned ONCE on creation so the link can be shared"
  })
  token?: string | null;
}
