type TimelineItem = {
  createdAt?: unknown;
  messageType?: unknown;
  sourceMessageType?: unknown;
  timelineItemOrder?: number;
  messageId?: unknown;
  sourceMessageId?: unknown;
  id?: unknown;
};

const time = (value: unknown) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const semanticRank = (value: unknown) => {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "offer": case "2": return 0;
    case "counteroffer": case "3": return 1;
    case "system": case "4": return 2;
    default: return 3;
  }
};

// Raw REST messages and formatted/realtime rows share the same ordering.
// Mutation/read timestamps never determine a message's timeline position.
export const compareChatTimeline = (a: TimelineItem, b: TimelineItem) =>
  time(a.createdAt) - time(b.createdAt) ||
  semanticRank(a.sourceMessageType ?? a.messageType) -
    semanticRank(b.sourceMessageType ?? b.messageType) ||
  Number(a.timelineItemOrder ?? 0) - Number(b.timelineItemOrder ?? 0) ||
  String(a.sourceMessageId ?? a.messageId ?? a.id ?? "").localeCompare(
    String(b.sourceMessageId ?? b.messageId ?? b.id ?? ""),
  );
