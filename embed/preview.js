// Means2Me preview: marks the money amounts on any page the way an article with
// Means2Me would look, computed on the spot with the core and the dataset.
// It only changes the page in this browser window, nothing on the site itself.
// Loaded by the bookmarklet from lesezeichen.html; running it again shows the bar.
(() => {
  if (window.__m2mPreview) { window.__m2mPreview.show(); return; }

  const BASE = new URL("../", document.currentScript.src).href;
  const MIN = 1e6;   // smaller amounts stay unmarked
  const NOT_COMPARED = ["list_laender_v1"];   // population, GDP, ... make dull comparisons
  const SKIP = "script, style, noscript, textarea, input, select, option, a, button, code, pre, svg, " +
    "[contenteditable], [data-means2me], .m2m-panel, #m2m-preview";

  const state = { bn: null, core: null, country: null, spans: [], bar: null };

  async function load() {
    if (state.bn) return;
    state.core = await import(BASE + "core/index.js");
    state.bn = await state.core.openBigNumbers({ bases: [BASE + "Daten/"] });
    state.lists = state.bn.defaultLists.filter((id) => !NOT_COMPARED.includes(id));
    await state.bn.loadLists(state.lists);
    if (!window.Means2Me) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = BASE + "embed/means2me.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("means2me.js nicht geladen"));
        document.head.append(s);
      });
    }
  }

  /** Country of the site: its top-level domain (.at, .de, ...), else language and time zone. */
  function guessCountry() {
    const { bn } = state;
    const tld = location.hostname.split(".").pop().toUpperCase();
    if (bn.countries.some((c) => c.code === tld)) return tld;
    return bn.guessCountry({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: [document.documentElement.lang, ...(navigator.languages ?? [])].filter(Boolean),
    });
  }

  /** Breakdowns an editor would typically pick: per inhabitant, per household, then a share or per day. */
  function pick(value, country, unit) {
    const cc = country.toLowerCase();
    const have = new Set(state.bn.mean2me(value, { country, unit }).map((m) => m.id));
    const want = [`m2m_population_${cc}`, `m2m_households_${cc}`,
      value >= 1e9 ? `m2m_federal_budget_share_${cc}` : "m2m_per_day"];
    return want.filter((id) => have.has(id));
  }

  function clear() {
    for (const span of state.spans) {
      const parent = span.parentNode;
      if (!parent) continue;
      span.replaceWith(document.createTextNode(span.dataset.m2mText));
      parent.normalize();
    }
    state.spans = [];
    document.querySelectorAll(".m2m-panel, .m2m-backdrop").forEach((e) => e.remove());
  }

  function mark() {
    const { bn, core, country } = state;
    const c = bn.country(country);
    const root = document.querySelector("article") ?? document.querySelector("main, [role=main]") ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(SKIP) || !/\d/.test(n.data) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      // from the end, so earlier positions stay valid while splitting
      for (const a of core.findAmounts(node.data).reverse()) {
        const value = bn.convert(a.value, a.currency, c.currency);
        if (value == null || value < MIN) continue;
        const ids = pick(value, c.code, c.currency);
        if (!ids.length) continue;
        node.splitText(a.index + a.length);
        const mid = node.splitText(a.index);
        const data = bn.snapshot(value, { country: c.code, unit: c.currency, pick: ids, compare: { lists: state.lists } });
        data.label = a.currency === c.currency ? mid.data
          : `${mid.data} (≈ ${core.formatShort(value)} ${core.unitLabel(c.currency)})`;
        data.by = "auto";
        const span = document.createElement("span");
        span.dataset.means2me = JSON.stringify(data);
        span.dataset.m2mText = mid.data;
        span.textContent = mid.data;
        mid.replaceWith(span);
        state.spans.push(span);
      }
    }
    window.Means2Me.init();
  }

  const MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="miter" stroke-linecap="butt" aria-hidden="true">
    <circle cx="12" cy="12" r="10.4" stroke-width="2.2"/>
    <path d="M1.65 11.6 L7 7.6 L12 11 L17 7.6 L22.35 11.6" stroke-width="2.6"/>
    <path d="M3 17.2 L7 13.2 L12 16.6 L17 13.2 L21 17.2" stroke-width="2.6"/></svg>`;

  /** A small bar at the bottom, in a shadow root so the site's styles cannot reach it. */
  function bar() {
    if (state.bar) return state.bar;
    const host = document.createElement("div");
    host.id = "m2m-preview";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial;position:fixed;left:12px;bottom:12px;z-index:2147482990}
      .bar{display:flex;align-items:center;gap:10px;max-width:calc(100vw - 48px);padding:8px 8px 8px 12px;border-radius:14px;
        background:#16213a;color:#e8ebf2;font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,.25)}
      svg{width:20px;height:20px;flex:none;color:#9db1ff}
      .text{min-width:0}
      select,button{font:inherit;border:0;border-radius:9px;min-height:36px;cursor:pointer}
      select{max-width:150px;padding:0 6px;background:#2a3554;color:#fff}
      button{width:36px;background:#2a3554;color:#fff;font-size:18px}
      select:focus-visible,button:focus-visible{outline:2px solid #9db1ff}
    </style>
    <div class="bar" role="region" aria-label="Means2Me-Vorschau">${MARK}<span class="text">Means2Me-Vorschau lädt …</span>
      <select aria-label="Land" hidden></select><button type="button" aria-label="Vorschau beenden">×</button></div>`;
    root.querySelector("button").addEventListener("click", () => {
      clear();
      host.remove();
      state.bar = null;
    });
    root.querySelector("select").addEventListener("change", (e) => {
      state.country = e.target.value;
      clear();
      mark();
      status();
    });
    document.body.append(host);
    state.bar = root;
    return root;
  }

  function status(text) {
    const root = bar();
    const n = state.spans.length;
    // numbers the newsroom marked itself stay as they are (see SKIP)
    const own = document.querySelectorAll("[data-means2me]:not([data-m2m-text])").length;
    const found = n ? `${n} ${n === 1 ? "Betrag" : "Beträge"} markiert, nur in deinem Browser` : "Keine weiteren Beträge ab 1 Mio.";
    root.querySelector(".text").textContent = text ??
      (own ? `${found} · ${own} schon von der Redaktion markiert` : n ? found : "Keine Beträge ab 1 Mio. gefunden");
  }

  async function show() {
    status(state.bn ? undefined : "Means2Me-Vorschau lädt …");
    try {
      await load();
      const select = bar().querySelector("select");
      if (!select.options.length) {
        state.country = guessCountry();
        for (const c of [...state.bn.countries].sort((a, b) => a.name.localeCompare(b.name, "de"))) {
          select.add(new Option(`${c.flag} ${c.name}`, c.code, false, c.code === state.country));
        }
        select.hidden = false;
      }
      clear();
      mark();
      status();
    } catch (err) {
      status(`Vorschau nicht möglich: ${err.message}`);
    }
  }

  window.__m2mPreview = { show };
  show();
})();
