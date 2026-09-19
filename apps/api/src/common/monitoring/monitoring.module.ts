import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { MonitoringService } from "./monitoring.service";

/** Global: the error filter and the auth service both report into it. */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [MonitoringService],
  exports: [MonitoringService]
})
export class MonitoringModule {}
