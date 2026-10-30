// Means2Me in the block editor: select an amount in a paragraph ("38 Mio. Euro"), press the
// mark in the toolbar, tick the breakdowns and comparison lists. The result is frozen into
// the text as <span class="means2me" data-means2me='…'> (core: BigNumbers.snapshot), so a
// published article never changes by itself and readers make no request to us.
// Plain script without a build step: wp.element.createElement instead of JSX.
(() => {
  const { registerFormatType, applyFormat, removeFormat, getTextContent, slice, useAnchor } = wp.richText;
  const { BlockControls } = wp.blockEditor;
  const { Popover, Button, ToolbarButton, SelectControl, CheckboxControl, TextControl, ToggleControl, Spinner, Notice } = wp.components;
  const { createElement: h, Fragment, useState, useEffect } = wp.element;

  const SETTINGS = window.means2meSettings;
  const NAME = "means2me/number";
  const CURRENCIES = [["EUR", "Euro (€)"], ["USD", "US-Dollar ($)"], ["CHF", "Franken (CHF)"], ["GBP", "Pfund (£)"]];
  const NOT_COMPARED = ["list_laender_v1"];   // population, GDP, ... make dull comparisons

  const icon = h("svg", { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor",
    strokeLinejoin: "miter", strokeLinecap: "butt", "aria-hidden": true },
  h("circle", { cx: 12, cy: 12, r: 10.4, strokeWidth: 1.5, fill: "none" }),
  h("path", { d: "M1.65 11.6 L7 7.6 L12 11 L17 7.6 L22.35 11.6", strokeWidth: 1.9, fill: "none" }),
  h("path", { d: "M3 17.2 L7 13.2 L12 16.6 L17 13.2 L21 17.2", strokeWidth: 1.9, fill: "none" }));

  // core and data are loaded once, the first time the button is used
  let opening = null;
  function openCore() {
    opening ??= (async () => {
      const core = await import(SETTINGS.core);
      const bn = await core.openBigNumbers({ bases: [SETTINGS.data] });
      await bn.loadLists(bn.defaultLists);
      return { core, bn };
    })().catch((err) => { opening = null; throw err; });
    return opening;
  }

  /** Breakdowns an editor would typically pick: per inhabitant, per household, then a share or per day. */
  function defaultPick(bn, value, country, unit) {
    const cc = country.toLowerCase();
    const have = new Set(bn.mean2me(value, { country, unit }).map((m) => m.id));
    return [`m2m_population_${cc}`, `m2m_households_${cc}`,
      value >= 1e9 ? `m2m_federal_budget_share_${cc}` : "m2m_per_day"].filter((id) => have.has(id));
  }

  /** The number as the editor would type it: "38 Mio." when that is exact, else all digits. */
  function numberText(core, n) {
    const short = core.formatShort(n);
    return core.parseNumberFromText(short) === n ? short : core.formatFull(n);
  }

  function readData(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  /** The form in the popover. `text` is the marked text, `old` the data of an existing mark. */
  function Form({ text, old, onApply, onRemove }) {
    const [ready, setReady] = useState(null);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(null);
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    useEffect(() => {
      openCore().then(({ core, bn }) => {
        const found = core.findAmounts(text)[0];
        const country = old?.country ?? SETTINGS.country;
        const value = old?.edit?.n ?? old?.n ?? found?.value ?? core.parseNumberFromText(text);
        const currency = old?.edit?.currency ?? old?.unit ?? found?.currency ?? bn.country(country).currency;
        const unit = bn.country(country).currency;
        const lists = bn.defaultLists.filter((id) => !NOT_COMPARED.includes(id));
        setForm({
          number: value == null ? "" : numberText(core, value),
          currency, country,
          pick: old?.edit?.pick ?? (value == null ? [] : defaultPick(bn, bn.convert(value, currency, unit), country, unit)),
          compare: old ? !!old.compare : false,
          lists: old?.edit?.lists ?? lists,
        });
        setReady({ core, bn });
      }, (err) => setError(err.message));
    }, []);

    if (error) return h(Notice, { status: "error", isDismissible: false }, `Daten nicht geladen: ${error}`);
    if (!ready || !form) return h("div", { className: "means2me-loading" }, h(Spinner), "Daten werden geladen …");

    const { core, bn } = ready;
    const c = bn.country(form.country);
    const unit = c.currency;
    const n = core.parseNumberFromText(form.number);
    const value = n == null ? null : bn.convert(n, form.currency, unit);
    const items = value == null ? [] : bn.mean2me(value, { country: c.code, unit });
    const pick = form.pick.filter((id) => items.some((m) => m.id === id));
    const cmp = value != null && form.compare && form.lists.length
      ? bn.frozenComparison(value, unit, { lists: form.lists }) : null;

    const changeCountry = (code) => {
      const u = bn.country(code).currency;
      set({ country: code, pick: value == null ? [] : defaultPick(bn, bn.convert(n, form.currency, u), code, u) });
    };
    const toggle = (key, id, on) => set({ [key]: on ? [...form[key], id] : form[key].filter((x) => x !== id) });

    const apply = () => {
      // in the order shown, not the order ticked
      const ids = items.map((m) => m.id).filter((id) => pick.includes(id));
      const data = bn.snapshot(value, {
        country: c.code, unit, pick: ids, compare: form.compare && form.lists.length ? { lists: form.lists } : null,
      });
      if (form.currency !== unit) {
        data.label = `${core.formatShort(n)} ${core.unitLabel(form.currency)} (≈ ${data.label})`;
      }
      // what the form needs to open this mark again; the article script ignores it
      data.edit = { n, currency: form.currency, pick: ids, lists: form.lists };
      onApply(JSON.stringify(data));
    };

    return h("div", { className: "means2me-form" },
      h("div", { className: "means2me-row" },
        h(TextControl, { label: "Betrag", value: form.number, onChange: (v) => set({ number: v }), __nextHasNoMarginBottom: true }),
        h(SelectControl, { label: "Währung", value: form.currency, options: CURRENCIES.map(([v, l]) => ({ value: v, label: l })),
          onChange: (v) => set({ currency: v }), __nextHasNoMarginBottom: true })),
      h(SelectControl, {
        label: "Land", value: form.country, __nextHasNoMarginBottom: true, onChange: changeCountry,
        options: [...bn.countries].sort((a, b) => a.name.localeCompare(b.name, "de"))
          .map((x) => ({ value: x.code, label: `${x.flag} ${x.name}` })),
      }),
      value == null
        ? h(Notice, { status: "warning", isDismissible: false }, "Keine Zahl erkannt. Bitte den Betrag eingeben, z. B. „38 Mio.“")
        : h(Fragment, null,
          h("fieldset", null,
            h("legend", null, `${core.formatShort(value)} ${core.unitLabel(unit)} entspricht`),
            items.map((m) => h(CheckboxControl, {
              key: m.id, checked: pick.includes(m.id), __nextHasNoMarginBottom: true,
              label: h("span", { className: "means2me-item" }, h("b", null, m.text), " ", m.title),
              onChange: (on) => toggle("pick", m.id, on),
            }))),
          h(ToggleControl, {
            label: "Vergleich mit anderen Zahlen", checked: form.compare, __nextHasNoMarginBottom: true,
            help: "Ein Knopf im Fenster zeigt die nächstgelegenen Beträge aus den gewählten Listen.",
            onChange: (on) => set({ compare: on }),
          }),
          form.compare && h("fieldset", null,
            h("legend", null, "Aus diesen Listen"),
            bn.lists.filter((l) => bn.defaultLists.includes(l.id) && !NOT_COMPARED.includes(l.id)).map((l) => h(CheckboxControl, {
              key: l.id, label: l.name, checked: form.lists.includes(l.id), __nextHasNoMarginBottom: true,
              onChange: (on) => toggle("lists", l.id, on),
            })),
            cmp && h("ul", { className: "means2me-cmp" },
              [...cmp.smaller, { here: true }, ...cmp.larger].map((r, i) => r.here
                ? h("li", { key: "here", className: "means2me-here" }, h("span", null, "Diese Zahl"), h("b", null, `${core.formatShort(value)} ${core.unitLabel(unit)}`))
                : h("li", { key: r.id ?? i }, h("span", null, r.title, r.year ? ` (${r.year})` : ""), h("b", null, r.text)))))),
      h("div", { className: "means2me-actions" },
        onRemove && h(Button, { variant: "tertiary", isDestructive: true, onClick: onRemove }, "Markierung entfernen"),
        h(Button, { variant: "primary", disabled: value == null || !pick.length, onClick: apply },
          old ? "Aktualisieren" : "Übernehmen")));
  }

  function Edit({ isActive, activeAttributes, value, onChange, contentRef }) {
    const [open, setOpen] = useState(null);   // { start, end, text } while the popover is shown
    const anchor = useAnchor({ editableContentElement: contentRef.current, settings: { ...FORMAT, name: NAME, isActive } });

    const start = () => {
      let { start: s, end: e } = value;
      if (s === e && !isActive) {
        // a cursor in an amount: take the whole amount
        const all = getTextContent(value);
        openCore().then(({ core }) => {
          const hit = core.findAmounts(all).find((a) => a.index <= s && s <= a.index + a.length);
          if (hit) setOpen({ start: hit.index, end: hit.index + hit.length, text: all.slice(hit.index, hit.index + hit.length) });
          else setOpen({ start: s, end: e, text: "", empty: true });
        }, () => setOpen({ start: s, end: e, text: "", empty: true }));
        return;
      }
      setOpen({ start: s, end: e, text: getTextContent(slice(value, s, e)) });
    };

    const close = () => setOpen(null);
    const old = isActive ? readData(activeAttributes.data) : null;

    return h(Fragment, null,
      // its own button in the block toolbar, like core footnotes, not hidden under "More"
      h(BlockControls, { group: "other" }, h(ToolbarButton, { icon, label: "Means2Me: Betrag einordnen", onClick: start, isPressed: isActive })),
      open && h(Popover, { anchor, placement: "bottom", onClose: close, focusOnMount: "firstElement", className: "means2me-popover" },
        open.empty && !isActive
          ? h("div", { className: "means2me-form" },
            h("p", null, "Bitte zuerst einen Betrag im Text markieren, z. B. „38 Mio. Euro“."),
            h("div", { className: "means2me-actions" }, h(Button, { variant: "secondary", onClick: close }, "OK")))
          : h(Form, {
            text: open.text, old,
            onApply: (data) => {
              onChange(applyFormat(value, { type: NAME, attributes: { data } }, open.start, open.end));
              close();
            },
            onRemove: isActive ? () => { onChange(removeFormat(value, NAME, open.start, open.end)); close(); } : null,
          })));
  }

  const FORMAT = {
    title: "Means2Me",
    tagName: "span",
    className: "means2me",
    attributes: { data: "data-means2me" },
    edit: Edit,
  };
  registerFormatType(NAME, FORMAT);
})();
