import { NextRequest, NextResponse } from "next/server";
import { createTask, getTaskDetail, getTaskMessages } from "@/lib/manus-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const task = await createTask({
      content: `You are the EIH Project Office AI Advisor. Answer concisely and clearly for an executive. Use the connected Project Office context when available.\n\nUser question: ${message}`,
      responseMode: "text",
      interactiveMode: false,
      title: "EIH AI Advisor",
    });

    return NextResponse.json({ taskId: task.taskId });
  } catch (error) {
    console.error("[Manus chat] create task failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Manus AI." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId is required." }, { status: 400 });

  try {
    const task = await getTaskDetail(taskId);
    if (task.status !== "stopped" && task.status !== "error") {
      return NextResponse.json({ status: task.status === "waiting" ? "waiting" : "running" });
    }
    if (task.status === "error") return NextResponse.json({ status: "error", error: "Manus AI could not complete the request." });

    const result = await getTaskMessages(taskId, { order: "desc", limit: 20, verbose: true });
    const reply = result.messages.find((message) => message.type === "assistant_message")?.assistant_message?.content;
    return NextResponse.json({ status: "done", reply: reply || "Manus AI completed the task without a text response." });
  } catch (error) {
    console.error("[Manus chat] task polling failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read the Manus response." }, { status: 500 });
  }
}
