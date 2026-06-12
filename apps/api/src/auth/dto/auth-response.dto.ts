import { ApiProperty } from "@nestjs/swagger";

export class AuthMembershipDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  organizationName!: string;

  @ApiProperty()
  organizationSlug!: string;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: [AuthMembershipDto] })
  memberships!: AuthMembershipDto[];
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;

  @ApiProperty({ example: 2592000 })
  refreshExpiresInSeconds!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}

export class GoogleAuthUrlResponseDto {
  @ApiProperty()
  authUrl!: string;

  @ApiProperty()
  state!: string;
}
