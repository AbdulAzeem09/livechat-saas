import { Module, type OnModuleInit } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReportExportController, PublicReportsController } from "./report-export.controller";
import { ReportExportService } from "./report-export.service";
import { RevenueService } from "./revenue.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [AuthModule, OrganizationsModule, PrismaModule],
  controllers: [ReportsController, ReportExportController, PublicReportsController],
  providers: [ReportsService, ReportExportService, RevenueService],
  exports: [ReportExportService, RevenueService]
})
export class ReportsModule implements OnModuleInit {
  constructor(private readonly exports: ReportExportService) {}

  onModuleInit(): void {
    this.exports.startScheduler();
  }
}
