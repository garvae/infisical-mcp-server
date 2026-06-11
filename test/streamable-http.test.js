const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { setTimeout: delay } = require("node:timers/promises");

const { buildWorkspaceUrl } = require("../dist/index.js");

const repoRoot = path.resolve(__dirname, "..");

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
    server.on("error", reject);
  });

const waitForHealth = async (url, childProcess) => {
  let lastError;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (childProcess.exitCode !== null) {
      throw new Error(`Server exited early with code ${childProcess.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Healthcheck returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw lastError;
};

test("buildWorkspaceUrl omits the type query for all-project lookups", () => {
  assert.equal(
    buildWorkspaceUrl("https://app.infisical.com", "all"),
    "https://app.infisical.com/api/v1/workspace",
  );
  assert.equal(
    buildWorkspaceUrl("https://self-hosted.example.com/", "kms"),
    "https://self-hosted.example.com/api/v1/workspace?type=kms",
  );
});

test("streamable HTTP transport initializes and exposes tools", async (t) => {
  const port = await getFreePort();
  const childProcess = spawn(process.execPath, ["dist/index.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      INFISICAL_AUTH_METHOD: "access-token",
      INFISICAL_TOKEN: "test-token",
      INFISICAL_HOST_URL: "https://app.infisical.com",
      MCP_TRANSPORT: "streamable-http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_PATH: "/mcp",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stderrChunks = [];
  childProcess.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk.toString("utf-8"));
  });

  t.after(async () => {
    if (childProcess.exitCode === null) {
      childProcess.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => childProcess.once("exit", resolve)),
        delay(3_000),
      ]);
    }
  });

  await waitForHealth(`http://127.0.0.1:${port}/health`, childProcess);

  const initializeResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    }),
  });

  assert.equal(
    initializeResponse.status,
    200,
    stderrChunks.join(""),
  );

  const sessionId = initializeResponse.headers.get("mcp-session-id");
  assert.ok(sessionId, "Expected MCP session ID header on initialization");

  const initializePayload = await initializeResponse.json();
  assert.equal(initializePayload.result.serverInfo.name, "Infisical");

  const listToolsResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  assert.equal(
    listToolsResponse.status,
    200,
    stderrChunks.join(""),
  );

  const listToolsPayload = await listToolsResponse.json();
  const toolNames = listToolsPayload.result.tools.map((tool) => tool.name);
  assert.ok(toolNames.includes("list-folders"));
  assert.ok(toolNames.includes("list-projects"));
});
