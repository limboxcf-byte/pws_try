// scripts/build-fotowiki.js
//
// Laeuft in der GitHub Action bei jedem Push, der wiki-fotos/bilder/
// aendert. Macht drei Dinge:
//   1. Liest EXIF (Kamera, Blende, ISO, Datum, GPS) direkt aus jeder
//      Bilddatei -- beim Build, nicht im Browser.
//   2. Schreibt wiki-fotos/data/manifest.json mit den fertigen Metadaten.
//   3. Generiert fuer jedes Bild eine eigene, statische HTML-Seite unter
//      wiki-fotos/bild/<slug>.html -- eigener <title>, eigenes og:image,
//      funktioniert auch ganz ohne JavaScript.
//
// Tags/Querverweise (data/tags.json) bleiben Handarbeit -- fuer neue
// Bilder wird dort automatisch ein leerer Stub angelegt.
//
// Aufruf: node scripts/build-fotowiki.js

const fs = require("fs");
const path = require("path");
const exifr = require("exifr");

const ROOT = path.join(__dirname, "..", "wiki-fotos");
const BILDER_DIR = path.join(ROOT, "bilder");
const SEITEN_DIR = path.join(ROOT, "bild");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");
const TAGS_PATH = path.join(ROOT, "data", "tags.json");

const ERLAUBTE_ENDUNGEN = [".jpg", ".jpeg", ".png"];

function slugify(dateiname) {
  const basis = path.parse(dateiname).name;
  return basis
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bild";
}

function eindeutigeSlugs(dateien) {
  const vergeben = new Map();
  const ergebnis = {};
  for (const datei of dateien) {
    let slug = slugify(datei);
    if (vergeben.has(slug)) {
      const n = vergeben.get(slug) + 1;
      vergeben.set(slug, n);
      slug = slug + "-" + n;
    } else {
      vergeben.set(slug, 1);
    }
    ergebnis[datei] = slug;
  }
  return ergebnis;
}

