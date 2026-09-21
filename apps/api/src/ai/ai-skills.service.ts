import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AiSkill } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AiSkillDto {
  id: string;
  name: string;
  instruction: string;
  keywords: string[];
  isActive: boolean;
  position: number;
}

/** How many rules are sent to the model at once, so the prompt stays sharp. */
const MAX_SKILLS_IN_PROMPT = 8;
const MAX_SKILLS_PER_ORGANIZATION = 50;

/**
 * Skills: what the AI should do in a particular situation, written the way you would tell a
 * new colleague — "if someone asks for a refund, don't promise one, take their order number
 * and hand the chat over".
 *
 * A skill with keywords is only sent to the model when the customer's message mentions one of
 * them, so ten rules about ten topics don't all compete for the model's attention at once.
 */
@Injectable()
export class AiSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<AiSkillDto[]> {
    const skills = await this.prisma.aiSkill.findMany({
      where: { organizationId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });

    return skills.map((skill) => this.map(skill));
  }

  async create(
    organizationId: string,
    input: { name: string; instruction: string; keywords?: string[] }
  ): Promise<AiSkillDto> {
    const name = input.name.trim();
    const instruction = input.instruction.trim();

    if (!name || !instruction) {
      throw new BadRequestException("A skill needs a name and an instruction");
    }

    const count = await this.prisma.aiSkill.count({ where: { organizationId } });

    if (count >= MAX_SKILLS_PER_ORGANIZATION) {
      throw new BadRequestException(
        `That is ${MAX_SKILLS_PER_ORGANIZATION} skills already — remove one before adding another.`
      );
    }

    const skill = await this.prisma.aiSkill.create({
      data: {
        organizationId,
        name: name.slice(0, 120),
        instruction: instruction.slice(0, 1000),
        keywords: this.cleanKeywords(input.keywords),
        position: count
      }
    });

    return this.map(skill);
  }

  async update(
    organizationId: string,
    skillId: string,
    input: { name?: string; instruction?: string; keywords?: string[]; isActive?: boolean }
  ): Promise<AiSkillDto> {
    const skill = await this.getOrThrow(organizationId, skillId);

    const updated = await this.prisma.aiSkill.update({
      where: { id: skill.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
        ...(input.instruction !== undefined
          ? { instruction: input.instruction.trim().slice(0, 1000) }
          : {}),
        ...(input.keywords !== undefined ? { keywords: this.cleanKeywords(input.keywords) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });

    return this.map(updated);
  }

  async remove(organizationId: string, skillId: string): Promise<{ success: true }> {
    const skill = await this.getOrThrow(organizationId, skillId);
    await this.prisma.aiSkill.delete({ where: { id: skill.id } });

    return { success: true };
  }

  /**
   * The rules to put in front of the model for this particular message: the ones with no
   * keywords always apply, the rest only when the customer mentioned something they cover.
   */
  async instructionsFor(organizationId: string, message: string): Promise<string[]> {
    const skills = await this.prisma.aiSkill.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });

    if (!skills.length) {
      return [];
    }

    const lower = message.toLowerCase();
    const always = skills.filter((skill) => skill.keywords.length === 0);
    const matched = skills.filter(
      (skill) =>
        skill.keywords.length > 0 &&
        skill.keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
    );

    return [...matched, ...always]
      .slice(0, MAX_SKILLS_IN_PROMPT)
      .map((skill) => skill.instruction);
  }

  private cleanKeywords(keywords: string[] | undefined): string[] {
    return Array.from(
      new Set(
        (keywords ?? [])
          .map((keyword) => keyword.trim().toLowerCase())
          .filter((keyword) => keyword.length > 1)
      )
    ).slice(0, 20);
  }

  private async getOrThrow(organizationId: string, skillId: string): Promise<AiSkill> {
    const skill = await this.prisma.aiSkill.findFirst({ where: { id: skillId, organizationId } });

    if (!skill) {
      throw new NotFoundException("Skill not found");
    }

    return skill;
  }

  private map(skill: AiSkill): AiSkillDto {
    return {
      id: skill.id,
      name: skill.name,
      instruction: skill.instruction,
      keywords: skill.keywords,
      isActive: skill.isActive,
      position: skill.position
    };
  }
}
