import { ApiProperty } from "@nestjs/swagger";

export class ActionResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}
