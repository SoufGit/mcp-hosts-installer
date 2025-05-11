#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
  type Stats,
} from "fs";
import * as os from "os";
import { join, resolve } from "path";
import { spawnPromise } from "spawn-rx";
import { z } from "zod";

// Define host type as a union of literal string types
type Hosts = "cursor" | "vscode" | "claude" | undefined;

// Define content type for responses
type ContentItem = {
  type: string;
  text: string;
};

// Define response type for installation operations
interface InstallationResult {
  content: ContentItem[];
  isError: boolean;
}

// Define server configuration type
interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Define MCP configuration file structure
interface McpConfig {
  mcpServers: Record<string, ServerConfig>;
  [key: string]: unknown;
}

// Create an MCP server
const server = new McpServer({
  name: "mcp-hosts-installer",
  version: "0.1.0",
});

// Define host schema once to avoid repetition
const hostSchema = z
  .enum(["claude", "cursor", "vscode"])
  .describe("The host to install the MCP server to. (claude, cursor, vscode)");

// Define common argument schemas
const argsSchema = z
  .array(z.string())
  .optional()
  .describe("The arguments to pass to the MCP server");

const envSchema = z
  .array(z.string())
  .optional()
  .describe("The environment variables to set, delimited by =");

// Add tools with improved schemas
server.tool(
  "install_repo_mcp_server",
  {
    name: z.string().describe("The package name of the MCP server"),
    host: hostSchema,
    args: argsSchema,
    env: envSchema,
  },
  async ({ name, host, args, env }) => {
    const installResult = await installRepoMcpServer(name, host, args, env);
    return {
      content: [
        {
          type: "text",
          text: installResult.content.at(0)?.text ?? "",
        },
      ],
      isError: installResult.isError,
    };
  }
);

server.tool(
  "install_local_mcp_server",
  {
    path: z.string().describe("The path to the MCP server"),
    host: hostSchema.optional(),
    args: argsSchema,
    env: envSchema,
  },
  async ({ path, host, args, env }) => {
    const installResult = await installLocalMcpServer(path, host, args, env);
    return {
      content: [
        {
          type: "text",
          text: installResult.content.at(0)?.text ?? "",
        },
      ],
      isError: installResult.isError,
    };
  }
);

