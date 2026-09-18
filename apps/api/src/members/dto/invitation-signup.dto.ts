import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

/** Create an account straight from an invite link; the email comes from the invitation. */
export class InvitationSignupDto {
  @ApiProperty({ example: "Sara Ahmed" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ minLength: 8, example: "StrongPass123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
