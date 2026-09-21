import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { AiPerformanceService, type AiPerformance } from "./ai-performance.service";
import { AiSkillsService, type AiSkillDto } from "./ai-skills.service";

export class CreateAiSkillDto {
  @ApiProperty({ example: "Refund requests" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example:
      "If someone asks for a refund, don't promise one. Take their order number and hand the chat to a person."
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  instruction!: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Only apply this rule when the message mentions one of these. Leave empty to always apply."
  })
  @IsOptional()
  @IsArray()
  keywords?: string[];
}

export class UpdateAiSkillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instruction?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/ai")
export class AiSkillsController {
  constructor(
    private readonly skills: AiSkillsService,
    private readonly performance: AiPerformanceService
  ) {}

  @Get("skills")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "The rules the assistant follows" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<AiSkillDto[]> {
    return this.skills.list(organizationId);
  }

  @Post("skills")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Teach the assistant what to do in a situation" })
  @ApiParam({ name: "organizationId" })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateAiSkillDto
  ): Promise<AiSkillDto> {
    return this.skills.create(organizationId, dto);
  }

  @Patch("skills/:skillId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Change a rule, or switch it off" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "skillId" })
  update(
    @Param("organizationId") organizationId: string,
    @Param("skillId") skillId: string,
    @Body() dto: UpdateAiSkillDto
  ): Promise<AiSkillDto> {
    return this.skills.update(organizationId, skillId, dto);
  }

  @Delete("skills/:skillId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Remove a rule" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "skillId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("skillId") skillId: string
  ): Promise<{ success: true }> {
    return this.skills.remove(organizationId, skillId);
  }

  @Get("performance")
  @Permissions("analytics:read")
  @ApiOperation({ summary: "How many chats the assistant finished on its own" })
  @ApiParam({ name: "organizationId" })
  performanceOverview(
    @Param("organizationId") organizationId: string,
    @Query("days") days = "30"
  ): Promise<AiPerformance> {
    return this.performance.overview(organizationId, Number.parseInt(days, 10) || 30);
  }
}
