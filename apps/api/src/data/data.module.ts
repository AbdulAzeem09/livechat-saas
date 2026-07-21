import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DataController } from "./data.controller";
import { DataService } from "./data.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService]
})
export class DataModule {}
