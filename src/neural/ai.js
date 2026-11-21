export async function askLearningTutor({question, lesson}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({question, lesson})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI 导师暂时不可用，请稍后重试。");
  return data.reply;
}
