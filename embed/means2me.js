// Means2Me for articles: a number in the text gets a small mark; hovering or tapping
// it shows the breakdowns the newsroom chose ("= 9,09 € pro Haushalt in Österreich").
//
//   <span data-means2me='{"v":1,"n":38000000,"unit":"EUR","country":"AT","label":"38 Mio. €",
//     "items":[{"text":"9,09 €","label":"Pro Haushalt in Österreich"}],"asOf":"2026-10-30"}'>38 Mio. Euro</span>
//   <script src="…/embed/means2me.js" defer></script>
//
// The values are frozen in the page (core: BigNumbers.snapshot), so reading an article
// makes no request to us: no tracking, no cookie banner, nothing that changes later.
// `data-app` on the script tag overrides the address of the full app.
(() => {
  const script = document.currentScript;
  const APP = script?.dataset.app ?? new URL("../app/", script?.src ?? location.href).href;
  const SEEN = "means2me.seen";

  const MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="miter" stroke-linecap="butt" aria-hidden="true">
    <circle cx="12" cy="12" r="10.4" stroke-width="2.2"/>
    <path d="M1.65 11.6 L7 7.6 L12 11 L17 7.6 L22.35 11.6" stroke-width="2.6"/>
    <path d="M3 17.2 L7 13.2 L12 16.6 L17 13.2 L21 17.2" stroke-width="2.6"/></svg>`;

  // Colors and fonts are CSS variables, so a site can match its own design.
  const CSS = `
:where(:root){--m2m-accent:#2f5bea;--m2m-bg:#fff;--m2m-text:#16213a;--m2m-muted:#4a5368;--m2m-line:#dcdfe6;--m2m-soft:#f4f5f8}
.m2m-num{font:inherit;color:inherit;background:none;border:0;margin:-.3em -.1em;padding:.3em .1em;cursor:pointer;
  white-space:nowrap;text-decoration:underline dotted;text-decoration-thickness:1.5px;text-underline-offset:.25em;
  text-decoration-color:color-mix(in srgb,currentColor 45%,transparent);-webkit-tap-highlight-color:transparent}
.m2m-num svg{display:inline-block;width:.6em;height:.6em;margin-left:.1em;vertical-align:.55em;opacity:.55}
.m2m-num:hover,.m2m-num[aria-expanded=true]{color:var(--m2m-accent);text-decoration-color:var(--m2m-accent)}
.m2m-num:hover svg,.m2m-num[aria-expanded=true] svg{opacity:1}
.m2m-num:focus-visible{outline:2px solid var(--m2m-accent);outline-offset:2px;border-radius:3px}
.m2m-panel{position:absolute;z-index:2147483000;box-sizing:border-box;width:min(330px,calc(100vw - 16px));background:var(--m2m-bg);
  color:var(--m2m-text);border:1px solid var(--m2m-line);border-radius:14px;box-shadow:0 10px 30px rgba(22,33,58,.16);
  padding:14px 16px 12px;font:15px/1.35 var(--m2m-font,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);text-align:left}
.m2m-panel:focus{outline:none}
.m2m-panel::before{content:"";position:absolute;left:var(--m2m-arrow,40px);width:12px;height:12px;background:inherit;
  border:inherit;border-width:1px 0 0 1px;transform:rotate(45deg);top:-7px}
.m2m-panel.m2m-above::before{top:auto;bottom:-7px;border-width:0 1px 1px 0}
.m2m-head{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--m2m-muted);font-size:13px}
.m2m-head strong{color:var(--m2m-text)}
.m2m-close{display:none;width:44px;height:44px;margin:-6px -6px -6px 0;border:0;border-radius:22px;background:var(--m2m-soft);
  color:var(--m2m-muted);font:inherit;font-size:20px;line-height:1;cursor:pointer}
.m2m-list{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
.m2m-list b{display:block;font-size:21px;font-weight:750;line-height:1.2}
.m2m-list span{color:var(--m2m-muted);font-size:14px}
.m2m-hint{margin:12px 0 0;padding:9px 11px;border-radius:10px;background:color-mix(in srgb,var(--m2m-accent) 9%,var(--m2m-bg));font-size:13px}
.m2m-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;padding-top:9px;
  border-top:1px solid var(--m2m-line);font-size:13px}
.m2m-foot a{color:var(--m2m-accent)}
.m2m-brand{display:flex;align-items:center;gap:5px;font-weight:700;font-size:12px}
.m2m-brand svg{width:15px;height:15px;color:var(--m2m-accent)}
.m2m-meta{margin:6px 0 0;color:var(--m2m-muted);font-size:11px}
.m2m-backdrop{position:fixed;inset:0;z-index:2147482999;background:rgba(20,24,35,.28)}
.m2m-panel.m2m-sheet{position:fixed;left:0;right:0;bottom:0;top:auto;width:auto;border-radius:20px 20px 0 0;
  padding:14px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(22,33,58,.18)}
.m2m-sheet::before{display:none}
.m2m-sheet .m2m-close{display:block}
.m2m-sheet .m2m-list li{background:var(--m2m-soft);border-radius:14px;padding:11px 14px}
.m2m-sheet .m2m-list b{font-size:25px}`;

  const asOfText = (d) => {
    const date = new Date(`${d}T12:00:00`);
    return isNaN(date) ? "" : new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(date);
  };

  /** A new element with a class and optional text (text, never HTML: the data is content). */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  let open = null;      // { button, panel, backdrop }
  let hoverTimer;

  function close({ focus = false } = {}) {
    if (!open) return;
    open.panel.remove();
    open.backdrop?.remove();
    open.button.setAttribute("aria-expanded", "false");
    if (focus) open.button.focus();
    open = null;
  }

  function panelFor(data, sheet) {
    const panel = el("div", "m2m-panel" + (sheet ? " m2m-sheet" : ""));
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", `Einordnung zu ${data.label}`);
    panel.tabIndex = -1;

    const head = el("div", "m2m-head");
    const title = el("span");
    title.append(el("strong", "", data.label), " entspricht");
    const x = el("button", "m2m-close", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Schließen");
    x.addEventListener("click", () => close({ focus: true }));
    head.append(title, x);

    const list = el("ul", "m2m-list");
    for (const item of data.items) {
      const li = el("li");
      li.append(el("b", "", item.text), el("span", "", item.label));
      list.append(li);
    }
    panel.append(head, list);

    let seen = true;
    try { seen = localStorage.getItem(SEEN) === "1"; localStorage.setItem(SEEN, "1"); } catch { /* private mode */ }
    if (!seen) panel.append(el("p", "m2m-hint", "Neu hier? Das Zeichen markiert Zahlen, die Means2Me für dich einordnet."));

    const foot = el("div", "m2m-foot");
    const more = el("a", "", "Rechenweg und Quellen");
    const q = new URLSearchParams({ n: data.n });
    if (data.country) q.set("c", data.country);
    if (data.unit != null) q.set("u", data.unit);
    more.href = `${APP}?${q}#fuer-mich`;
    more.target = "_blank";
    more.rel = "noopener";
    const brand = el("span", "m2m-brand");
    brand.innerHTML = MARK;
    brand.append("Means2Me");
    foot.append(more, brand);
    panel.append(foot);

    const when = data.asOf ? asOfText(data.asOf) : "";
    const by = data.by === "auto" ? "Automatische Vorschau" : "Ausgewählt von der Redaktion";
    panel.append(el("p", "m2m-meta", [by, when && `Datenstand ${when}`].filter(Boolean).join(" · ")));
    return panel;
  }

  /** Under the number, or above it when there is no room below; inside the window horizontally. */
  function place(panel, button) {
    const r = button.getBoundingClientRect();
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - 40), document.documentElement.clientWidth - w - 8);
    const above = r.bottom + h + 14 > innerHeight && r.top - h - 14 > 0;
    panel.classList.toggle("m2m-above", above);
    panel.style.left = `${left + scrollX}px`;
    panel.style.top = `${(above ? r.top - h - 10 : r.bottom + 10) + scrollY}px`;
    panel.style.setProperty("--m2m-arrow", `${Math.min(Math.max(14, r.left + r.width / 2 - left - 6), w - 26)}px`);
  }

  const useSheet = () => matchMedia("(max-width: 600px), (pointer: coarse)").matches;

  function show(button, data, { focus }) {
    if (open?.button === button) return;
    close();
    const sheet = useSheet();
    const panel = panelFor(data, sheet);
    let backdrop = null;
    if (sheet) {
      backdrop = el("div", "m2m-backdrop");
      backdrop.addEventListener("click", () => close({ focus: true }));
      document.body.append(backdrop);
    }
    document.body.append(panel);
    if (!sheet) place(panel, button);
    button.setAttribute("aria-expanded", "true");
    open = { button, panel, backdrop };
    panel.addEventListener("mouseenter", () => clearTimeout(hoverTimer));
    panel.addEventListener("mouseleave", () => { if (open?.hovered) hoverTimer = setTimeout(close, 250); });
    if (focus || sheet) panel.focus();
  }

  function enhance(span) {
    let data;
    try { data = JSON.parse(span.dataset.means2me); } catch { return; }
    if (!data?.items?.length || !data.label) return;
    const button = el("button", "m2m-num");
    button.type = "button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.append(...span.childNodes);
    button.insertAdjacentHTML("beforeend", MARK);
    button.setAttribute("aria-label", `${button.textContent.trim()}, Einordnung anzeigen`);
    span.append(button);
    span.dataset.means2meReady = "";

    button.addEventListener("click", () => {
      if (open?.button === button && !open.hovered) close();
      else { close(); show(button, data, { focus: true }); }
    });
    // a mouse can preview by hovering; touch screens use the tap above
    button.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || useSheet()) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (open?.button === button) return;
        show(button, data, { focus: false });
        open.hovered = true;
      }, 150);
    });
    button.addEventListener("pointerleave", () => {
      clearTimeout(hoverTimer);
      if (open?.hovered) hoverTimer = setTimeout(close, 250);
    });
  }

  function init() {
    if (!document.getElementById("means2me-style")) {
      const style = el("style", "", CSS);
      style.id = "means2me-style";
      document.head.append(style);
    }
    document.querySelectorAll("[data-means2me]:not([data-means2me-ready])").forEach(enhance);
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) close({ focus: true }); });
  document.addEventListener("click", (e) => {
    if (open && !open.panel.contains(e.target) && !open.button.contains(e.target)) close();
  });
  addEventListener("resize", () => { if (open && !open.backdrop) place(open.panel, open.button); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.Means2Me = { init };   // for pages that add articles later
})();
