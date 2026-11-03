import { resolve } from "node:path";

const args = process.argv.slice(2);
if (args[0] === "--help") {
  console.log("사용법: secretary [프로젝트 경로] [OMP 옵션...]\n\n대화에서 /secretary <문제 설명>으로 시작합니다. /secretary-view로 View를 생성합니다.");
  process.exit(0);
}
const cwd = args[0] && !args[0].startsWith("-") ? resolve(args.shift()!) : process.cwd();
const root = resolve(import.meta.dir, "..");
const child = Bun.spawn([process.execPath, resolve(root, "node_modules/@oh-my-pi/pi-coding-agent/dist/cli.js"), "--extension", root, ...args], { cwd, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.exit(await child.exited);
