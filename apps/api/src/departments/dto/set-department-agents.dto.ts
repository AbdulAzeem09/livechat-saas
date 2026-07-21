import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";

export class SetDepartmentAgentsDto {
  @ApiProperty({ type: [String], description: "Membership ids of agents in this department" })
  @IsArray()
  @IsUUID("4", { each: true })
  membershipIds!: string[];
}
