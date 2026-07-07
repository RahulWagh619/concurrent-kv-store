const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());

// DETECT OPERATING SYSTEM: Run .exe on Windows, compiled .out binary on Linux cloud containers
const isWindows = process.platform === "win32";
const binaryName = isWindows ? "server.exe" : "./server.out";
const binaryPath = path.join;

console.log(
  `[System] Detected platform: ${process.platform}. Launching backend engine via: ${binaryName}`,
);

// Spawn the C++ database core as a persistent background child process
const cppEngine = spawn(binaryPath, [], {
  cwd: path.join(__dirname, "src"),
});
// Queue to handle matching asynchronous incoming HTTP requests to C++ output lines
const requestQueue = [];

cppEngine.stdout.on("data", (data) => {
  const lines = data.toString().split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    console.log(`[C++ Engine Response]: ${line}`);

    // Resolve the oldest waiting HTTP connection with the C++ database response
    if (requestQueue.length > 0) {
      const res = requestQueue.shift();
      res.json({
        status: line.startsWith("ERROR") ? "fail" : "success",
        data: line,
      });
    }
  }
});

// Capture and print standard error logs (used for DB startup messages)
cppEngine.stderr.on("data", (data) => {
  console.error(`${data}`.trim());
});

// Central function to stream data down to the C++ engine
function sendToEngine(commandStr, res) {
  requestQueue.push(res);
  cppEngine.stdin.write(commandStr + "\n");
}

// --- REST API ENDPOINTS ---

app.post("/set", (req, res) => {
  const { key, value } = req.body;
  if (!key || !value)
    return res.status(400).json({ error: "Missing key or value" });
  sendToEngine(`SET ${key} ${value}`, res);
});

app.get("/get/:key", (req, res) => {
  const { key } = req.params;
  sendToEngine(`GET ${key}`, res);
});

app.delete("/del/:key", (req, res) => {
  const { key } = req.params;
  sendToEngine(`DEL ${key}`, res);
});

// --- MODULE 4: SAVE ENDPOINT ---
app.post("/save", (req, res) => {
  sendToEngine(`SAVE`, res);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Vertex Hybrid Distributed Engine Online           `);
  console.log(` API Gateway listening concurrently on Port ${PORT} `);
  console.log(`===================================================`);
});
