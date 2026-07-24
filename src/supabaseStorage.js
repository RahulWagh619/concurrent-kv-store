// supabaseStorage.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || "vertex-backups";
const DB_FILE_NAME = "vertex_data.db";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: SUPABASE_URL or SUPABASE_KEY missing in .env file!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Download database from Supabase bucket on startup
 */
async function downloadBackup(localFilePath) {
  try {
    console.log(
      `📥 Downloading ${DB_FILE_NAME} from Supabase bucket: ${BUCKET_NAME}...`,
    );

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(DB_FILE_NAME);

    if (error) {
      // If file doesn't exist yet (first time startup), start with clean state
      if (error.statusCode === "404" || error.message.includes("not found")) {
        console.log(
          "ℹ️ No existing snapshot found in bucket. Starting with fresh local storage.",
        );
        return false;
      }
      throw error;
    }

    // Convert Blob/ArrayBuffer to Buffer and save locally
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localFilePath, buffer);
    console.log(`✅ Snapshot downloaded successfully to ${localFilePath}`);
    return true;
  } catch (err) {
    console.error("❌ Error downloading snapshot from Supabase:", err.message);
    return false;
  }
}

/**
 * Upload local database file to Supabase bucket
 */
async function uploadBackup(localFilePath) {
  try {
    if (!fs.existsSync(localFilePath)) {
      console.warn(
        `⚠️ Warning: Local database file not found at ${localFilePath}. Skipping backup.`,
      );
      return false;
    }

    console.log(`📤 Uploading ${localFilePath} to Supabase...`);
    const fileBuffer = fs.readFileSync(localFilePath);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(DB_FILE_NAME, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: true, // Overwrite existing snapshot
      });

    if (error) throw error;

    console.log(`✅ Database successfully backed up to Supabase!`);
    return true;
  } catch (err) {
    console.error("❌ Error uploading snapshot to Supabase:", err.message);
    return false;
  }
}

module.exports = {
  downloadBackup,
  uploadBackup,
};
