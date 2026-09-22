import { ConversationStatus, MessagingChannel, Prisma } from "@prisma/client";

/**
 * How a report is narrowed down: a date range, one agent, one tag, one channel, one status.
 *
 * Every field is optional and an empty filter means "everything", so a report asked for
 * without filters behaves exactly as it did before there were any.
 */
export interface ReportFilters {
  from?: Date;
  to?: Date;
  agentId?: string;
  tag?: string;
  channel?: MessagingChannel;
  status?: ConversationStatus;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A valid uuid that belongs to nobody, so an unusable agent filter matches nothing. */
const NO_SUCH_AGENT = "00000000-0000-0000-0000-000000000000";

export interface ReportFilterQuery {
  from?: string;
  to?: string;
  agentId?: string;
  tag?: string;
  channel?: string;
  status?: string;
}

/** Read filters off the query string, ignoring anything that isn't a real value. */
export function parseReportFilters(query: ReportFilterQuery): ReportFilters {
  const filters: ReportFilters = {};

  const from = parseDate(query.from);
  const to = parseDate(query.to);

  if (from) {
    filters.from = from;
  }

  if (to) {
    // A date with no time means the whole of that day, not midnight at its start.
    filters.to = /^\d{4}-\d{2}-\d{2}$/.test(query.to?.trim() ?? "")
      ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
      : to;
  }

  // Only a real id: the column is a uuid, and Postgres raises on anything else. A filter
  // value comes straight from a query string, so it must never be able to fail the request.
  const agentId = query.agentId?.trim();
  if (agentId && UUID_PATTERN.test(agentId)) {
    filters.agentId = agentId;
  } else if (agentId) {
    // Asked for an agent that cannot exist: report nothing, rather than everything.
    filters.agentId = NO_SUCH_AGENT;
  }

  const tag = query.tag?.trim();
  if (tag) {
    filters.tag = tag;
  }

  const channel = query.channel?.trim().toUpperCase();
  if (channel && channel in MessagingChannel) {
    filters.channel = channel as MessagingChannel;
  }

  const status = query.status?.trim().toUpperCase();
  if (status && status in ConversationStatus) {
    filters.status = status as ConversationStatus;
  }

  return filters;
}

/** True when nothing was asked for — lets callers skip the filtered path entirely. */
export function isEmptyFilter(filters: ReportFilters): boolean {
  return (
    !filters.from && !filters.to && !filters.agentId && !filters.tag && !filters.channel && !filters.status
  );
}

/**
 * The filters as a Prisma fragment to merge into a conversation query.
 * Returns `{}` when nothing is set, so spreading it is always safe.
 */
export function conversationFilter(filters: ReportFilters): Prisma.ConversationWhereInput {
  const where: Prisma.ConversationWhereInput = {};

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {})
    };
  }

  if (filters.agentId) {
    where.assignedAgentId = filters.agentId;
  }

  if (filters.channel) {
    where.channel = filters.channel;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.tag) {
    // Tags live in the conversation's metadata, as a JSON array of strings.
    where.metadata = { path: ["tags"], array_contains: [filters.tag] };
  }

  return where;
}

function parseDate(value: string | undefined): Date | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
