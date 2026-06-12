import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({ example: "ok" })
  status!: "ok";

  @ApiProperty({ example: "livechat-api" })
  service!: string;

  @ApiProperty({ example: "0.1.0" })
  version!: string;

  @ApiProperty({ example: "development" })
  environment!: string;

  @ApiProperty({ example: "2026-06-12T16:00:00.000Z" })
  timestamp!: string;

  @ApiProperty({ example: 123.45 })
  uptimeSeconds!: number;
}

export class ReadinessResponseDto extends HealthResponseDto {
  @ApiProperty({
    example: {
      database: "up"
    }
  })
  dependencies!: Record<string, "up" | "down">;
}
