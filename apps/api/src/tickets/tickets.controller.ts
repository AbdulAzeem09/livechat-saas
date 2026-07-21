import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { ConvertConversationDto } from "./dto/convert-conversation.dto";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { TicketDto } from "./dto/ticket-response.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { TicketsService } from "./tickets.service";

@ApiTags("Tickets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Permissions("chat:read")
  @ApiOperation({ summary: "List tickets" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<TicketDto[]> {
    return this.ticketsService.list(organizationId);
  }

  @Post()
  @Permissions("chat:write")
  @ApiOperation({ summary: "Create a ticket" })
  @ApiParam({ name: "organizationId" })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateTicketDto
  ): Promise<TicketDto> {
    return this.ticketsService.create(organizationId, dto);
  }

  @Post("from-conversation/:conversationId")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Convert a live chat into a ticket (with an auto-reply in the chat)" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  createFromConversation(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: ConvertConversationDto
  ): Promise<TicketDto> {
    return this.ticketsService.createFromConversation(
      organizationId,
      conversationId,
      context.membershipId,
      dto
    );
  }

  @Patch(":ticketId")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Update a ticket (status/priority/assignment)" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "ticketId" })
  update(
    @Param("organizationId") organizationId: string,
    @Param("ticketId") ticketId: string,
    @Body() dto: UpdateTicketDto
  ): Promise<TicketDto> {
    return this.ticketsService.update(organizationId, ticketId, dto);
  }

  @Delete(":ticketId")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Delete a ticket" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "ticketId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("ticketId") ticketId: string
  ): Promise<{ success: true }> {
    return this.ticketsService.remove(organizationId, ticketId);
  }
}
