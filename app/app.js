import {
  Calculator, formatShort, formatWords, formatFull, unitLabel, parseNumberFromText, windowAround,
} from "./core.js";

const DATA_BASES = ["../Daten/", "Daten/"];
const PANE_HASHES = ["vergleiche", "zahl", "fuer-mich"];
const STEP = 8;   // entries shown above and below the user's number, and per "more" click

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const state = {
  calc: new Calculator(),
  data: null,
  listId: "",            // "" = all lists
  below: STEP,
  above: STEP,
  expanded: null,
  unit: "EUR",
  pane: 1,
  lastClip: null,
};

// --- Data ---------------------------------------------------------------------------

async function loadJson(name) {
  for (const base of DATA_BASES) {
    try {
      const res = await fetch(base + name);
      if (res.ok) return await res.json();
    } catch { /* try next base */ }
  }
  throw new Error(`${name} nicht gefunden`);
}

async function loadData() {
  const [entries, lists, listEntries, contexts] = await Promise.all(
    ["entries.json", "lists.json", "list_entries.json", "mean2me_contexts.json"].map(loadJson));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const listsOf = new Map();
  const notes = new Map();
  for (const le of listEntries) {
    if (!listsOf.has(le.entry_id)) listsOf.set(le.entry_id, new Set());
    listsOf.get(le.entry_id).add(le.list_id);
    if (le.note) notes.set(le.entry_id, le.note);
  }
  const sorted = [...entries].sort((a, b) => a.value_original - b.value_original);
  return { entries, byId, lists, listsOf, notes, sorted, contexts };
}

// --- Rendering --------------------------------------------------------------------------

const value = () => state.calc.value();

function renderDisplay() {
  const v = value();
  const calc = state.calc;
  $("#expr").textContent = calc.isExpression ? calc.expressionText() : "";
  $("#result").textContent = Number.isFinite(v)
    ? (calc.isExpression ? "= " + formatFull(v) : calc.expressionText())
    : "Fehler";
  fitResult();
  $("#words").textContent = Number.isFinite(v) ? formatWords(v) : "";
  for (const el of document.querySelectorAll('[data-bind="short"]')) {
    el.textContent = Number.isFinite(v) ? formatShort(v) : "–";
  }
}

/** Shrink the result font until the number fits on one line. */
function fitResult() {
  const el = $("#result");
  const max = 51;   // 3.2rem
  el.style.fontSize = `${max}px`;
  const available = el.parentElement.clientWidth - 8;
  if (el.scrollWidth > available) {
    el.style.fontSize = `${Math.max(18, Math.floor(max * available / el.scrollWidth))}px`;
  }
}

function entryRow(e, v) {
  const year = e.title.includes(String(e.year_original)) ? "" : e.year_original;
  const open = state.expanded === e.id;
  const ratio = v > 0 ? `${formatShort(e.value_original / v)} ×` : "";
  const note = state.data.notes.get(e.id);
  const detail = open ? `
    <div class="bn-detail">
      <div>
        ${e.status === "draft" ? '<span class="badge">Entwurf</span>' : ""}
        ${e.confidence_level <= 1 ? '<span class="badge warn">unsicher</span>' : ""}
      </div>
      <p>${esc(e.long_description || e.short_description)}</p>
      <p>Originalwert: ${esc(formatFull(e.value_original))} ${esc(unitLabel(e.unit))} (${esc(e.year_original)}, ${esc(e.country_code)})</p>
      ${note ? `<p>Hinweis: ${esc(note)}</p>` : ""}
      <p>Quelle: <a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(e.source_title)}</a></p>
    </div>` : "";
  return `
    <li data-id="${esc(e.id)}">
      <div class="bn-row">
        <div class="bn-title">${esc(e.title)}${year ? `<small>${esc(year)}</small>` : ""}</div>
        <div>
          <div class="bn-value">${esc(formatShort(e.value_original))} ${esc(unitLabel(e.unit))}</div>
          <div class="bn-ratio">${esc(ratio)}</div>
        </div>
      </div>${detail}
    </li>`;
}

