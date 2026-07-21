import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import type { Response } from "express";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { BillingService } from "./billing.service";
import {
  BillingInvoiceDto,
  BillingOverviewDto,
  BillingSubscriptionDto
} from "./dto/billing-response.dto";
import { SubscribeDto } from "./dto/subscribe.dto";

@ApiTags("Billing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Permissions("billing:manage")
  @ApiOperation({ summary: "Get billing overview (plans + current subscription)" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: BillingOverviewDto })
  overview(@Param("organizationId") organizationId: string): Promise<BillingOverviewDto> {
    return this.billingService.getOverview(organizationId);
  }

  @Post("subscribe")
  @Permissions("billing:manage")
  @ApiOperation({ summary: "Subscribe the organization to a plan" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: BillingSubscriptionDto })
  subscribe(
    @Param("organizationId") organizationId: string,
    @Body() dto: SubscribeDto
  ): Promise<BillingSubscriptionDto> {
    return this.billingService.subscribe(organizationId, dto);
  }

  @Post("cancel")
  @Permissions("billing:manage")
  @ApiOperation({ summary: "Cancel the organization's subscription" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: BillingSubscriptionDto })
  cancel(@Param("organizationId") organizationId: string): Promise<BillingSubscriptionDto> {
    return this.billingService.cancel(organizationId);
  }

  @Get("invoices")
  @Permissions("billing:manage")
  @ApiOperation({ summary: "List the organization's invoices" })
  @ApiParam({ name: "organizationId" })
  @ApiOkResponse({ type: [BillingInvoiceDto] })
  invoices(@Param("organizationId") organizationId: string): Promise<BillingInvoiceDto[]> {
    return this.billingService.listInvoices(organizationId);
  }

  @Get("invoices/:invoiceId/pdf")
  @Permissions("billing:manage")
  @Header("Content-Type", "application/pdf")
  @ApiOperation({ summary: "Download an invoice as a PDF" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "invoiceId" })
  async invoicePdf(
    @Param("organizationId") organizationId: string,
    @Param("invoiceId") invoiceId: string,
    @Res() res: Response
  ): Promise<void> {
    const { buffer, filename } = await this.billingService.getInvoicePdf(organizationId, invoiceId);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  }
}
