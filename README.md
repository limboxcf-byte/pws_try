# Rabbit-Hole Website -- Prototyp (v6)

## WICHTIG: so bringst du das jetzt zuverlaessig ins Repo

Bitte NICHT einzelne Dateien nachtragen -- das hat beim letzten Mal zum
Problem gefuehrt (das .github-Verzeichnis ist "versteckt" und wird von
vielen Datei-Explorern beim Hochladen uebersprungen).

**Am sichersten:** loesche den gesamten Inhalt deines Repos und ersetze
ihn komplett durch den Inhalt dieses Zips -- entweder per `git` auf der
Kommandozeile, per GitHub Desktop, oder indem du in deinem Datei-Explorer
vorher "versteckte Dateien anzeigen" aktivierst, bevor du den entpackten
Ordner per Drag & Drop in GitHub hochlaedst. Git selbst hat kein Problem
mit versteckten Ordnern -- nur manche Explorer/Browser-Uploads blenden sie
aus, wenn man sie nicht extra einschaltet.

Nach dem Hochladen einmal pruefen (direkt auf GitHub nachsehen, nicht nur
lokal):
- `.github/workflows/fotowiki-manifest.yml` vorhanden?
- `scripts/build-fotowiki.js` vorhanden?
- `package.json` im Root vorhanden?
- `.assetsignore` und `wrangler.jsonc` im Root vorhanden?

## Deployment (Cloudflare Workers Static Assets)

Cloudflare deployt dieses Repo als Workers-Projekt mit statischen Assets
(`npx wrangler deploy`). Zwei Dateien steuern das:

- `wrangler.jsonc` -- Projektkonfiguration. Falls dein Cloudflare-Projekt
  anders heisst, den `name` hier anpassen.
- `.assetsignore` -- schliesst node_modules, scripts/, .github/,
  package.json etc. vom Upload aus. Ohne diese Datei laedt Wrangler auch
  seine eigene ~150-MB-Binaerdatei mit hoch und das Deployment schlaegt
  mit "Asset too large" fehl.

Kein manueller Build-Command noetig -- Cloudflare erkennt das Projekt
automatisch.

## Struktur
- `/` -- Hub. Jede Karte im Stil ihrer Zielsektion.
- `/wiki-fotos/` -- automatisches Camera-Roll-Wiki:
  - `bilder/` -- JPEG/PNG-Dateien reinlegen, sonst nichts tun
  - `bild/<slug>.html` -- eigene, generierte Seite pro Bild (Titel,
    og:image, EXIF-Tabelle). Tags/Querverweise werden dort **live editierbar**
    (siehe unten).
  - `data/manifest.json` -- EXIF-Metadaten pro Bild, von der Action erzeugt
  - `data/tags.json` -- Tags/Querverweise, wird sowohl von der Action
    (leere Stubs fuer neue Bilder) als auch direkt aus dem Browser heraus
    (beim Bearbeiten) geschrieben
  - `edit.js` -- die Bearbeiten-Funktion, siehe unten
  - `index.html` -- Grid
  - `karte.html` -- Leaflet/OSM-Karte mit Bild-Vorschau im Popup
- `/wiki-arbeiten/`, `/notizen/`, `/library/`, `/screenshots/`,
  `/ehrerbietungen/`, `/blocks/` -- noch statisch/handgepflegt.

## Workflow fuer neue Fotos
1. JPEG/PNG in `wiki-fotos/bilder/` legen, committen, pushen.
2. Die Action liest EXIF, aktualisiert `manifest.json`, legt fuer neue
   Bilder einen leeren Tag-Stub an, generiert `bild/<slug>.html`.
3. Cloudflare deployt automatisch neu.

Voraussetzung: Repo-Settings -> Actions -> General -> Workflow permissions
-> "Read and write permissions", sonst darf die Action nicht zurueckpushen.

## Tags/Querverweise direkt auf der Seite bearbeiten

Jede Bild-Seite (`bild/<slug>.html`) hat einen "[Edit]"-Link neben "Tags".
Klick oeffnet ein Formular fuer Tags und verwandte Bilder (Dateinamen,
kommagetrennt). "Speichern" committet die aktualisierte `tags.json` direkt
über die GitHub-API ins Repo -- kein eigener Server noetig.

Einmalig beim ersten Bearbeiten wird nach folgendem gefragt (wird danach
im Browser gespeichert, `localStorage`, nur lokal, nirgendwo sonst):
- GitHub-Benutzername/Organisation
- Repo-Name
- Branch (normalerweise `main`)
- Ein **Personal Access Token** mit Schreibrecht auf dieses eine Repo

### Token erstellen (empfohlen: fein granuliert, nur fuer dieses Repo)
GitHub -> Settings -> Developer settings -> Personal access tokens ->
Fine-grained tokens -> "Generate new token" -> Repository access auf genau
dieses Repo beschraenken -> unter Permissions "Contents" auf
"Read and write" setzen. Das Token kannst du jederzeit in GitHub wieder
loeschen/widerrufen.

**Sicherheitshinweis:** das Token liegt im `localStorage` des Browsers, in
dem du es einmal eingibst. Auf einem geteilten Geraet solltest du es nach
Gebrauch in den GitHub-Einstellungen widerrufen, oder ein Token mit
moeglichst engem Geltungsbereich verwenden (nur dieses Repo, nur Contents).
Nach dem Speichern dauert es i.d.R. unter einer Minute, bis Cloudflare die
Aenderung live zeigt (eigener Redeploy durch den Commit ausgeloest).

## Lokal testen
```
npm install
node scripts/build-fotowiki.js
```

## Offene Punkte
- `wiki-arbeiten/`, `notizen/`, `library/`, `screenshots/`,
  `ehrerbietungen/`, `blocks/` sind noch mit `[PLATZHALTER]` befuellt.
- `karte.html` und die Bild-Seiten brauchen Internetzugriff fuer Leaflet
  (CDN) bzw. die GitHub-API.
