require("dotenv").config(); // 1. Load environment variables
const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// --- SUPABASE CONFIGURATION ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || "vertex-backups";
const DB_FILE_NAME = "vertex_data.db";
const dbLocalPath = path.join(__dirname, "src", DB_FILE_NAME);

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Warning: SUPABASE_URL or SUPABASE_KEY is missing in your .env file!",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- SUPABASE STORAGE HELPERS ---

// Download latest database file from Supabase bucket
async function downloadBackup() {
  try {
    console.log(
      `[Cloud Storage] Checking Supabase bucket '${BUCKET_NAME}' for snapshot...`,
    );
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(DB_FILE_NAME);

    if (error) {
      if (error.statusCode === "404" || error.message.includes("not found")) {
        console.log(
          "ℹ️ [Cloud Storage] No previous snapshot found in bucket. Starting fresh.",
        );
        return;
      }
      throw error;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(dbLocalPath, buffer);
    console.log(
      `✅ [Cloud Storage] Successfully downloaded ${DB_FILE_NAME} to /src directory.`,
    );
  } catch (err) {
    console.error("❌ [Cloud Storage] Download failed:", err.message);
  }
}

// Upload local database file to Supabase bucket
async function uploadBackup() {
  try {
    if (!fs.existsSync(dbLocalPath)) {
      console.warn(
        `⚠️ [Cloud Storage] No local ${DB_FILE_NAME} found at ${dbLocalPath}. Skipping sync.`,
      );
      return false;
    }

    console.log(`[Cloud Storage] Syncing ${DB_FILE_NAME} to Supabase...`);
    const fileBuffer = fs.readFileSync(dbLocalPath);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(DB_FILE_NAME, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: true, // Overwrite existing cloud snapshot
      });

    if (error) throw error;

    console.log(
      `✅ [Cloud Storage] Database successfully backed up to Supabase!`,
    );
    return true;
  } catch (err) {
    console.error("❌ [Cloud Storage] Upload failed:", err.message);
    return false;
  }
}

// --- MAIN GATEWAY BOOTSTRAP ---
async function startServer() {
  // Await cloud download BEFORE starting C++ engine
  await downloadBackup();

  // 1. Detect platform
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "server.exe" : "./server.out";
  const binaryPath = path.join(__dirname, "src", binaryName);

  console.log(
    `[System] Detected platform: ${process.platform}. Launching backend engine via: ${binaryName}`,
  );

  // 2. Launch C++ process
  const cppEngine = spawn(binaryPath, [], {
    cwd: path.join(__dirname, "src"),
  });

  const requestQueue = [];

  cppEngine.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      console.log(`[C++ Engine Response]: ${line}`);

      if (requestQueue.length > 0) {
        const res = requestQueue.shift();
        res.json({
          status: line.startsWith("ERROR") ? "fail" : "success",
          data: line,
        });
      }
    }
  });

  cppEngine.stderr.on("data", (data) => {
    console.error(`${data}`.trim());
  });

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

  // --- MODULE 4: SAVE ENDPOINT (Triggers local persistence + Cloud Sync) ---
  app.post("/save", (req, res) => {
    // Intercept response to trigger Supabase upload after C++ completes local save
    const customRes = {
      json: async (data) => {
        res.json(data);
        if (data.status === "success") {
          await uploadBackup();
        }
      },
    };
    sendToEngine(`SAVE`, customRes);
  });

  // --- PERIODIC SYNC (Every 5 Minutes) ---
  const FIVE_MINUTES = 5 * 60 * 1000;
  setInterval(async () => {
    console.log("[Auto-Sync] Running scheduled background cloud backup...");
    await uploadBackup();
  }, FIVE_MINUTES);

  // --- PROCESS TERMINATION HANDLING ---
  process.on("SIGINT", async () => {
    console.log(
      "\n🛑 [Shutdown] Terminal signal received. Syncing state to cloud...",
    );
    await uploadBackup();
    cppEngine.kill();
    process.exit(0);
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` Vertex Hybrid Distributed Engine Online           `);
    console.log(` API Gateway listening concurrently on Port ${PORT} `);
    console.log(`===================================================`);
  });
}

startServer();
