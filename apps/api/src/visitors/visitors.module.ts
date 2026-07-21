import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VisitorsController } from "./visitors.controller";
import { VisitorsService } from "./visitors.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [VisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService]
})
export class VisitorsModule {}