function renderBigNumbers() {
  const { sorted, listsOf } = state.data;
  const v = value();
  const pool = state.listId ? sorted.filter((e) => listsOf.get(e.id)?.has(state.listId)) : sorted;
  const w = windowAround(pool, Number.isFinite(v) ? v : 0, state.below, state.above);
  const mine = `
    <li class="mine" id="bn-mine">
      <div class="bn-row">
        <div class="bn-title">Deine Zahl</div>
        <div><div class="bn-value">${esc(Number.isFinite(v) ? formatShort(v) : "–")}</div></div>
      </div>
    </li>`;
  $("#bn-list").innerHTML =
    w.smaller.map((e) => entryRow(e, v)).join("") + mine + w.larger.map((e) => entryRow(e, v)).join("");
  $("#more-smaller").hidden = !w.moreSmaller;
  $("#more-larger").hidden = !w.moreLarger;
}

function renderListChips() {
  const chips = [{ id: "", name: "Alle" }, ...state.data.lists];
  $("#list-chips").innerHTML = chips.map((l) =>
    `<button data-list="${esc(l.id)}" aria-pressed="${l.id === state.listId}">${esc(l.name)}</button>`).join("");
}

function renderMean2Me() {
  const v = value();
  const { contexts, byId } = state.data;
  const sym = state.unit ? unitLabel(state.unit) : "";
  const items = contexts
    .filter((c) => state.unit || !c.only_currency)
    .map((c) => {
      const source = c.factor_entry_id ? byId.get(c.factor_entry_id) : null;
      const factor = source ? source.value_original : c.factor_value;
      const r = v / factor;
      const shown = c.only_currency ? `${formatShort(r)} Jahre` : `${formatShort(r)} ${sym}`.trim();
      const basis = source
        ? `Bezug: ${formatFull(factor)} ${unitLabel(source.unit)} · ${source.source_title} (${source.year_original})`
        : `Bezug: ${c.factor_source}`;
      return `
        <li>
          <div class="m2m-label">${esc(c.title)}</div>
          <div class="m2m-value">${esc(Number.isFinite(r) ? shown : "–")}</div>
          <div class="m2m-source">${esc(basis)}</div>
        </li>`;
    });
  $("#m2m-list").innerHTML = v ? items.join("") : '<li class="empty">Gib in der Mitte eine Zahl ein.</li>';
  for (const b of document.querySelectorAll("#unit-chips button")) {
    b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit));
  }
}

let urlTimer;
function render() {
  renderDisplay();
  if (state.data) { renderBigNumbers(); renderMean2Me(); }
  clearTimeout(urlTimer);
  urlTimer = setTimeout(updateUrl, 300);
}

function updateUrl() {
  const v = value();
  const query = Number.isFinite(v) && v !== 0 ? `?n=${encodeURIComponent(v)}` : location.pathname;
  history.replaceState(null, "", `${query}#${PANE_HASHES[state.pane]}`);
}

// --- Panes and tabs ---------------------------------------------------------------------

const panes = $("#panes");

function goToPane(i, smooth = true) {
  panes.scrollTo({ left: i * panes.clientWidth, behavior: smooth ? "smooth" : "instant" });
}

function onPaneChange(i) {
  if (i === state.pane) return;
  state.pane = i;
  document.querySelectorAll(".tabs button").forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
  $(".tab-indicator").style.transform = `translateX(${i * 100}%)`;
  if (i === 0) $("#bn-mine")?.scrollIntoView({ block: "center" });
  updateUrl();
}

panes.addEventListener("scroll", () => {
  onPaneChange(Math.round(panes.scrollLeft / panes.clientWidth));
}, { passive: true });
window.addEventListener("resize", () => { goToPane(state.pane, false); fitResult(); });

document.querySelectorAll(".tabs button, .hint-btn").forEach((b) => {
  b.addEventListener("click", () => goToPane(Number(b.dataset.pane ?? b.dataset.goto)));
});

// --- Keypad -------------------------------------------------------------------------------

function snapshot() {
  const c = state.calc;
  return { tokens: [...c.tokens], cur: c.cur, fresh: c.fresh };
}

function press(k) {
  const c = state.calc;
  hideClipNote();
  if (/^\d$/.test(k)) c.digit(k);
  else if (k === "000") c.thousand();
  else if (k === ",") c.comma();
  else if ("+-*/".includes(k)) c.op(k);
  else if (k === "=") c.equals();
  else if (k === "C") c.clear();
  else if (k === "back") c.back();
  else if (k === "paste") { readClipboard(false); return; }
  state.below = state.above = STEP;
  render();
}

