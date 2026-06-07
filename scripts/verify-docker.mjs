import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const shouldBuild = process.argv.includes("--build");

function run(command, options = {}) {
  execFileSync(command[0], command.slice(1), {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}

const steps = [
  {
    name: "docker compose config",
    command: ["docker", "compose", "config", "--quiet"],
  },
];

if (shouldBuild) {
  try {
    execFileSync("docker", ["info"], {
      cwd: root,
      stdio: "ignore",
    });
  } catch (error) {
    console.error("Docker daemon is not reachable. Start Docker Desktop or your Docker service, then rerun npm run verify:docker:build.");
    process.exit(1);
  }

  steps.push({
    name: "docker compose build",
    command: ["docker", "compose", "build", "backend", "frontend"],
  });
}

for (const step of steps) {
  console.log(`\n==> ${step.name}`);
  run(step.command);
}

console.log(`\nDocker Compose ${shouldBuild ? "build" : "configuration"} verification checks passed.`);
