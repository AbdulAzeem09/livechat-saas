import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Contact, Prisma } from "@prisma/client";
import { AuditService } from "../common/audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ContactNoteResponseDto,
  ContactResponseDto,
  CreateContactDto,
  ListContactsQuery,
  UpdateContactDto
} from "./dto/contact.dto";

/**
 * Customer records (CRM). A contact is the person behind one or more chats: chats, notes and
 * tags hang off it, so an agent sees the history instead of a one-off conversation.
 */
@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(organizationId: string, query: ListContactsQuery): Promise<ContactResponseDto[]> {
    const search = query.search?.trim();
    const contacts = await this.prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: query.limit ?? 50
    });

    return Promise.all(contacts.map((contact) => this.map(contact, { withNotes: false })));
  }

  async get(organizationId: string, contactId: string): Promise<ContactResponseDto> {
    const contact = await this.getOrThrow(organizationId, contactId);
    return this.map(contact, { withNotes: true });
  }

  async create(
    organizationId: string,
    dto: CreateContactDto,
    membershipId: string
  ): Promise<ContactResponseDto> {
    if (!dto.name && !dto.email && !dto.phone) {
      throw new BadRequestException("A contact needs at least a name, email or phone number");
    }

    const contact = await this.prisma.contact.create({
      data: {
        organizationId,
        ...this.writableFields(dto)
      }
    });
    this.audit.record({
      organizationId,
      actorMemberId: membershipId,
      action: "contact.created",
      entityType: "contact",
      entityId: contact.id,
      payload: { email: contact.email, name: contact.name }
    });

    return this.map(contact, { withNotes: true });
  }

  async update(
    organizationId: string,
    contactId: string,
    dto: UpdateContactDto,
    membershipId: string
  ): Promise<ContactResponseDto> {
    await this.getOrThrow(organizationId, contactId);
    const contact = await this.prisma.contact.update({
      where: { id: contactId },
      data: this.writableFields(dto)
    });
    this.audit.record({
      organizationId,
      actorMemberId: membershipId,
      action: "contact.updated",
      entityType: "contact",
      entityId: contactId
    });

    return this.map(contact, { withNotes: true });
  }

  async remove(
    organizationId: string,
    contactId: string,
    membershipId: string
  ): Promise<{ success: true }> {
    await this.getOrThrow(organizationId, contactId);
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() }
    });
    this.audit.record({
      organizationId,
      actorMemberId: membershipId,
      action: "contact.deleted",
      entityType: "contact",
      entityId: contactId
    });

    return { success: true };
  }

  async addNote(
    organizationId: string,
    contactId: string,
    body: string,
    author: { membershipId: string; userId: string }
  ): Promise<ContactResponseDto> {
    await this.getOrThrow(organizationId, contactId);
    await this.prisma.contactNote.create({
      data: {
        organizationId,
        contactId,
        // author_id references the membership (user_organizations), not the user
        authorId: author.membershipId,
        body: body.trim()
      }
    });
    // Keep the contact at the top of the recently-touched list.
    await this.prisma.contact.update({ where: { id: contactId }, data: { updatedAt: new Date() } });

    return this.get(organizationId, contactId);
  }

  async removeNote(
    organizationId: string,
    contactId: string,
    noteId: string
  ): Promise<ContactResponseDto> {
    const note = await this.prisma.contactNote.findFirst({
      where: { id: noteId, contactId, organizationId }
    });

    if (!note) {
      throw new NotFoundException("Note not found");
    }

    await this.prisma.contactNote.delete({ where: { id: noteId } });
    return this.get(organizationId, contactId);
  }

  async addTag(organizationId: string, contactId: string, name: string): Promise<ContactResponseDto> {
    await this.getOrThrow(organizationId, contactId);
    const tagName = name.trim().toLowerCase();

    if (!tagName) {
      throw new BadRequestException("Tag name cannot be empty");
    }

    const tag =
      (await this.prisma.tag.findFirst({ where: { organizationId, name: tagName } })) ??
      (await this.prisma.tag.create({ data: { organizationId, name: tagName } }));

    await this.prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId: tag.id } },
      create: { contactId, tagId: tag.id },
      update: {}
    });

    return this.get(organizationId, contactId);
  }

  async removeTag(
    organizationId: string,
    contactId: string,
    name: string
  ): Promise<ContactResponseDto> {
    await this.getOrThrow(organizationId, contactId);
    const tag = await this.prisma.tag.findFirst({
      where: { organizationId, name: name.trim().toLowerCase() }
    });

    if (tag) {
      await this.prisma.contactTag.deleteMany({ where: { contactId, tagId: tag.id } });
    }

    return this.get(organizationId, contactId);
  }

  /**
   * Called when a visitor shares their details in the widget: find or create the contact for
   * that email and link the visitor + conversation to it, so the CRM builds itself.
   */
  async linkVisitorToContact(input: {
    organizationId: string;
    visitorId: string;
    conversationId?: string;
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
  }): Promise<Contact | null> {
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    const phone = input.phone?.trim();

    if (!email && !phone) {
      return null;
    }

    const existing = await this.prisma.contact.findFirst({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        ...(email ? { email } : { phone: phone as string })
      }
    });

    const contact = existing
      ? await this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            ...(name && !existing.name ? { name } : {}),
            ...(phone && !existing.phone ? { phone } : {}),
            ...(email && !existing.email ? { email } : {})
          }
        })
      : await this.prisma.contact.create({
          data: {
            organizationId: input.organizationId,
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {})
          }
        });

    await this.prisma.visitor.update({
      where: { id: input.visitorId },
      data: { contactId: contact.id }
    });

    if (input.conversationId) {
      await this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { contactId: contact.id }
      });
    }

    return contact;
  }

  private writableFields(dto: UpdateContactDto) {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
      ...(dto.company !== undefined ? { company: dto.company.trim() || null } : {}),
      ...(dto.attributes !== undefined
        ? { attributes: dto.attributes as Prisma.InputJsonValue }
        : {})
    };
  }

  private async getOrThrow(organizationId: string, contactId: string): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId, deletedAt: null }
    });

    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    return contact;
  }

  private async map(
    contact: Contact,
    options: { withNotes: boolean }
  ): Promise<ContactResponseDto> {
    const [conversationCount, lastConversation, contactTags, notes] = await Promise.all([
      this.prisma.conversation.count({
        where: { organizationId: contact.organizationId, contactId: contact.id }
      }),
      this.prisma.conversation.findFirst({
        where: { organizationId: contact.organizationId, contactId: contact.id },
        orderBy: { lastMessageAt: "desc" },
        select: { lastMessageAt: true, createdAt: true }
      }),
      this.prisma.contactTag.findMany({ where: { contactId: contact.id } }),
      options.withNotes
        ? this.prisma.contactNote.findMany({
            where: { contactId: contact.id, organizationId: contact.organizationId },
            orderBy: { createdAt: "desc" },
            take: 50
          })
        : Promise.resolve([])
    ]);

    const tagIds = contactTags.map((link) => link.tagId);
    const tags = tagIds.length
      ? await this.prisma.tag.findMany({ where: { id: { in: tagIds } } })
      : [];
    const authorIds = [...new Set(notes.map((note) => note.authorId).filter((id): id is string => Boolean(id)))];
    const memberships = authorIds.length
      ? await this.prisma.userOrganization.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, displayName: true, userId: true }
        })
      : [];
    const users = memberships.length
      ? await this.prisma.user.findMany({
          where: { id: { in: memberships.map((membership) => membership.userId) } },
          select: { id: true, name: true, email: true }
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    const authorById = new Map(
      memberships.map((membership) => {
        const user = userById.get(membership.userId);

        return [
          membership.id,
          { name: membership.displayName ?? user?.name ?? null, email: user?.email ?? null }
        ] as const;
      })
    );

    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      attributes:
        contact.attributes && typeof contact.attributes === "object" && !Array.isArray(contact.attributes)
          ? contact.attributes
          : {},
      tags: tags.map((tag) => tag.name),
      conversationCount,
      lastConversationAt: lastConversation?.lastMessageAt ?? lastConversation?.createdAt ?? null,
      notes: notes.map<ContactNoteResponseDto>((note) => {
        const author = note.authorId ? authorById.get(note.authorId) : undefined;

        return {
          id: note.id,
          body: note.body,
          authorName: author?.name ?? author?.email ?? null,
          createdAt: note.createdAt
        };
      }),
      createdAt: contact.createdAt
    };
  }
}
