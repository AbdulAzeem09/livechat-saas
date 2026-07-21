import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface OpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

export interface CreateSubscriptionInput {
  planName: string;
  amountCents: number;
  intervalMonths: number;
  opaqueData: OpaqueData;
  invoiceNumber: string;
  email?: string;
  cardholderName?: string;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
}

/**
 * Thin Authorize.net client using their JSON API.
 * Only the pieces we need: ARB recurring subscriptions via an Accept.js nonce.
 */
@Injectable()
export class AuthorizeNetService {
  private readonly logger = new Logger(AuthorizeNetService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.apiLoginId && this.transactionKey);
  }

  /** Public Accept.js config the browser needs to tokenize a card (safe to expose). */
  get acceptJsConfig(): { apiLoginId: string; clientKey: string; environment: string } | null {
    const clientKey = this.config.get<string>("AUTHORIZENET_PUBLIC_CLIENT_KEY") ?? "";
    if (!this.apiLoginId || !clientKey) {
      return null;
    }
    return {
      apiLoginId: this.apiLoginId,
      clientKey,
      environment: this.environment
    };
  }

  private get apiLoginId(): string {
    return this.config.get<string>("AUTHORIZENET_API_LOGIN_ID") ?? "";
  }

  private get transactionKey(): string {
    return this.config.get<string>("AUTHORIZENET_TRANSACTION_KEY") ?? "";
  }

  private get environment(): string {
    return this.config.get<string>("AUTHORIZENET_ENV") ?? "sandbox";
  }

  private get endpoint(): string {
    return this.environment === "production"
      ? "https://api.authorize.net/xml/v1/request.api"
      : "https://apitest.authorize.net/xml/v1/request.api";
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    // startDate must be today or later, formatted YYYY-MM-DD in UTC.
    const startDate = new Date().toISOString().slice(0, 10);
    const amount = (input.amountCents / 100).toFixed(2);

    const body = {
      ARBCreateSubscriptionRequest: {
        merchantAuthentication: {
          name: this.apiLoginId,
          transactionKey: this.transactionKey
        },
        refId: input.invoiceNumber.slice(0, 20),
        subscription: {
          name: input.planName.slice(0, 50),
          paymentSchedule: {
            interval: { length: input.intervalMonths, unit: "months" },
            startDate,
            totalOccurrences: 9999,
            trialOccurrences: 0
          },
          amount,
          payment: {
            opaqueData: {
              dataDescriptor: input.opaqueData.dataDescriptor,
              dataValue: input.opaqueData.dataValue
            }
          },
          ...(input.email || input.cardholderName
            ? {
                customer: input.email ? { email: input.email } : {},
                billTo: this.splitName(input.cardholderName)
              }
            : {})
        }
      }
    };

    const json = await this.post(body);
    const resultCode = json?.messages?.resultCode;
    if (resultCode !== "Ok") {
      const text = this.firstMessage(json) ?? "Authorize.net declined the request";
      this.logger.warn(`ARB subscription failed: ${text}`);
      throw new Error(text);
    }

    const subscriptionId = String(json.subscriptionId ?? "");
    if (!subscriptionId) {
      throw new Error("Authorize.net did not return a subscription id");
    }
    return { subscriptionId };
  }

  /** Update a live subscription's recurring amount (used when the seat count changes). */
  async updateSubscriptionAmount(subscriptionId: string, amountCents: number): Promise<void> {
    if (!subscriptionId) {
      return;
    }
    const body = {
      ARBUpdateSubscriptionRequest: {
        merchantAuthentication: {
          name: this.apiLoginId,
          transactionKey: this.transactionKey
        },
        subscriptionId,
        subscription: { amount: (amountCents / 100).toFixed(2) }
      }
    };
    const json = await this.post(body);
    if (json?.messages?.resultCode !== "Ok") {
      throw new Error(this.firstMessage(json) ?? "Failed to update the subscription amount");
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    if (!subscriptionId) {
      return;
    }
    const body = {
      ARBCancelSubscriptionRequest: {
        merchantAuthentication: {
          name: this.apiLoginId,
          transactionKey: this.transactionKey
        },
        subscriptionId
      }
    };
    try {
      await this.post(body);
    } catch (error) {
      // Cancellation is best-effort; the local record is already marked canceled.
      this.logger.warn(
        `ARB cancel failed for ${subscriptionId}: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  private splitName(fullName?: string): Record<string, string> {
    if (!fullName) {
      return {};
    }
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() ?? "";
    const lastName = parts.join(" ");
    return {
      ...(firstName ? { firstName: firstName.slice(0, 50) } : {}),
      ...(lastName ? { lastName: lastName.slice(0, 50) } : {})
    };
  }

  private firstMessage(json: {
    messages?: { message?: Array<{ text?: string }> };
  }): string | undefined {
    return json?.messages?.message?.[0]?.text;
  }

  private async post(body: unknown): Promise<Record<string, any>> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    // Authorize.net's JSON responses are prefixed with a UTF-8 BOM which breaks JSON.parse.
    const raw = (await response.text()).replace(/^﻿/u, "").trim();
    try {
      return JSON.parse(raw) as Record<string, any>;
    } catch {
      throw new Error("Authorize.net returned an unreadable response");
    }
  }
}
