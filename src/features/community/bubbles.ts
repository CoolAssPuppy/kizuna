export interface Message {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  media_url: string | null;
}

export interface BubbleGroup {
  id: string;
  sender_id: string;
  startedAt: string;
  messages: Message[];
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Groups consecutive messages from the same sender into a single bubble
 * cluster, breaking when the sender changes or when the gap exceeds five
 * minutes. iMessage uses the same heuristic for stacking bubbles.
 */
export function groupMessagesForBubbles(messages: Message[]): BubbleGroup[] {
  if (messages.length === 0) return [];
  const groups: BubbleGroup[] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    const gap = last
      ? new Date(m.sent_at).getTime() -
        new Date(last.messages[last.messages.length - 1]!.sent_at).getTime()
      : Infinity;
    if (last && last.sender_id === m.sender_id && gap <= FIVE_MINUTES_MS) {
      last.messages.push(m);
    } else {
      groups.push({
        id: m.id,
        sender_id: m.sender_id,
        startedAt: m.sent_at,
        messages: [m],
      });
    }
  }
  return groups;
}
