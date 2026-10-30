import { formatShort, formatWords, formatFull, unitLabel, parseNumberFromText, openBigNumbers } from "../core/index.js";
import { Calculator } from "./calculator.js";

const DATA_BASES = ["../Daten/", "Daten/"];
const PANE_HASHES = ["vergleiche", "zahl", "fuer-mich"];
const STEP = 8;   // entries shown above and below the user's number, and per "more" click

// Line icons of the lists (24×24, stroke); lists.json names them in `icon`.
const ICONS = {
  government: "M3 21h18M5 21V10M19 21V10M9.7 21V10M14.3 21V10M2 10l10-6 10 6",
  arch: "M2 19h20M4 19v-5a8 8 0 0 1 16 0v5M9 19v-3a3 3 0 0 1 6 0v3",
  health: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
  energy: "M13 2L4 14h7l-1 8 9-12h-7z",
  chart: "M3 21h18M6 21v-7M11 21V9M16 21v-5M20 21V4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  globe: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const state = {
  calc: new Calculator(),
  active: null,          // Set of active list ids; null until the catalog is loaded
  below: STEP,
  above: STEP,
  expanded: null,
  unit: "EUR",
  country: null,         // country code for "Für mich"
  custom: [],            // the user's own Mean2Me divisors: { id, title, value }
  myTax: null,           // the user's income tax per year: { value, currency, country }; only on this device
  pane: 1,
  lastClip: null,
};

// --- Data ---------------------------------------------------------------------------

let bn = null;   // the dataset (core/bignumbers.js); null until loaded

const activeIds = () => [...state.active];

/** The list's colors as CSS variables; `.lc` elements pick light or dark. */
const listColors = (l) => `--lc: ${l.color ?? "var(--accent)"}; --lc-dark: ${l.color_dark ?? l.color ?? "var(--accent)"}`;

/** The list's line icon in its color; `label` makes it an image with a name, else decoration. */
function listIcon(l, cls = "list-icon", label = true) {
  const a11y = label ? `role="img" aria-label="${esc(l.name)}"` : 'aria-hidden="true"';
  return `<svg class="${cls} lc" style="${listColors(l)}" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
    ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}><path d="${ICONS[l.icon] ?? ICONS.chart}"/></svg>`;
}