$("#keypad").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.k;
  if (k) press(k);
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { Enter: "=", Backspace: "back", Escape: "C", Delete: "C", ".": ",", x: "*" };
  const k = map[e.key] ?? e.key;
  if (/^[\d,+\-*/=]$/.test(k) || k === "back" || k === "C") {
    e.preventDefault();
    press(k);
  }
});

// --- Clipboard ------------------------------------------------------------------------------

let undoState = null;

function showClipNote(n) {
  const note = $("#clip-note");
  note.innerHTML = `Aus der Zwischenablage übernommen: <strong>${esc(formatShort(n))}</strong>` +
    (undoState ? '<button type="button" id="clip-undo">Rückgängig</button>' : "");
  note.hidden = false;
  $("#clip-undo")?.addEventListener("click", () => {
    Object.assign(state.calc, undoState);
    hideClipNote();
    render();
  });
}

function hideClipNote() {
  $("#clip-note").hidden = true;
  undoState = null;
}

function takeNumberFrom(text, { quiet }) {
  const n = parseNumberFromText(text);
  if (n === null || n === 0) {
    if (!quiet) toast("Keine Zahl in der Zwischenablage gefunden");
    return;
  }
  state.lastClip = text;
  const before = snapshot();
  const hadNumber = state.calc.isExpression || (state.calc.cur !== "" && state.calc.cur !== "0");
  state.calc.setValue(n);
  undoState = hadNumber ? before : null;
  showClipNote(n);
  state.below = state.above = STEP;
  render();
}

async function readClipboard(quiet) {
  try {
    const text = await navigator.clipboard.readText();
    if (quiet && text === state.lastClip) return;
    takeNumberFrom(text, { quiet });
  } catch {
    if (!quiet) toast("Kein Zugriff auf die Zwischenablage");
  }
}

// Re-check when the user comes back from another app, but only if the browser
// already allows reading without asking (no permission prompt on every focus).
async function clipboardAllowed() {
  try {
    return (await navigator.permissions.query({ name: "clipboard-read" })).state === "granted";
  } catch {
    return false;
  }
}
window.addEventListener("focus", async () => {
  if (await clipboardAllowed()) readClipboard(true);
});

document.addEventListener("paste", (e) => {
  const text = e.clipboardData?.getData("text");
  if (text) { e.preventDefault(); takeNumberFrom(text, { quiet: false }); }
});

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

// --- Lists and Mean2Me controls ---------------------------------------------------------------

$("#list-chips").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.listId = b.dataset.list;
  state.below = state.above = STEP;
  renderListChips();
  renderBigNumbers();
  $("#bn-mine")?.scrollIntoView({ block: "center" });
});

$("#bn-list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li || e.target.closest("a")) return;
  state.expanded = state.expanded === li.dataset.id ? null : li.dataset.id;
  renderBigNumbers();
});

function showMore(side) {
  // keep the user's row where it is while entries are added above it
  const pane = $("#pane-bn");
  const mine = $("#bn-mine");
  const before = mine.getBoundingClientRect().top;
  state[side] += STEP;
  renderBigNumbers();
  pane.scrollTop += $("#bn-mine").getBoundingClientRect().top - before;
}
$("#more-smaller").addEventListener("click", () => showMore("below"));
$("#more-larger").addEventListener("click", () => showMore("above"));

$("#unit-chips").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.unit = b.dataset.unit;
  try { localStorage.setItem("bn.unit", state.unit); } catch { /* private mode */ }
  renderMean2Me();
});

// --- Start ----------------------------------------------------------------------------------------

async function start() {
  try {
    const saved = localStorage.getItem("bn.unit");
    if (saved !== null) state.unit = saved;
  } catch { /* private mode */ }

  const params = new URLSearchParams(location.search);
  const fromUrl = Number(params.get("n"));
  if (params.has("n") && Number.isFinite(fromUrl)) state.calc.setValue(fromUrl);

  const hashPane = PANE_HASHES.indexOf(location.hash.slice(1));
  const startPane = hashPane >= 0 ? hashPane : 1;
  state.pane = -1;
  requestAnimationFrame(() => {
    goToPane(startPane, false);
    onPaneChange(startPane);
  });
  render();

  try {
    state.data = await loadData();
    renderListChips();
    render();
  } catch (err) {
    $("#bn-list").innerHTML = `<li class="empty">Daten konnten nicht geladen werden (${esc(err.message)}).</li>`;
  }

  // A shared link wins; otherwise take a number from the clipboard right away.
  if (!params.has("n")) readClipboard(true);
}

start();
