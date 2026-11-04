import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

export const SKILL_SOURCE = resolve(import.meta.dir, "../skills/assistant");

export function installSkill(cwd: string) {
  const root = realpathSync(cwd);
  for (const directory of [join(root, ".agents"), join(root, ".agents/skills")]) {
    const stat = lstatSync(directory, { throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`스킬 설치 경로를 확인해 주세요: ${directory}`);
    mkdirSync(directory, { recursive: true });
  }
  const destination = join(root, ".agents/skills/assistant");
  const previous = lstatSync(destination, { throwIfNoEntry: false });
  if (previous) {
    if (!previous.isSymbolicLink() || resolve(join(root, ".agents/skills"), readlinkSync(destination)) !== SKILL_SOURCE) {
      throw new Error(`기존 스킬을 덮어쓰지 않습니다: ${destination}`);
    }
  } else symlinkSync(SKILL_SOURCE, destination, "dir");
  if (!existsSync(join(destination, "SKILL.md"))) throw new Error(`스킬 원본을 찾을 수 없습니다: ${SKILL_SOURCE}`);
  return destination;
}
