import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { HealthResponseDto, ReadinessResponseDto } from "./dto/health-response.dto";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

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
