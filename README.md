# Rabbit-Hole Website -- Prototype (v7)

Site content is in English. This README stays in German since it's a
dev/deploy doc, not part of the site (it's excluded from deployment via
.assetsignore anyway).

## WICHTIG: so bringst du das ins Repo

Bitte NICHT einzelne Dateien nachtragen -- das .github-Verzeichnis ist
"versteckt" und wird von vielen Datei-Explorern beim Hochladen
uebersprungen. Ersetze den gesamten Repo-Inhalt durch den Inhalt dieses
Zips (per `git`, GitHub Desktop, oder mit aktivierter "versteckte Dateien
anzeigen"-Option). Danach direkt auf GitHub pruefen (nicht nur lokal):

- `.github/workflows/fotowiki-manifest.yml`
- `.github/workflows/screenshots-manifest.yml`
- `scripts/build-fotowiki.js`, `scripts/build-screenshots.js`
- `package.json`, `.assetsignore`, `wrangler.jsonc` (alle im Root)

## Deployment (Cloudflare Workers Static Assets)

Laeuft ueber `npx wrangler deploy`, gesteuert von `wrangler.jsonc`
(Projektname -- ggf. anpassen) und `.assetsignore` (schliesst
node_modules, scripts/, .github/, package.json etc. vom Upload aus --
ohne das schlaegt der Deploy mit "Asset too large" fehl, weil Wranglers
eigene ~150-MB-Binaerdatei sonst mit hochgeladen wird).

## Struktur
- `/` -- Hub.
- `/wiki-fotos/` -- automatisches Camera-Roll-Wiki. Bilder in `bilder/`
  legen, pushen. Die Action liest EXIF, schreibt `data/manifest.json`,
  generiert `bild/<slug>.html` pro Bild (eigener Titel, og:image,
  Back-Button, Download-Button mit Creative-Commons-Verweis -- Lizenz als
  Konstante `LICENSE_NAME`/`LICENSE_URL` oben in `scripts/build-fotowiki.js`,
  aktuell CC BY-NC-ND 4.0 als Platzhalter). Tags/verwandte Bilder direkt
  auf der Seite bearbeitbar ueber den "[Edit]"-Link -- siehe unten.
- `/wiki-arbeiten/`, `/notizen/`, `/library/`, `/ehrerbietungen/`,
  `/blocks/` -- statisch, mit [PLACEHOLDER] befuellt.
- `/screenshots/` -- **jetzt ebenfalls automatisch**: PNG/JPEG in
  `screenshots/bilder/` legen, pushen. Die zweite Action
  (`screenshots-manifest.yml`) generiert `data/manifest.json`, die
  Galerie liest es zur Laufzeit. Sortierung: Dateiname, natuerlich
  sortiert (Zahlen vorne fuer volle Kontrolle, z.B. `01-foo.png`).

## Tags direkt auf der Seite bearbeiten
Jede Bild-Seite unter `wiki-fotos/bild/` hat einen "[Edit]"-Link. Falls er
bei dir fehlt: die Seite wurde mit einer aelteren Version des Skripts
gebaut. Im Actions-Tab den Workflow "fotowiki-manifest" manuell per
"Run workflow" ausloesen (workflow_dispatch) -- das baut alle Seiten mit
dem aktuellen Skript neu, auch ohne neues Bild.

Einmalig beim ersten Bearbeiten wird abgefragt (danach nur im Browser
gespeichert, `localStorage`):
- GitHub-Benutzername/Organisation, Repo-Name, Branch
- Ein Personal Access Token mit Schreibrecht auf dieses eine Repo
  (GitHub -> Settings -> Developer settings -> Fine-grained tokens ->
  Repository access auf dieses Repo beschraenken -> Contents: Read and
  write)

Sicherheitshinweis: das Token liegt im localStorage des Browsers, in dem
du es eingibst. Auf geteilten Geraeten danach in GitHub widerrufen.

## Lokal testen
```
npm install
node scripts/build-fotowiki.js
node scripts/build-screenshots.js
```

## Offene Punkte
- `wiki-arbeiten/`, `notizen/`, `library/`, `ehrerbietungen/`, `blocks/`
  sind noch mit `[PLACEHOLDER]` befuellt.
- Lizenztext auf den Bild-Seiten ist ein Platzhalter (CC BY-NC-ND 4.0) --
  in `scripts/build-fotowiki.js` anpassen, falls eine andere Lizenz
  gewuenscht ist.
