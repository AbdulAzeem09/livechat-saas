import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { OrganizationsModule } from "../../organizations/organizations.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Global()
@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
