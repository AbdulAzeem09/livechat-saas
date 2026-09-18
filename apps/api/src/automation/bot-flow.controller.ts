import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { BotFlowService, type BotFlowDto, type FlowNode } from "./bot-flow.service";

export class CreateBotFlowDto {
  @ApiProperty({ example: "Sales assistant" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class FlowNodeDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty({ enum: ["message", "question", "collect", "condition", "handoff", "end"] })
  @IsString()
  type!: FlowNode["type"];

  @ApiPropertyOptional()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: "Buttons for a question step" })
  @IsOptional()
  @IsArray()
  choices?: Array<{ label: string; next?: string | null }>;

  @ApiPropertyOptional({ enum: ["name", "email", "phone", "company"] })
  @IsOptional()
  field?: FlowNode["field"];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  next?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  whenMatch?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  otherwise?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  x?: number;

  @ApiPropertyOptional()
  @IsOptional()
  y?: number;
}

export class UpdateBotFlowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: "Only one chatbot answers visitors at a time" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startNodeId?: string | null;

  @ApiPropertyOptional({ type: [FlowNodeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowNodeDto)
  nodes?: FlowNodeDto[];
}

@ApiTags("Chatbot")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/bot-flows")
export class BotFlowController {
  constructor(private readonly botFlows: BotFlowService) {}

  @Get()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "List the chatbots drawn for this workspace" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<BotFlowDto[]> {
    return this.botFlows.list(organizationId);
  }

  @Post()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Start a new chatbot (comes with a greeting, a question and a hand-over)" })
  @ApiParam({ name: "organizationId" })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateBotFlowDto
  ): Promise<BotFlowDto> {
    return this.botFlows.create(organizationId, dto.name);
  }

  @Get(":flowId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Get one chatbot with all of its steps" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "flowId" })
  get(
    @Param("organizationId") organizationId: string,
    @Param("flowId") flowId: string
  ): Promise<BotFlowDto> {
    return this.botFlows.get(organizationId, flowId);
  }

  @Patch(":flowId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Save the steps, rename, or switch the chatbot on and off" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "flowId" })
  update(
    @Param("organizationId") organizationId: string,
    @Param("flowId") flowId: string,
    @Body() dto: UpdateBotFlowDto
  ): Promise<BotFlowDto> {
    return this.botFlows.update(organizationId, flowId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.startNodeId !== undefined ? { startNodeId: dto.startNodeId } : {}),
      ...(dto.nodes !== undefined ? { nodes: dto.nodes as FlowNode[] } : {})
    });
  }

  @Delete(":flowId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete a chatbot" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "flowId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("flowId") flowId: string
  ): Promise<{ success: true }> {
    return this.botFlows.remove(organizationId, flowId);
  }
}