function formatDatum(iso) {
  if (!iso) return null;
  const dt = new Date(iso);
  if (isNaN(dt)) return null;
  return dt.toLocaleString("de-DE");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function leseExif(dateipfad) {
  try {
    const daten = await exifr.parse(dateipfad, { gps: true });
    if (!daten) return {};
    return {
      datum: daten.DateTimeOriginal ? daten.DateTimeOriginal.toISOString() : null,
      kamera: [daten.Make, daten.Model].filter(Boolean).join(" ") || null,
      objektiv: daten.LensModel || null,
      brennweite: daten.FocalLength ? daten.FocalLength + " mm" : null,
      blende: daten.FNumber ? "f/" + daten.FNumber : null,
      iso: daten.ISO || null,
      belichtung: daten.ExposureTime ? "1/" + Math.round(1 / daten.ExposureTime) + "s" : null,
      lat: typeof daten.latitude === "number" ? daten.latitude : null,
      lon: typeof daten.longitude === "number" ? daten.longitude : null,
    };
  } catch (e) {
    return {};
  }
}

function renderSeite(eintrag, alleSlugs, tagsEintrag) {
  const { datei, slug, exif } = eintrag;
  const bildUrl = "../bilder/" + encodeURIComponent(datei);

  const felder = [
    ["Aufnahmedatum", formatDatum(exif.datum)],
    ["Kamera", exif.kamera],
    ["Objektiv", exif.objektiv],
    ["Brennweite", exif.brennweite],
    ["Blende", exif.blende],
    ["ISO", exif.iso],
    ["Belichtungszeit", exif.belichtung],
  ];

  const geoZeile = (exif.lat && exif.lon)
    ? `<tr><td>GPS</td><td>${exif.lat.toFixed(5)}, ${exif.lon.toFixed(5)} · <a href="../karte.html?fokus=${encodeURIComponent(datei)}">auf Karte zeigen</a></td></tr>`
    : `<tr><td>GPS</td><td>— keine Geodaten</td></tr>`;

  const tabelle = felder
    .map(([label, wert]) => `<tr><td>${label}</td><td>${wert ? escapeHtml(wert) : "—"}</td></tr>`)
    .join("") + geoZeile;

  // Tags/Querverweise werden NICHT hier eingebacken -- die lädt edit.js zur
  // Laufzeit aus data/tags.json, damit "Edit" auf der Seite funktioniert
  // ohne dass jedes Mal neu gebaut werden muss.

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>fotowiki/ ${escapeHtml(datei)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:title" content="fotowiki/ ${escapeHtml(datei)}">
<meta property="og:image" content="${bildUrl}">
<meta property="og:type" content="article">
<!-- Automatisch generiert von scripts/build-fotowiki.js. Nicht von Hand editieren --
     Aenderungen an Tags/Querverweisen in wiki-fotos/data/tags.json vornehmen. -->
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #0a0a0a; color: #d6d6d0; font-family: "IBM Plex Mono", "Courier New", monospace; font-size: 12px; }
  header { padding: 1rem 1.2rem 0.8rem; border-bottom: 1px solid #2a2a26; color: #6b6b62; }
  header a { color: #9a9a8e; text-decoration: none; }
  main { padding: 1.2rem; max-width: 720px; }
  .grossbild { background: #161614; margin-bottom: 1rem; text-align: center; }
  .grossbild img { max-width: 100%; max-height: 70vh; display: inline-block; }
  table { border-collapse: collapse; width: 100%; font-size: 11.5px; margin-bottom: 1.2rem; }
  td { padding: 0.3rem 0.6rem; border-bottom: 1px solid #1e1e1a; color: #b8b8ac; }
  td:first-child { color: #6b6b62; width: 9rem; }
  a { color: #6ea36e; }
  .tags span { display: inline-block; border: 1px solid #3a3a34; color: #9a9a8e; padding: 0.15rem 0.5rem; margin: 0 0.4rem 0.4rem 0; font-size: 10.5px; }
  .verwandt a, .verwandt span { display: block; margin-bottom: 0.3rem; }
  .leer { color: #6b6b62; }
  h2 { font-size: 11px; color: #6b6b62; text-transform: uppercase; letter-spacing: 0.06em; margin: 1.4rem 0 0.5rem; font-weight: normal; display: flex; justify-content: space-between; align-items: baseline; }
  .fw-edit-link { color: #6ea36e; text-transform: none; letter-spacing: normal; font-size: 10.5px; text-decoration: none; }
  .fw-edit-settings label, .fw-edit-form label { display: block; font-size: 10.5px; color: #9a9a8e; margin: 0.5rem 0 0.2rem; }
  .fw-edit-settings input, .fw-edit-form input { background: #161614; border: 1px solid #3a3a34; color: #d6d6d0; padding: 0.3rem; font-family: inherit; font-size: 11px; }
  .fw-edit-settings button, .fw-edit-form button { margin-top: 0.6rem; background: #1e2e1e; color: #9a9a8e; border: 1px solid #3a3a34; padding: 0.3rem 0.7rem; font-family: inherit; font-size: 10.5px; cursor: pointer; }
  .fw-edit-hinweis { font-size: 10.5px; color: #6b6b62; max-width: 44ch; }
  #fw-save-status, #fw-settings-status { font-size: 10.5px; color: #6ea36e; margin-left: 0.5rem; }
</style>
</head>
<body>
<header><a href="../../">hub</a> / <a href="../index.html">fotowiki</a> / ${escapeHtml(datei)}</header>
<main>
  <div class="grossbild"><img src="${bildUrl}" alt="${escapeHtml(datei)}"></div>
  <table>${tabelle}</table>
  <div id="tags-bereich">lädt …</div>
</main>
<script>window.FOTOWIKI_DATEI = ${JSON.stringify(datei)};</script>
<script src="../edit.js"></script>
</body>
</html>
`;
}

async function main() {
  if (!fs.existsSync(BILDER_DIR)) {
    console.error("Ordner nicht gefunden: " + BILDER_DIR);
    process.exit(1);
  }
  fs.mkdirSync(SEITEN_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

  const dateien = fs
    .readdirSync(BILDER_DIR)
    .filter((f) => ERLAUBTE_ENDUNGEN.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "de"));

  let tags = {};
  if (fs.existsSync(TAGS_PATH)) {
    try { tags = JSON.parse(fs.readFileSync(TAGS_PATH, "utf8")); } catch (e) { tags = {}; }
  }
  let neueTags = 0;
  for (const datei of dateien) {
    if (!(datei in tags)) {
      tags[datei] = { tags: [], verwandt: [] };
      neueTags++;
    }
  }
  fs.writeFileSync(TAGS_PATH, JSON.stringify(tags, null, 2) + "\n");

  const slugs = eindeutigeSlugs(dateien);

  const eintraege = [];
  for (const datei of dateien) {
    const exif = await leseExif(path.join(BILDER_DIR, datei));
    eintraege.push({ datei, slug: slugs[datei], exif });
  }

  const manifest = eintraege.map((e) => ({
    datei: e.datei,
    slug: e.slug,
    ...e.exif,
  }));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  // Alte generierte Seiten entfernen, deren Bild nicht mehr existiert
  const aktuelleSlugs = new Set(Object.values(slugs));
  if (fs.existsSync(SEITEN_DIR)) {
    for (const f of fs.readdirSync(SEITEN_DIR)) {
      if (f.endsWith(".html") && !aktuelleSlugs.has(path.parse(f).name)) {
        fs.unlinkSync(path.join(SEITEN_DIR, f));
      }
    }
  }

  for (const eintrag of eintraege) {
    const html = renderSeite(eintrag, slugs, tags[eintrag.datei]);
    fs.writeFileSync(path.join(SEITEN_DIR, eintrag.slug + ".html"), html);
  }

  console.log(`${dateien.length} Bild(er) verarbeitet, ${neueTags} neue Tag-Stubs angelegt.`);
}

main();
