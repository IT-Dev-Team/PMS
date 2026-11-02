import { NextRequest, NextResponse } from "next/server";
import { createTask, getTaskDetail, getTaskMessages, uploadFile } from "@/lib/manus-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const projects = Array.isArray(body?.projects) ? body.projects : [];
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const projectData = JSON.stringify(projects, null, 2);
    const projectFile = await uploadFile("eih-project-context.json", new Blob([projectData], { type: "application/json" }));

    const task = await createTask({
      content: `You are the EIH Project Office AI Advisor. Answer concisely and clearly for an executive. Analyze only the attached eih-project-context.json file. Do not claim to use context that was not provided. If the data does not support an answer, say what is missing.\n\nUser question: ${message}`,
      fileIds: [projectFile.fileId],
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
    const assistantMessage = result.messages.find((message) => message.type === "assistant_message");
    const reply = assistantMessage?.assistant_message?.content;
    const attachments = assistantMessage?.assistant_message?.attachments ?? [];
    return NextResponse.json({ status: "done", reply: reply || "Manus AI completed the task without a text response.", attachments });
  } catch (error) {
    console.error("[Manus chat] task polling failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read the Manus response." }, { status: 500 });
  }
}
