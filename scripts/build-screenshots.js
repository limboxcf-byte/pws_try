// scripts/build-screenshots.js
//
// Scans screenshots/bilder/ for JPEG/PNG files and writes
// screenshots/data/manifest.json -- a plain, sorted list of filenames.
// No per-image pages, no EXIF reading (screenshots don't need it) --
// just enough for the gallery to build its slideshow automatically.
//
// Run: node scripts/build-screenshots.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "screenshots");
const IMAGES_DIR = path.join(ROOT, "bilder");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error("Folder not found: " + IMAGES_DIR);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

  const files = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    // Filenames sort naturally chronologically for typical screenshot
    // naming conventions (e.g. "Screenshot 2024-05-01 at 12.34.56.png").
    // Prefix filenames with numbers yourself for full manual control.
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(files, null, 2) + "\n");
  console.log(`screenshots manifest.json written: ${files.length} file(s).`);
}

main();
