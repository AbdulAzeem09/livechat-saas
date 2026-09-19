import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { MonitoringService, type SystemHealth } from "../common/monitoring/monitoring.service";
import { HealthResponseDto, ReadinessResponseDto } from "./dto/health-response.dto";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly monitoring: MonitoringService
  ) {}

  /** Deeper than /health: database reachability, memory and recent error counts. */
  @Get("system")
  @ApiOperation({ summary: "Database, memory and recent error counts" })
  system(): Promise<SystemHealth> {
    return this.monitoring.health();
  }

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return this.healthService.getLiveness();
  }

  @Get("live")
  @ApiOkResponse({ type: HealthResponseDto })
  getLive(): HealthResponseDto {
    return this.healthService.getLiveness();
  }

  @Get("ready")
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ description: "A required dependency is unavailable." })
  getReady(): Promise<ReadinessResponseDto> {
    return this.healthService.getReadiness();
  }
}
