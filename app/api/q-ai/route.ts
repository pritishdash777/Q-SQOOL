import { chatStatus, createChatHandler } from "../../../lib/q-ai-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = chatStatus;
export const POST = createChatHandler();
