import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationAccessService } from "./organization-access.service";
import { OrganizationAccessGuard } from "./guards/organization-access.guard";
import { OrganizationsService } from "./organizations.service";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, RolesController],
  providers: [
    OrganizationAccessService,
    OrganizationAccessGuard,
    OrganizationsService,
    RolesService
  ],
  exports: [OrganizationAccessService, OrganizationAccessGuard]
})
export class OrganizationsModule {}
