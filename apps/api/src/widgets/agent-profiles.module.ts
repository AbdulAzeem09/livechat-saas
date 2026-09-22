import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentProfilesService } from "./agent-profiles.service";

/**
 * Its own module so both the widget (chat history) and conversations (a live reply) can put
 * the agent's name on a message without importing each other.
 */
@Module({
  imports: [PrismaModule],
  providers: [AgentProfilesService],
  exports: [AgentProfilesService]
})
export class AgentProfilesModule {}
