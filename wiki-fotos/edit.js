// wiki-fotos/edit.js
//
// Ermöglicht das Bearbeiten von Tags/Querverweisen direkt auf der
// Bild-Seite -- wie ein "Edit"-Link in einem klassischen Wiki. Es gibt
// keinen eigenen Server: "Speichern" committet die aktualisierte
// data/tags.json direkt über die GitHub-API ins Repo. Danach deployt
// Cloudflare automatisch neu (üblicherweise unter einer Minute).
//
// Zugangsdaten (GitHub-Benutzername/Repo/Branch + ein Personal Access
// Token mit Schreibrecht auf dieses Repo) werden einmalig abgefragt und
// im Browser (localStorage) gespeichert -- nicht irgendwo sonst.
//
// Wird nur auf Seiten aktiv, die vorher `window.FOTOWIKI_DATEI` setzen
// (siehe generierte Seiten unter wiki-fotos/bild/).

(function () {
  const LS_KEY = "fotowiki_edit_config";

  function ladeConfig() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function speichereConfig(cfg) {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  function b64EncodeUnicode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function b64DecodeUnicode(b64) {
    const binary = atob(b64.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function ladeJSON(pfad) {
    try {
      const r = await fetch(pfad, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  function parseListe(text) {
    return text.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // GitHub Contents API. Bewusst OHNE den Header "X-GitHub-Api-Version" --
  // der bricht CORS-Preflight-Requests aus dem Browser.
  async function githubGetDatei(cfg) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/wiki-fotos/data/tags.json?ref=${encodeURIComponent(cfg.branch)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: "token " + cfg.token,
        Accept: "application/vnd.github+json",
      },
    });
    if (!r.ok) throw new Error("GET fehlgeschlagen: " + r.status);
    const daten = await r.json();
    return { inhalt: JSON.parse(b64DecodeUnicode(daten.content)), sha: daten.sha };
  }

  async function githubPutDatei(cfg, inhaltObjekt, sha, commitMsg) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/wiki-fotos/data/tags.json`;
    const body = {
      message: commitMsg,
      content: b64EncodeUnicode(JSON.stringify(inhaltObjekt, null, 2) + "\n"),
      sha: sha,
      branch: cfg.branch,
    };
    const r = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "token " + cfg.token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const fehler = await r.json().catch(() => ({}));
      throw new Error("PUT fehlgeschlagen: " + r.status + " " + (fehler.message || ""));
    }
    return r.json();
  }

  function renderEinstellungenForm(container, onGespeichert) {
    const bestehend = ladeConfig() || {};
    container.innerHTML = `
      <div class="fw-edit-settings">
        <p class="fw-edit-hinweis">Einmalig einrichten: GitHub-Repo und ein Personal Access Token mit Schreibrecht (Contents: Read and write) auf dieses Repo. Wird nur in diesem Browser gespeichert.</p>
        <label>GitHub-Benutzer/Organisation<br><input type="text" id="fw-owner" value="${bestehend.owner || ""}" placeholder="z.B. tobiashohn"></label><br>
        <label>Repo-Name<br><input type="text" id="fw-repo" value="${bestehend.repo || ""}" placeholder="z.B. rabbithole-site"></label><br>
        <label>Branch<br><input type="text" id="fw-branch" value="${bestehend.branch || "main"}"></label><br>
        <label>Personal Access Token<br><input type="password" id="fw-token" value="${bestehend.token || ""}" placeholder="ghp_…"></label><br>
        <button type="button" id="fw-save-settings">Speichern</button>
        <span id="fw-settings-status"></span>
      </div>`;
    container.querySelector("#fw-save-settings").addEventListener("click", () => {
      const cfg = {
        owner: container.querySelector("#fw-owner").value.trim(),
        repo: container.querySelector("#fw-repo").value.trim(),
        branch: container.querySelector("#fw-branch").value.trim() || "main",
        token: container.querySelector("#fw-token").value.trim(),
      };
      if (!cfg.owner || !cfg.repo || !cfg.token) {
        container.querySelector("#fw-settings-status").textContent = " bitte alle Felder ausfüllen";
        return;
      }
      speichereConfig(cfg);
      onGespeichert(cfg);
    });
  }

  function renderAnzeige(container, datei, tagsEintrag, slugVonDatei) {
    const tags = (tagsEintrag && tagsEintrag.tags) || [];
    const verwandt = (tagsEintrag && tagsEintrag.verwandt) || [];

    const tagsHtml = tags.length
      ? tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")
      : `<span class="leer">keine Tags hinterlegt</span>`;

    const verwandtHtml = verwandt.length
      ? verwandt.map((v) => {
          const slug = slugVonDatei[v];
          return slug
            ? `<a href="${escapeHtml(slug)}.html">→ ${escapeHtml(v)}</a>`
            : `<span class="leer">→ ${escapeHtml(v)} (nicht im Bestand)</span>`;
        }).join("")
      : `<span class="leer">keine Verknüpfung hinterlegt</span>`;

    container.innerHTML = `
      <h2>Tags <a href="#" class="fw-edit-link" id="fw-edit-btn">[Edit]</a></h2>
      <div class="tags">${tagsHtml}</div>
      <h2>Verwandte Bilder</h2>
      <div class="verwandt">${verwandtHtml}</div>
      <div id="fw-edit-bereich"></div>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  async function init() {
    const datei = window.FOTOWIKI_DATEI;
    const container = document.getElementById("tags-bereich");
    if (!datei || !container) return;

    const [tagsAlle, manifest] = await Promise.all([
      ladeJSON("../data/tags.json"),
      ladeJSON("../data/manifest.json"),
    ]);

    const slugVonDatei = {};
    (manifest || []).forEach((e) => { slugVonDatei[e.datei] = e.slug; });

    let aktuellerEintrag = (tagsAlle && tagsAlle[datei]) || { tags: [], verwandt: [] };
    renderAnzeige(container, datei, aktuellerEintrag, slugVonDatei);

    container.querySelector("#fw-edit-btn").addEventListener("click", (ev) => {
      ev.preventDefault();
      const bereich = container.querySelector("#fw-edit-bereich");
      if (bereich.dataset.offen === "1") { bereich.innerHTML = ""; bereich.dataset.offen = "0"; return; }
      bereich.dataset.offen = "1";
      zeigeEditForm(bereich, datei, aktuellerEintrag, (neuerEintrag) => {
        aktuellerEintrag = neuerEintrag;
        renderAnzeige(container, datei, aktuellerEintrag, slugVonDatei);
        container.querySelector("#fw-edit-btn").click(); // Edit-Link neu binden
      });
    });
  }

  function zeigeEditForm(bereich, datei, eintrag, onGespeichertUndFertig) {
    const cfg = ladeConfig();
    if (!cfg) {
      renderEinstellungenForm(bereich, () => zeigeEditForm(bereich, datei, eintrag, onGespeichertUndFertig));
      return;
    }

    bereich.innerHTML = `
      <div class="fw-edit-form">
        <label>Tags (kommagetrennt)<br><input type="text" id="fw-tags-input" value="${escapeHtml(eintrag.tags.join(", "))}" style="width:100%"></label><br>
        <label>Verwandte Bilder, Dateinamen (kommagetrennt)<br><input type="text" id="fw-verwandt-input" value="${escapeHtml(eintrag.verwandt.join(", "))}" style="width:100%"></label><br>
        <button type="button" id="fw-speichern">Speichern</button>
        <button type="button" id="fw-einstellungen-aendern" style="margin-left:0.5rem;">Zugangsdaten ändern</button>
        <span id="fw-save-status"></span>
      </div>`;

    bereich.querySelector("#fw-einstellungen-aendern").addEventListener("click", () => {
      renderEinstellungenForm(bereich, () => zeigeEditForm(bereich, datei, eintrag, onGespeichertUndFertig));
    });

    bereich.querySelector("#fw-speichern").addEventListener("click", async () => {
      const status = bereich.querySelector("#fw-save-status");
      status.textContent = " speichere …";
      const neueTags = parseListe(bereich.querySelector("#fw-tags-input").value);
      const neueVerwandt = parseListe(bereich.querySelector("#fw-verwandt-input").value);

      try {
        const { inhalt, sha } = await githubGetDatei(cfg);
        inhalt[datei] = { tags: neueTags, verwandt: neueVerwandt };
        await githubPutDatei(cfg, inhalt, sha, `fotowiki: Tags aktualisiert für ${datei}`);
        status.textContent = " gespeichert -- live in ca. 1 Minute";
        onGespeichertUndFertig({ tags: neueTags, verwandt: neueVerwandt });
      } catch (e) {
        status.textContent = " Fehler: " + e.message + " (Token ohne Schreibrecht oder falsches Repo?)";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