/** Picture at the top of the detail view: the entry's own image, else the list's, else the list's icon panel. */
function detailImage(e) {
  const img = e.image ?? e.list.image;
  if (img?.src) {
    const src = bn.imageSrc(img);
    const credit = [img.credit, img.license].filter(Boolean).map(esc).join(", ");
    const via = img.source_url ? `<a href="${esc(img.source_url)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : "";
    return `<figure class="bn-figure">
        <img src="${esc(src)}" alt="${esc(img.alt ?? e.title)}" loading="lazy"
          ${img.width ? `width="${esc(img.width)}" height="${esc(img.height)}"` : ""}>
        <figcaption>Bild: ${[credit, via].filter(Boolean).join(" · ")}</figcaption>
      </figure>`;
  }
  return `<div class="bn-panel lc" style="${listColors(e.list)}">${listIcon(e.list, "bn-panel-icon", false)}<span>${esc(e.list.name)}</span></div>`;
}

function saveActive() {
  try { localStorage.setItem("bn.lists", JSON.stringify([...state.active])); } catch { /* private mode */ }
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
    el.textContent = Number.isFinite(v) ? `${formatShort(v)} ${unitLabel(state.unit)}`.trim() : "–";
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
  const money = bn.money(e, state.unit);
  const converted = money?.changed;
  const cmp = money?.value ?? e.value_original;
  const ratio = v > 0 ? `${formatShort(cmp / v)} ×` : "";
  const shown = converted
    ? `≈ ${formatShort(cmp)} ${unitLabel(state.unit)}`
    : `${formatShort(e.value_original)} ${unitLabel(e.unit)}`;
  const original = converted ? `${formatShort(e.value_original)} ${unitLabel(e.unit)} · ` : "";
  const note = e.note;
  const detail = open ? `
    <div class="bn-detail">
      <div>
        ${e.status === "draft" ? '<span class="badge">Entwurf</span>' : ""}
        ${e.confidence_level <= 1 ? '<span class="badge warn">unsicher</span>' : ""}
      </div>
      <p>${esc(e.long_description || e.short_description)}</p>
      <p>Originalwert: ${esc(formatFull(e.value_original))} ${esc(unitLabel(e.unit))} (${esc(e.year_original)}, ${esc(e.country_code)})</p>
      ${money ? bn.explainMoney(e, money, state.unit).map((l) => `<p>${esc(l)}</p>`).join("") : ""}
      ${note ? `<p>Hinweis: ${esc(note)}</p>` : ""}
      <p>Quelle: <a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(e.source_title)}</a></p>
    </div>` : "";
  return `
    <li data-id="${esc(e.id)}"${open ? ' class="open"' : ""}>${open ? detailImage(e) : ""}
      <div class="bn-row">
        <div class="bn-title">${listIcon(e.list)}${esc(e.title)}${year ? `<small>${esc(year)}</small>` : ""}</div>
        <div>
          <div class="bn-value">${esc(shown)}</div>
          <div class="bn-ratio">${esc(original + ratio)}</div>
        </div>
      </div>${detail}
    </li>`;
}

function renderBigNumbers() {
  const v = value();
  const w = bn.compare(v, { lists: activeIds(), unit: state.unit, below: state.below, above: state.above });
  const sym = state.unit ? ` ${unitLabel(state.unit)}` : "";
  $("#bn-sub").textContent = state.unit
    ? `Womit ist das vergleichbar? Geldbeträge in Preisen von ${bn.priceYear}.`
    : "Womit ist das vergleichbar?";
  const mine = `
    <li class="mine" id="bn-mine">
      <div class="bn-row">
        <div class="bn-title">Deine Zahl</div>
        <div><div class="bn-value">${esc(Number.isFinite(v) ? formatShort(v) + sym : "–")}</div></div>
      </div>
    </li>`;
  $("#bn-list").innerHTML =
    w.smaller.map((e) => entryRow(e, v)).join("") + mine + w.larger.map((e) => entryRow(e, v)).join("");
  $("#more-smaller").hidden = !w.moreSmaller;
  $("#more-larger").hidden = !w.moreLarger;
}

function renderListChips() {
  // only active lists appear here; the sheet ("Listen …") switches others back on
  $("#list-chips").innerHTML = bn.lists.filter((l) => state.active.has(l.id)).map((l) =>
    `<button class="list-chip lc" style="${listColors(l)}" data-list="${esc(l.id)}" aria-pressed="${state.active.has(l.id)}">` +
    `${listIcon(l, "list-icon", false)}${esc(l.name)}</button>`).join("") +
    '<button data-sheet aria-haspopup="dialog">Listen …</button>';
}

function renderListSheet() {
  $("#sheet-lists").innerHTML = bn.lists.map((l) => `
    <li>
      <label>
        ${listIcon(l, "sheet-icon", false)}
        <span class="sheet-text">
          <strong>${esc(l.name)}</strong>
          <span>${esc(l.description)}</span>
          <small>${esc(l.count)} Einträge · Version ${esc(l.version)} · ${l.access === "free" ? "kostenlos" : "kostenpflichtig"}</small>
        </span>
        <input type="checkbox" data-list="${esc(l.id)}" ${state.active.has(l.id) ? "checked" : ""}>
      </label>
    </li>`).join("");
}

/** Switch a list on or off; at least one list stays active. */
async function toggleList(id, on) {
  if (!on && state.active.size === 1 && state.active.has(id)) {
    toast("Mindestens eine Liste muss aktiv sein");
    renderListSheet();
    return;
  }
  if (on) state.active.add(id); else state.active.delete(id);
  saveActive();
  try {
    await bn.loadLists(activeIds());
  } catch (err) {
    toast(`Liste konnte nicht geladen werden (${err.message})`);
  }
  state.below = state.above = STEP;
  renderListChips();
  renderListSheet();
  renderBigNumbers();
}

const country = () => bn.country(state.country);

function renderMean2Me() {
  const v = value();
  const c0 = country();
  $("#country-btn").innerHTML = `<span class="flag" aria-hidden="true">${esc(c0.flag)}</span>${esc(c0.name)} <span aria-hidden="true">▾</span>`;
  const items = bn.mean2me(v, { country: c0.code, unit: state.unit, custom: state.custom, myTax: state.myTax }).map((m) => `
        <li${m.mine ? ' class="m2m-mine"' : ""}>
          <div class="m2m-label">${esc(m.title)}${m.custom
            ? `<button type="button" class="m2m-remove" data-remove="${esc(m.id)}" aria-label="${esc(m.title)} entfernen">✕</button>` : ""}${m.mine
            ? '<button type="button" class="m2m-edit" data-tax aria-label="Meine Steuer ändern">Ändern</button>' : ""}</div>
          <div class="m2m-value">${esc(m.text)}</div>
          <div class="m2m-source">${esc(m.basis)}</div>
        </li>`);
  // invite to enter one's own tax where the country's income tax revenue is known
  const ask = state.unit && bn.hasTaxShare(c0.code) && state.myTax?.country !== c0.code;
  const invite = ask ? `
        <li class="m2m-invite">
          <button type="button" data-tax>
            <strong>Wie viel davon zahlst du?</strong>
            <span>Mit deiner Lohn- oder Einkommensteuer rechnet die App deinen Anteil aus statt pro Kopf.</span>
          </button>
        </li>` : "";
  $("#m2m-list").innerHTML = v ? invite + items.join("") : '<li class="empty">Gib in der Mitte eine Zahl ein.</li>';
  renderUnitChips();
}

/** Currency chips: the country's currency first, then € and $, then "ohne Einheit". */
function renderUnitChips() {
  const units = [...new Set([country().currency, "EUR", "USD", state.unit].filter(Boolean)), ""];
  const html = units.map((u) =>
    `<button data-unit="${esc(u)}" aria-pressed="${u === state.unit}">${esc(u ? unitLabel(u) : "ohne Einheit")}</button>`).join("");
  for (const el of document.querySelectorAll(".unit-chips")) el.innerHTML = html;
}

function renderCountrySheet() {
  const sorted = [...bn.countries].sort((a, b) => a.name.localeCompare(b.name, "de"));
  $("#country-list").innerHTML = sorted.map((c) => `
    <li>
      <button type="button" class="country-choice" data-country="${esc(c.code)}" aria-pressed="${c.code === state.country}">
        <span class="flag" aria-hidden="true">${esc(c.flag)}</span>
        <span class="sheet-text"><strong>${esc(c.name)}</strong><span>Hauptstadt ${esc(c.capital)} · ${esc(unitLabel(c.currency))}</span></span>
      </button>
    </li>`).join("");
}

/** First guess of the user's country: saved choice, else time zone, else browser language. */
function guessCountry() {
  let saved = null;
  try { saved = localStorage.getItem("bn.country"); } catch { /* private mode */ }
  return bn.guessCountry({
    saved,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: navigator.languages ?? [navigator.language],
  });
}

function setCountry(code) {
  state.country = code;
  state.unit = country().currency;
  try {
    localStorage.setItem("bn.country", code);
    localStorage.setItem("bn.unit", state.unit);
  } catch { /* private mode */ }
  state.below = state.above = STEP;
  render();
}

/** The tax sheet, filled with the saved value when it belongs to the current country. */
function openTaxSheet() {
  const c0 = country();
  const form = $("#tax-form");
  form.reset();
  const mine = state.myTax?.country === c0.code ? state.myTax : null;
  if (mine) form.elements.value.value = formatFull(mine.value);
  $("#tax-unit").textContent = unitLabel(c0.currency);
  $("#tax-country").textContent = c0.name_in ?? c0.name;
  $("#tax-remove").hidden = !mine;
  $("#tax-sheet").showModal();
}

function saveMyTax(value) {
  state.myTax = value;
  try {
    if (value) localStorage.setItem("bn.mytax", JSON.stringify(value));
    else localStorage.removeItem("bn.mytax");
  } catch { /* private mode */ }
  renderMean2Me();
}

function saveCustom() {
  try { localStorage.setItem("bn.custom", JSON.stringify(state.custom)); } catch { /* private mode */ }
}

let urlTimer;
function render() {
  renderDisplay();
  if (bn) { renderBigNumbers(); renderMean2Me(); }
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

/** True while the user types into a form field or a sheet is open: the keypad then stays out of the way. */
const typingElsewhere = (e) => e.target.closest?.("input, textarea, select, [contenteditable], dialog") ||
  document.querySelector("dialog[open]");

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || typingElsewhere(e)) return;
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
  if (typingElsewhere(e)) return;
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

$("#list-chips").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-sheet")) { renderListSheet(); $("#list-sheet").showModal(); return; }
  const list = bn.lists.find((l) => l.id === b.dataset.list);
  const wasLast = state.active.size === 1;
  await toggleList(list.id, false);
  if (!wasLast) toast(`„${list.name}“ ausgeblendet. Über „Listen …“ wieder einblenden.`);
  $("#bn-mine")?.scrollIntoView({ block: "center" });
});

$("#sheet-lists").addEventListener("change", (e) => {
  if (e.target.dataset.list) toggleList(e.target.dataset.list, e.target.checked);
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

// The unit of the user's number; the same choice in both side panes.
for (const chips of document.querySelectorAll(".unit-chips")) {
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.unit = b.dataset.unit;
    try { localStorage.setItem("bn.unit", state.unit); } catch { /* private mode */ }
    state.below = state.above = STEP;
    renderDisplay();
    renderBigNumbers();
    renderMean2Me();
  });
}

$("#country-btn").addEventListener("click", () => {
  renderCountrySheet();
  $("#country-sheet").showModal();
  $('#country-list [aria-pressed="true"]')?.scrollIntoView({ block: "center" });
});
$("#country-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-country]");
  if (!b) return;
  setCountry(b.dataset.country);
  $("#country-sheet").close();
});

$("#custom-add").addEventListener("click", () => { $("#custom-form").reset(); $("#custom-sheet").showModal(); });
$("#custom-form").addEventListener("submit", (e) => {
  const form = new FormData(e.target);
  const title = String(form.get("title")).trim();
  const n = parseNumberFromText(String(form.get("value")));
  if (!title || !n || n <= 0) {
    e.preventDefault();
    toast("Bitte eine Bezeichnung und eine Zahl größer als 0 eingeben");
    return;
  }
  state.custom.push({ id: `own_${Date.now()}`, title, value: n });
  saveCustom();
  renderMean2Me();
});
$("#tax-form").addEventListener("submit", (e) => {
  const n = parseNumberFromText(String(new FormData(e.target).get("value")));
  if (!n || n <= 0) {
    e.preventDefault();
    toast("Bitte deine Steuer pro Jahr als Zahl größer als 0 eingeben");
    return;
  }
  saveMyTax({ value: n, currency: country().currency, country: country().code });
});
$("#tax-remove").addEventListener("click", () => {
  saveMyTax(null);
  $("#tax-sheet").close();
});

$("#m2m-list").addEventListener("click", (e) => {
  if (e.target.closest("[data-tax]")) { openTaxSheet(); return; }
  const id = e.target.closest("[data-remove]")?.dataset.remove;
  if (!id) return;
  state.custom = state.custom.filter((c) => c.id !== id);
  saveCustom();
  renderMean2Me();
});

// every sheet: the ✕ button and a tap on the backdrop close it
for (const sheet of document.querySelectorAll("dialog.sheet")) {
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet || e.target.closest("[data-close]")) sheet.close();
  });
}

// --- Start ----------------------------------------------------------------------------------------

async function start() {
  let savedUnit = null;
  try {
    savedUnit = localStorage.getItem("bn.unit");
    const tax = JSON.parse(localStorage.getItem("bn.mytax"));
    if (tax?.value > 0 && tax.currency && tax.country) state.myTax = tax;
    const custom = JSON.parse(localStorage.getItem("bn.custom"));
    // entries saved before the "Titel" field had only a label after "Pro"
    if (Array.isArray(custom)) {
      state.custom = custom.filter((c) => c && (c.title || c.label) && c.value > 0)
        .map((c) => ({ id: c.id, title: c.title ?? `Pro ${c.label}`, value: c.value }));
    }
  } catch { /* none, or private mode */ }

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
    bn = await openBigNumbers({ bases: DATA_BASES });
    state.country = guessCountry();
    state.unit = savedUnit ?? country().currency;
    // a link from an article or a QR code may name the country and unit (not saved as the user's choice)
    if (bn.countries.some((c) => c.code === params.get("c"))) {
      state.country = params.get("c");
      state.unit = country().currency;
    }
    if (params.has("u") && (params.get("u") === "" || bn.convert.isCurrency(params.get("u")))) state.unit = params.get("u");
    const known = new Set(bn.lists.map((l) => l.id));
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("bn.lists")); } catch { /* none or private mode */ }
    const active = Array.isArray(saved) ? saved.filter((id) => known.has(id)) : [];
    // default: all free lists
    state.active = new Set(active.length ? active : bn.defaultLists);
    await bn.loadLists(activeIds());
    renderListChips();
    render();
  } catch (err) {
    $("#bn-list").innerHTML = `<li class="empty">Daten konnten nicht geladen werden (${esc(err.message)}).</li>`;
  }

  // A shared link wins; otherwise take a number from the clipboard right away.
  if (!params.has("n")) readClipboard(true);
}

start();