async function hasNodeJs(): Promise<boolean> {
  try {
    await spawnPromise("node", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function hasUvx(): Promise<boolean> {
  try {
    await spawnPromise("uvx", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function isNpmPackage(name: string): Promise<boolean> {
  try {
    await spawnPromise("npm", ["view", name, "version"]);
    return true;
  } catch (e) {
    return false;
  }
}

const isHostExist = (path: string): boolean => {
  try {
    const stats: Stats = statSync(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

const isFileExist = (filePath: string): boolean => {
  try {
    const stats: Stats = statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
};

/**
 * Parses environment variables from string array into object
 * @param env Array of environment variables in format "KEY=VALUE"
 * @returns Object with environment variables
 */
const parseEnvVars = (env?: string[]): Record<string, string> => {
  return (env ?? []).reduce((acc, val) => {
    const [key, value] = val.split("=");
    if (key) acc[key] = value ?? "";
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Installs an MCP server to a client
 */
const installToClient = async (
  name: string,
  cmd: string,
  args: string[],
  host: Hosts,
  env?: string[]
): Promise<InstallationResult> => {
  const finalHost = host === "claude" ? host : `.${host}`;
  const hostFile =
    host === "claude" ? "claude_desktop_config.json" : "mcp.json";

  const configPath =
    process.platform === "win32"
      ? join(os.homedir(), "AppData", "Roaming", finalHost)
      : join(os.homedir(), finalHost);

  if (!isHostExist(configPath)) {
    return {
      content: [
        {
          type: "text",
          text: `This client (${host}) is not installed!`,
        },
      ],
      isError: true,
    };
  }

  const configPathWithHost = join(configPath, hostFile);

  if (isFileExist(configPathWithHost)) {
    try {
      const config = JSON.parse(
        readFileSync(configPathWithHost, "utf8")
      ) as McpConfig;
      const envObj = parseEnvVars(env);

      const newServer: ServerConfig = {
        command: cmd,
        args: args,
        ...(env && env.length > 0 ? { env: envObj } : {}),
      };

      // Initialize mcpServers if it doesn't exist
      const mcpServers = config.mcpServers ?? {};
      mcpServers[name] = newServer;
      config.mcpServers = mcpServers;

      writeFileSync(configPathWithHost, JSON.stringify(config, null, 2));

      return {
        content: [
          {
            type: "text",
            text: `Installed MCP server "${name}" via ${cmd} for ${host} successfully! Please restart the application to apply changes.`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating configuration file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Configuration file "${hostFile}" not found for ${host}. Path checked: ${configPathWithHost}`,
      },
    ],
    isError: true,
  };
};

const installRepoWithArgsToClient = (
  name: string,
  useNpm: boolean,
  host: Hosts,
  args?: string[],
  env?: string[]
): Promise<InstallationResult> => {
  // If the name is in a scoped package, we need to remove the scope
  const serverName = /^@.*\//i.test(name) ? name.split("/")[1] : name;

  return installToClient(
    serverName,
    useNpm ? "npx" : "uvx",
    [name, ...(args ?? [])],
    host,
    env
  );
};

const attemptNodeInstall = async (
  directory: string
): Promise<Record<string, string>> => {
  try {
    await spawnPromise("npm", ["install"], { cwd: directory });

    // Read package.json to find binaries
    const pkgPath = join(directory, "package.json");
    if (!existsSync(pkgPath)) {
      throw new Error("package.json not found");
    }

    interface PackageJson {
      name: string;
      bin?: Record<string, string>;
      main?: string;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;

    if (pkg.bin) {
      return Object.keys(pkg.bin).reduce((acc, key) => {
        acc[key] = resolve(directory, pkg.bin![key]);
        return acc;
      }, {} as Record<string, string>);
    }

    if (pkg.main) {
      return { [pkg.name]: resolve(directory, pkg.main) };
    }

    return {};
  } catch (error) {
    console.error("Error during node installation:", error);
    return {};
  }
};

const installLocalMcpServer = async (
  dirPath: string,
  host: Hosts,
  args?: string[],
  env?: string[]
): Promise<InstallationResult> => {
  if (!existsSync(dirPath)) {
    return {
      content: [
        {
          type: "text",
          text: `Path "${dirPath}" does not exist locally!`,
        },
      ],
      isError: true,
    };
  }

  const packageJsonPath = join(dirPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const servers = await attemptNodeInstall(dirPath);

      if (Object.keys(servers).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No executable servers found in ${dirPath}`,
            },
          ],
          isError: true,
        };
      }

      // Install the first server found
      const [name, path] = Object.entries(servers)[0];
      const installResult = await installToClient(
        name,
        "node",
        [path, ...(args ?? [])],
        host,
        env
      );

      return installResult;
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Installation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Cannot install from ${dirPath}: No package.json found`,
      },
    ],
    isError: true,
  };
};

async function installRepoMcpServer(
  name: string,
  host: Hosts,
  args?: string[],
  env?: string[]
): Promise<InstallationResult> {
  if (!(await hasNodeJs())) {
    return {
      content: [
        {
          type: "text",
          text: `Node.js is not installed. Please install Node.js to continue.`,
        },
      ],
      isError: true,
    };
  }

  if (await isNpmPackage(name)) {
    return installRepoWithArgsToClient(name, true, host, args, env);
  }

  if (!(await hasUvx())) {
    return {
      content: [
        {
          type: "text",
          text: `Python uv is not installed. Please install it from https://docs.astral.sh/uv`,
        },
      ],
      isError: true,
    };
  }

  return installRepoWithArgsToClient(name, false, host, args, env);
}

// Start receiving messages on stdin and sending messages on stdout
async function runServer(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("✅ MCP TCP server is running and connected.");
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
