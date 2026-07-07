const express = require("express");
const { spawn } = require("child_process"); // Make sure this is destructured correctly
const path = require("path");

const app = express();
app.use(express.json());

// 1. Detect the operating system platform
const isWindows = process.platform === "win32";
const binaryName = isWindows ? "server.exe" : "./server.out";

// 2. Build the absolute path string (Ensure it uses path.join correctly)
const binaryPath = path.join(__dirname, "src", binaryName);

console.log(
  `[System] Detected platform: ${process.platform}. Launching backend engine via: ${binaryName}`,
);

// 3. Launch the process (binaryPath MUST be a string variable, not path.join itself)
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
