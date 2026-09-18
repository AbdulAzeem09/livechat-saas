import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { CurrentOrganization } from "../organizations/decorators/current-organization.decorator";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { ContactsService } from "./contacts.service";
import {
  ContactResponseDto,
  ContactTagDto,
  CreateContactDto,
  CreateContactNoteDto,
  ListContactsQuery,
  UpdateContactDto
} from "./dto/contact.dto";

@ApiTags("Contacts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Permissions("contacts:manage")
@Controller("organizations/:organizationId/contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: "List/search customer records" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [ContactResponseDto] })
  list(
    @Param("organizationId") organizationId: string,
    @Query() query: ListContactsQuery
  ): Promise<ContactResponseDto[]> {
    return this.contactsService.list(organizationId, query);
  }

  @Post()
  @ApiOperation({ summary: "Create a customer record" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: ContactResponseDto })
  create(
    @Param("organizationId") organizationId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: CreateContactDto
  ): Promise<ContactResponseDto> {
    return this.contactsService.create(organizationId, dto, context.membershipId);
  }

  @Get(":contactId")
  @ApiOperation({ summary: "Get one customer with notes, tags and chat history" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  @ApiOkResponse({ type: ContactResponseDto })
  get(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string
  ): Promise<ContactResponseDto> {
    return this.contactsService.get(organizationId, contactId);
  }

  @Patch(":contactId")
  @ApiOperation({ summary: "Update a customer record" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  @ApiOkResponse({ type: ContactResponseDto })
  update(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @Body() dto: UpdateContactDto
  ): Promise<ContactResponseDto> {
    return this.contactsService.update(organizationId, contactId, dto, context.membershipId);
  }

  @Delete(":contactId")
  @ApiOperation({ summary: "Delete a customer record" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string,
    @CurrentOrganization() context: OrganizationRequestContext
  ): Promise<{ success: true }> {
    return this.contactsService.remove(organizationId, contactId, context.membershipId);
  }

  @Post(":contactId/notes")
  @ApiOperation({ summary: "Add a private note about the customer" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  @ApiOkResponse({ type: ContactResponseDto })
  addNote(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string,
    @CurrentOrganization() context: OrganizationRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateContactNoteDto
  ): Promise<ContactResponseDto> {
    return this.contactsService.addNote(organizationId, contactId, dto.body, {
      membershipId: context.membershipId,
      userId: user.userId
    });
  }

  @Delete(":contactId/notes/:noteId")
  @ApiOperation({ summary: "Delete a note" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  @ApiParam({ name: "noteId" })
  @ApiOkResponse({ type: ContactResponseDto })
  removeNote(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string,
    @Param("noteId") noteId: string
  ): Promise<ContactResponseDto> {
    return this.contactsService.removeNote(organizationId, contactId, noteId);
  }

  @Post(":contactId/tags")
  @ApiOperation({ summary: "Tag a customer" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  @ApiOkResponse({ type: ContactResponseDto })
  addTag(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string,
    @Body() dto: ContactTagDto
  ): Promise<ContactResponseDto> {
    return this.contactsService.addTag(organizationId, contactId, dto.name);
  }

  @Delete(":contactId/tags/:name")
  @ApiOperation({ summary: "Remove a tag from a customer" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "contactId" })
  @ApiParam({ name: "name" })
  @ApiOkResponse({ type: ContactResponseDto })
  removeTag(
    @Param("organizationId") organizationId: string,
    @Param("contactId") contactId: string,
    @Param("name") name: string
  ): Promise<ContactResponseDto> {
    return this.contactsService.removeTag(organizationId, contactId, name);
  }
}
