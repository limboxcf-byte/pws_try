# Rabbit-Hole Website -- Prototyp (v4)

Statisches Multi-Page-Setup, kein Build-Step bei Cloudflare selbst. Deploy:
Repo mit Cloudflare Pages verbinden, Build-Command leer lassen,
Output-Verzeichnis = `/`. Eine GitHub Action laeuft zusaetzlich im Repo
(nicht bei Cloudflare) und generiert die Foto-Seiten automatisch.

## Struktur
- `/` -- Hub. Jede Karte im Stil ihrer Zielsektion.
- `/wiki-fotos/` -- **automatisches** Camera-Roll-Wiki:
  - `bilder/` -- hier JPEG/PNG-Dateien reinlegen, sonst nichts tun
  - `bild/<slug>.html` -- **eine eigene, statische Seite pro Bild**,
    automatisch generiert (Titel, og:image, EXIF-Tabelle, Tags,
    Querverweise). Funktioniert ohne JavaScript, hat eine eigene
    Linkvorschau beim Teilen.
  - `data/manifest.json` -- fertige Metadaten pro Bild (Slug, EXIF, GPS),
    von der Action beim Build aus den Dateien gelesen
  - `data/tags.json` -- Tags/Querverweise pro Bild, **Handarbeit** (Kameras
    liefern keine Kategorien); die Action legt fuer neue Bilder automatisch
    einen leeren Stub an, du musst nur noch fuellen
  - `index.html` -- Grid, liest nur noch das fertige Manifest, kein
    Nachladen einzelner Bilder mehr noetig
  - `karte.html` -- Leaflet/OSM-Karte, Koordinaten kommen ebenfalls
    fertig aus dem Manifest; `?fokus=Dateiname` zentriert auf ein Bild
- `/wiki-arbeiten/`, `/notizen/`, `/library/`, `/screenshots/`,
  `/ehrerbietungen/`, `/blocks/` -- wie zuvor, noch statisch/handgepflegt.

## Workflow fuer neue Fotos
1. JPEG/PNG in `wiki-fotos/bilder/` legen.
2. Committen und pushen.
3. Die Action `.github/workflows/fotowiki-manifest.yml`:
   - installiert die Node-Abhaengigkeit `exifr` (aus `package.json`)
   - liest EXIF aus jedem Bild
   - schreibt `manifest.json` und ergaenzt `tags.json` um neue Stubs
   - generiert/aktualisiert `bild/<slug>.html` fuer jedes Bild
   - committet alles automatisch zurueck
4. Cloudflare Pages erkennt den neuen Commit und deployt erneut.
5. Optional: in `tags.json` fuer das neue Bild Tags/Querverweise eintragen
   (Dateiname als Schluessel, `verwandt` referenziert andere Dateinamen).

Voraussetzung: Die Action braucht Schreibrechte auf den Branch
(Repo-Settings -> Actions -> General -> Workflow permissions ->
"Read and write permissions").

## Lokal testen
```
npm install
node scripts/build-fotowiki.js
```
Erzeugt/aktualisiert manifest.json, tags.json und die Einzelseiten aus dem
aktuellen Inhalt von `wiki-fotos/bilder/`.

## Offene Punkte
- `wiki-arbeiten/`, `notizen/`, `library/`, `screenshots/`,
  `ehrerbietungen/`, `blocks/` sind noch mit `[PLATZHALTER]` befuellt.
- `karte.html` braucht beim Aufruf Internetzugriff fuer Leaflet (CDN) und
  OSM-Kartenkacheln.
- Kategorien/Querverweise in `tags.json` bleiben manuell -- bewusste
  Grenze, keine technische Luecke: Kameras liefern keine Semantik.
