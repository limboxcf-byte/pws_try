// wiki-fotos/edit.js
//
// Lets you edit tags/related images directly on the image page -- like an
// "Edit" link in a classic wiki. There's no server of our own: "Save"
// commits the updated data/tags.json straight to the repo via the GitHub
// API. Cloudflare then redeploys automatically (usually well under a
// minute).
//
// Credentials (GitHub owner/repo/branch + a Personal Access Token with
// write access to this repo) are asked for once and stored in this
// browser (localStorage) -- nowhere else.
//
// Only activates on pages that set `window.FOTOWIKI_DATEI` beforehand
// (see the generated pages under wiki-fotos/bild/).

(function () {
  const LS_KEY = "fotowiki_edit_config";

  function loadConfig() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveConfig(cfg) {
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

  async function loadJSON(path) {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  function parseList(text) {
    return text.split(",").map((s) => s.trim()).filter(Boolean);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // GitHub Contents API. Deliberately WITHOUT the "X-GitHub-Api-Version"
  // header -- that one breaks CORS preflight requests from the browser.
  async function githubGetFile(cfg) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/wiki-fotos/data/tags.json?ref=${encodeURIComponent(cfg.branch)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: "token " + cfg.token,
        Accept: "application/vnd.github+json",
      },
    });
    if (!r.ok) throw new Error("GET failed: " + r.status);
    const data = await r.json();
    return { content: JSON.parse(b64DecodeUnicode(data.content)), sha: data.sha };
  }

  async function githubPutFile(cfg, contentObject, sha, commitMsg) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/wiki-fotos/data/tags.json`;
    const body = {
      message: commitMsg,
      content: b64EncodeUnicode(JSON.stringify(contentObject, null, 2) + "\n"),
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
      const err = await r.json().catch(() => ({}));
      throw new Error("PUT failed: " + r.status + " " + (err.message || ""));
    }
    return r.json();
  }

  function renderSettingsForm(container, onSaved) {
    const existing = loadConfig() || {};
    container.innerHTML = `
      <div class="fw-edit-settings">
        <p class="fw-edit-hinweis">One-time setup: the GitHub repo this site lives in, and a Personal Access Token with write access (Contents: Read and write) to it. Stored only in this browser.</p>
        <label>GitHub username/organisation<br><input type="text" id="fw-owner" value="${existing.owner || ""}" placeholder="e.g. tobiashohn"></label><br>
        <label>Repo name<br><input type="text" id="fw-repo" value="${existing.repo || ""}" placeholder="e.g. rabbithole-site"></label><br>
        <label>Branch<br><input type="text" id="fw-branch" value="${existing.branch || "main"}"></label><br>
        <label>Personal Access Token<br><input type="password" id="fw-token" value="${existing.token || ""}" placeholder="ghp_…"></label><br>
        <button type="button" id="fw-save-settings">Save</button>
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
        container.querySelector("#fw-settings-status").textContent = " please fill in all fields";
        return;
      }
      saveConfig(cfg);
      onSaved(cfg);
    });
  }

  function renderDisplay(container, tagsEntry, slugByFile) {
    const tags = (tagsEntry && tagsEntry.tags) || [];
    const related = (tagsEntry && tagsEntry.verwandt) || [];

    const tagsHtml = tags.length
      ? tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")
      : `<span class="leer">no tags set</span>`;

    const relatedHtml = related.length
      ? related.map((v) => {
          const slug = slugByFile[v];
          return slug
            ? `<a href="${escapeHtml(slug)}.html">→ ${escapeHtml(v)}</a>`
            : `<span class="leer">→ ${escapeHtml(v)} (not in the archive)</span>`;
        }).join("")
      : `<span class="leer">no related images set</span>`;

    container.innerHTML = `
      <h2>Tags <a href="#" class="fw-edit-link" data-role="edit-toggle">[Edit]</a></h2>
      <div class="tags">${tagsHtml}</div>
      <h2>Related images</h2>
      <div class="verwandt">${relatedHtml}</div>
      <div id="fw-edit-bereich"></div>
    `;
  }

  function showEditForm(area, file, entry, cfgOverride, onSavedAndDone) {
    const cfg = cfgOverride || loadConfig();
    if (!cfg) {
      renderSettingsForm(area, (savedCfg) => showEditForm(area, file, entry, savedCfg, onSavedAndDone));
      return;
    }

    area.innerHTML = `
      <div class="fw-edit-form">
        <label>Tags (comma-separated)<br><input type="text" id="fw-tags-input" value="${escapeHtml(entry.tags.join(", "))}"></label><br>
        <label>Related images, filenames (comma-separated)<br><input type="text" id="fw-verwandt-input" value="${escapeHtml(entry.verwandt.join(", "))}"></label><br>
        <button type="button" id="fw-speichern">Save</button>
        <button type="button" id="fw-einstellungen-aendern" style="margin-left:0.5rem;">Change credentials</button>
        <span id="fw-save-status"></span>
      </div>`;

    area.querySelector("#fw-einstellungen-aendern").addEventListener("click", () => {
      renderSettingsForm(area, (savedCfg) => showEditForm(area, file, entry, savedCfg, onSavedAndDone));
    });

    area.querySelector("#fw-speichern").addEventListener("click", async () => {
      const status = area.querySelector("#fw-save-status");
      status.textContent = " saving …";
      const newTags = parseList(area.querySelector("#fw-tags-input").value);
      const newRelated = parseList(area.querySelector("#fw-verwandt-input").value);

      try {
        const { content, sha } = await githubGetFile(cfg);
        content[file] = { tags: newTags, verwandt: newRelated };
        await githubPutFile(cfg, content, sha, `photo wiki: updated tags for ${file}`);
        status.textContent = " saved -- live in about a minute";
        onSavedAndDone({ tags: newTags, verwandt: newRelated });
      } catch (e) {
        status.textContent = " Error: " + e.message + " (token without write access, or wrong repo?)";
      }
    });
  }

  async function init() {
    const file = window.FOTOWIKI_DATEI;
    const container = document.getElementById("tags-bereich");
    if (!file || !container) return;

    const [tagsAll, manifest] = await Promise.all([
      loadJSON("../data/tags.json"),
      loadJSON("../data/manifest.json"),
    ]);

    const slugByFile = {};
    (manifest || []).forEach((e) => { slugByFile[e.file] = e.slug; });

    let currentEntry = (tagsAll && tagsAll[file]) || { tags: [], verwandt: [] };
    renderDisplay(container, currentEntry, slugByFile);

    // Event delegation on the stable outer container -- the [Edit] link
    // itself gets replaced whenever renderDisplay() re-runs (e.g. after
    // saving), so a listener bound directly to that link would be lost.
    // Binding to `container` instead means it keeps working every time.
    container.addEventListener("click", (ev) => {
      const toggle = ev.target.closest('[data-role="edit-toggle"]');
      if (!toggle) return;
      ev.preventDefault();
      const area = container.querySelector("#fw-edit-bereich");
      if (area.dataset.open === "1") {
        area.innerHTML = "";
        area.dataset.open = "0";
        return;
      }
      area.dataset.open = "1";
      showEditForm(area, file, currentEntry, null, (newEntry) => {
        currentEntry = newEntry;
        renderDisplay(container, currentEntry, slugByFile);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
