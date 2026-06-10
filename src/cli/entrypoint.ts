import { PACKAGE_VERSION } from "../version.js";

export type EntrypointAction =
  | {
      kind: "server";
      startsServer: true;
      args: string[];
    }
  | {
      kind: "chat" | "ask";
      startsServer: false;
      args: string[];
    }
  | {
      kind: "print";
      startsServer: false;
      exitCode: number;
      stdout: string;
      stderr: string;
    };

const HELP_TEXT = `Usage:
  ableton-mind                 Start the MCP server over stdio
  ableton-mind chat [options]  Start the local copilot chat
  ableton-mind ask [prompt]    Run one local copilot prompt
  ableton-mind --help          Show this help
  ableton-mind --version       Print package version
`;

const HELP_COMMANDS = new Set(["--help", "-h", "help"]);
const VERSION_COMMANDS = new Set(["--version", "-v", "version"]);
const CHAT_COMMANDS = new Set(["chat", "llm-run"]);

export function resolveEntrypointAction(argv: string[]): EntrypointAction {
  const [command, ...rest] = argv;
  if (!command) {
    return { kind: "server", startsServer: true, args: [] };
  }

  if (HELP_COMMANDS.has(command)) {
    return { kind: "print", startsServer: false, exitCode: 0, stdout: HELP_TEXT, stderr: "" };
  }

  if (VERSION_COMMANDS.has(command)) {
    return {
      kind: "print",
      startsServer: false,
      exitCode: 0,
      stdout: `${PACKAGE_VERSION}\n`,
      stderr: "",
    };
  }

  if (CHAT_COMMANDS.has(command)) {
    return { kind: "chat", startsServer: false, args: rest };
  }

  if (command === "ask") {
    return { kind: "ask", startsServer: false, args: rest };
  }

  return {
    kind: "print",
    startsServer: false,
    exitCode: 1,
    stdout: "",
    stderr: `Unknown command: ${command}\n\n${HELP_TEXT}`,
  };
}
