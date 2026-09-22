import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EntitlementsModule } from "../billing/entitlements.module";
import { AccessRestrictionService } from "./access-restriction.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationAccessService } from "./organization-access.service";
import { OrganizationAccessGuard } from "./guards/organization-access.guard";
import { OrganizationsService } from "./organizations.service";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [OrganizationsController, RolesController],
  providers: [
    AccessRestrictionService,
    OrganizationAccessService,
    OrganizationAccessGuard,
    OrganizationsService,
    RolesService
  ],
  exports: [AccessRestrictionService, OrganizationAccessService, OrganizationAccessGuard]
})
export class OrganizationsModule {}
