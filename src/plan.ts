// Adapted from Oh My Pi v18.16.0 (MIT), packages/coding-agent/src/plan-mode/plan-handoff.ts.
// Copyright notices and source hashes: third_party/oh-my-pi/.
// Modified: project plan file replaces OMP's session-local URL router.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { paths } from "./project.ts";

export interface PlanReference { path: string; content: string; }

export function loadPlanReference(cwd: string): PlanReference | undefined {
  const path = paths(cwd).plan;
  let content: string;
  try { content = readFileSync(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (!content.trim()) return undefined;
  return { path, content };
}

export function savePlan(cwd: string, content: string) {
  if (!content.trim() || content.length > 32_000) throw new Error("계획은 비어 있지 않은 32000자 이내 문서여야 합니다.");
  const path = paths(cwd).plan;
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  writeFileSync(temporary, content, { flag: "wx" });
  renameSync(temporary, path);
  return path;
}
