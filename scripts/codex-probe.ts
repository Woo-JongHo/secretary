import { realpathSync } from "node:fs";
import { SKILL_SOURCE } from "../src/install.ts";

// Read-only host integration: initialize the actual installed Codex app-server
// and ask it to reload skills. No login, model request, or config write.
export async function probeCodexSkill(cwd: string) {
  const codex = Bun.which("codex");
  if (!codex) throw new Error("실제 호스트 검사에 필요한 codex가 없습니다.");
  const child = Bun.spawn([codex, "app-server", "--listen", "stdio://"], { cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  type Reply = { id?: number; error?: { message: string }; result?: unknown };
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const stderr = new Response(child.stderr).text();
  const reader = (async () => {
    let buffer = "";
    const decoder = new TextDecoder();
    for await (const chunk of child.stdout) {
      buffer += decoder.decode(chunk, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        const reply = JSON.parse(line) as Reply;
        if (reply.id === undefined) continue;
        const request = pending.get(reply.id);
        if (!request) continue;
        pending.delete(reply.id);
        if (reply.error) request.reject(new Error(reply.error.message));
        else request.resolve(reply.result);
      }
    }
    if (pending.size) throw new Error("Codex가 응답 전에 종료됐습니다.");
  })().catch((error: Error) => { for (const request of pending.values()) request.reject(error); pending.clear(); });
  let nextId = 0;
  const send = (message: object) => { child.stdin.write(`${JSON.stringify(message)}\n`); child.stdin.flush(); };
  const request = async (method: string, params: object): Promise<unknown> => {
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        timer = setTimeout(() => { pending.delete(id); reject(new Error(`Codex ${method} 응답 시간 초과`)); }, 20_000);
        send({ id, method, params });
      });
    } finally { clearTimeout(timer!); }
  };
  try {
    await request("initialize", { clientInfo: { name: "assistant-smoke", title: "Assistant smoke", version: "0.2.0" }, capabilities: {} });
    send({ method: "initialized", params: {} });
    const result = await request("skills/list", { cwds: [cwd], forceReload: true }) as { data: Array<{ skills: Array<{ name: string; path: string; enabled: boolean }>; errors: unknown[] }> };
    const skill = result.data.flatMap((entry) => entry.skills).find((entry) => entry.name === "assistant" && entry.enabled && realpathSync(entry.path) === realpathSync(`${SKILL_SOURCE}/SKILL.md`));
    if (!skill) throw new Error("실제 Codex가 설치한 assistant 스킬을 수용하지 않았습니다.");
    return { host: "Codex", skillAccepted: true, enabled: skill.enabled, modelApiCalled: false };
  } finally {
    child.stdin.end();
    child.kill();
    const force = setTimeout(() => child.kill("SIGKILL"), 2000);
    await child.exited;
    clearTimeout(force);
    await reader;
    await stderr;
  }
}
