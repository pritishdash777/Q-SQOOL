import type { Circuit } from "./quantum-types";
import type { LabContext } from "./lab-coach";
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatAnswer = { text: string; truncated: boolean; proposal?: Circuit };
export const QUESTION_LIMIT = 4000;
export const HISTORY_LIMIT = 24000;

/** Keep recent context in complete turns, always including the newest question. */
export function chatHistory(turns: ChatTurn[]): ChatTurn[] {
  const result: ChatTurn[] = [];
  let size = 0;
  for (const turn of turns.slice(-20).reverse()) {
    if (size + turn.content.length > HISTORY_LIMIT) break;
    result.unshift(turn);
    size += turn.content.length;
  }
  while (result[0]?.role === "assistant") result.shift();
  return result;
}

export async function requestChat(messages: ChatTurn[], page: string, signal: AbortSignal, lab?: LabContext): Promise<ChatAnswer> {
  const timeout = AbortSignal.timeout(55000);
  try {
    const response = await fetch("/api/q-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory(messages).map(({ role, content }) => ({ role, content })), page, ...(lab ? { lab } : {}) }),
      signal: AbortSignal.any([signal, timeout]),
    });
    const data = await response.json();
    signal.throwIfAborted();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "q-ai couldn’t answer. Please try again.");
    if (typeof data.text !== "string" || !data.text.trim()) throw new Error("q-ai returned an empty answer. Please try again.");
    return { text: data.text, truncated: data.truncated === true, ...(data.proposal ? { proposal: data.proposal } : {}) };
  } catch (error) {
    if (signal.aborted) throw error;
    if (timeout.aborted) throw new Error("q-ai took too long to respond. Please retry.");
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error("Couldn’t connect to q-ai. Check your connection and retry.");
    throw error;
  }
}
