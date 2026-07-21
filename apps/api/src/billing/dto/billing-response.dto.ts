import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BillingPlanDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["MONTHLY", "YEARLY"] })
  interval!: "MONTHLY" | "YEARLY";

  @ApiProperty()
  priceCents!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: Object })
  features!: Record<string, unknown>;
}

export class BillingSubscriptionDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  planId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  planCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  planName!: string | null;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  currentPeriodStart!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  currentPeriodEnd!: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;

  @ApiProperty({ description: "True while running without a real payment gateway" })
  isMock!: boolean;

  @ApiProperty({ description: "Whether this plan bills per agent (per-seat)" })
  perSeat!: boolean;

  @ApiProperty({ description: "Billable agents on this subscription" })
  seatCount!: number;

  @ApiPropertyOptional({ nullable: true, description: "Per-agent price in cents (null for flat plans)" })
  perAgentCents!: number | null;

  @ApiProperty({ description: "Total monthly charge in cents (per-agent price × seats for per-seat plans)" })
  amountCents!: number;
}

export class BillingInvoiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: "Human-friendly invoice number" })
  number!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  amountDueCents!: number;

  @ApiProperty()
  amountPaidCents!: number;

  @ApiPropertyOptional({ nullable: true })
  planName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AcceptJsConfigDto {
  @ApiProperty()
  apiLoginId!: string;

  @ApiProperty()
  clientKey!: string;

  @ApiProperty({ enum: ["sandbox", "production"] })
  environment!: string;
}

export class BillingOverviewDto {
  @ApiProperty({ type: [BillingPlanDto] })
  plans!: BillingPlanDto[];

  @ApiPropertyOptional({ type: BillingSubscriptionDto, nullable: true })
  subscription!: BillingSubscriptionDto | null;

  @ApiProperty({ description: "Whether a real payment gateway (Authorize.net) is configured" })
  gatewayConfigured!: boolean;

  @ApiPropertyOptional({
    type: AcceptJsConfigDto,
    nullable: true,
    description: "Public Accept.js config for card tokenization (null in mock mode)"
  })
  acceptJs!: { apiLoginId: string; clientKey: string; environment: string } | null;
}
