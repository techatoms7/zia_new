// ==UserScript==
// @name           Zia Collapsible Sidebar
// @description    Collapsible, blurred sidebar for a Zia fork. Works with Zen's "Only Sidebar"
//                 and "Sidebar and Top Toolbar" layouts. Toggle it in Settings > Sine Mods.
// @include        main
// ==/UserScript==

(function ziaCollapsibleSidebar() {
  "use strict";
  if (window.__ziaCollapsibleLoaded) return;
  window.__ziaCollapsibleLoaded = true;

  const PREF = {
    enabled: "zia.sidebar.collapsible", // master switch: off = Zia's normal sidebar
    collapsed: "zia.sidebar.collapsed", // remembered state
    peek: "zia.sidebar.collapsible.peek", // expand over the page on hover
    blur: "zia.sidebar.collapsible.blur", // blur radius, px
    rail: "zia.sidebar.collapsible.rail", // collapsed width, px
  };
  const PREF_BRANCH = "zia.sidebar.";

  const root = document.documentElement;
  const XHTML = "http://www.w3.org/1999/xhtml";

  const getBool = (name, def) => {
    try { return Services.prefs.getBoolPref(name, def); } catch { return def; }
  };
  const getNum = (name, def, min, max) => {
    let v;
    try { v = parseFloat(Services.prefs.getStringPref(name, "")); }
    catch { try { v = Services.prefs.getIntPref(name); } catch { v = NaN; } }
    if (!Number.isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  };

  // Everything is gated on :root[zia-cs], so with the toggle off Zia is untouched.
  // Compact mode already has its own blurred, floating sidebar, so we stay out of it.
  const S = ':root[zia-cs]:not([zen-compact-mode="true"])';
  const COLLAPSED = `${S}[zia-cs-state="collapsed"]`;
  const RAIL = `${COLLAPSED}:not([zia-cs-peek])`;
  const PEEK = `${COLLAPSED}[zia-cs-peek][zia-cs-peek-on]`;

  const iconSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' " +
    "fill='none' stroke='context-fill' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'>" +
    "<rect x='2' y='3' width='12' height='10' rx='2.6'/><path d='M6.2 3v10'/></svg>";

  const CSS = `
    :root[zia-cs] {
      --zia-cs-rail: 52px;
      --zia-cs-full: 260px;
      --zia-cs-blur: 18px;
      --zia-cs-ease: cubic-bezier(.2, .8, .2, 1);
      /* plain colours on purpose: Zen's theme variables can be gradients, which made the old tint vanish */
      --zia-cs-bg: light-dark(rgb(238 238 241 / .72), rgb(30 30 34 / .72));
      --zia-cs-bg-peek: light-dark(rgb(240 240 243 / .80), rgb(32 32 36 / .80));
    }

    /* animate width changes whichever way we are going */
    ${S} #navigator-toolbox {
      transition: width .24s var(--zia-cs-ease), min-width .24s var(--zia-cs-ease),
                  max-width .24s var(--zia-cs-ease), margin .24s var(--zia-cs-ease),
                  box-shadow .24s var(--zia-cs-ease);
    }

    /* ---- collapsed rail (inline, shrinks the sidebar column) ---- */
    ${COLLAPSED} #navigator-toolbox {
      width: var(--zia-cs-rail) !important;
      min-width: var(--zia-cs-rail) !important;
      max-width: var(--zia-cs-rail) !important;
      position: relative;
      z-index: 6;
      overflow: clip;
      isolation: isolate;
      background: var(--zia-cs-bg) !important;
    }
    /* the blur lives on a pseudo-element behind the content: it survives Zen/Zia styles that
       override backdrop-filter on the toolbox itself */
    ${COLLAPSED} #navigator-toolbox::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      backdrop-filter: blur(var(--zia-cs-blur)) saturate(1.5);
    }
    ${COLLAPSED} #zen-sidebar-splitter { display: none !important; }

    /* icon-only look: hide text and row buttons, centre the icons */
    ${RAIL} :is(.tab-label-container, .tab-close-button, .tab-reset-button, .tab-reset-pin-button,
                .tab-secondary-label, .tab-group-label-container, .tab-group-label,
                .zen-tab-sublabel, .zen-current-workspace-indicator-name) {
      display: none !important;
    }
    ${RAIL} .tabbrowser-tab .tab-content,
    ${RAIL} .tabbrowser-tab .tab-stack {
      justify-content: center !important;
    }
    ${RAIL} .tabbrowser-tab { padding-inline: 0 !important; }
    ${RAIL} :is(#zen-essentials, .zen-essentials-container) {
      grid-template-columns: 1fr !important;
      justify-items: center !important;
      gap: 6px !important;
    }
    /* Zia keeps its essentials tall; make them even squares so they read as icons */
    ${RAIL} .tabbrowser-tab[zen-essential] {
      width: 36px !important;
      min-width: 36px !important;
      max-width: 36px !important;
      height: 36px !important;
      min-height: 36px !important;
      max-height: 36px !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    /* catch-all for leftover text ("N" of New Tab, workspace names): icons stay, words go */
    ${RAIL} #navigator-toolbox :is(label, description, .toolbarbutton-text) {
      font-size: 0 !important;
    }
    /* "Only Sidebar": the nav bar lives in the sidebar, so tuck it away in the rail */
    ${RAIL}[zen-single-toolbar] :is(#nav-bar, #urlbar-container) { display: none !important; }

    /* ---- peek: the sidebar slides out OVER the page (page does not move), blurred ---- */
    ${PEEK} #navigator-toolbox {
      width: var(--zia-cs-full) !important;
      min-width: var(--zia-cs-full) !important;
      max-width: var(--zia-cs-full) !important;
      margin-inline-end: calc(var(--zia-cs-rail) - var(--zia-cs-full)) !important;
      z-index: 20;
      background: var(--zia-cs-bg-peek) !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, .32);
    }
    /* sidebar on the right: it grows leftwards, so the negative margin flips sides */
    ${PEEK} #navigator-toolbox[zen-right-side="true"] {
      margin-inline-end: 0 !important;
      margin-inline-start: calc(var(--zia-cs-rail) - var(--zia-cs-full)) !important;
    }

    /* ---- the toggle button ---- */
    #zia-cs-toggle {
      list-style-image: url("data:image/svg+xml,${encodeURIComponent(iconSvg)}");
      -moz-context-properties: fill, stroke;
      fill: currentColor;
      margin-inline: 2px;
      z-index: 30;
    }
    #zia-cs-toggle[hidden] { display: none !important; }
    #zia-cs-toggle[zia-floating] {
      position: absolute;
      top: 8px;
      inset-inline-end: 8px;
    }
    ${COLLAPSED} #zia-cs-toggle { margin-inline: auto; }
  `;

  let sheetURI = null;
  function injectCSS() {
    const uri = "data:text/css;charset=utf-8," + encodeURIComponent(CSS);
    try {
      window.windowUtils.loadSheetUsingURIString(uri, Ci.nsIDOMWindowUtils.AUTHOR_SHEET);
      sheetURI = uri;
    } catch {
      const style = document.createElementNS(XHTML, "style");
      style.id = "zia-cs-style";
      style.textContent = CSS;
      root.appendChild(style);
    }
  }

  let toolbox, btn, enterT, leaveT;

  function refreshFull() {
    // Zen keeps the user's real sidebar width in --zen-sidebar-width; we never override it.
    const w = parseFloat(getComputedStyle(root).getPropertyValue("--zen-sidebar-width"));
    if (Number.isFinite(w) && w > 120) root.style.setProperty("--zia-cs-full", w + "px");
  }

  function apply() {
    const on = getBool(PREF.enabled, false);
    if (!on) {
      for (const a of ["zia-cs", "zia-cs-state", "zia-cs-peek", "zia-cs-peek-on"]) root.removeAttribute(a);
      if (btn) btn.hidden = true;
      return;
    }
    const collapsed = getBool(PREF.collapsed, false);
    refreshFull();
    root.setAttribute("zia-cs", "");
    root.setAttribute("zia-cs-state", collapsed ? "collapsed" : "expanded");
    root.toggleAttribute("zia-cs-peek-on", getBool(PREF.peek, true));
    if (!collapsed) root.removeAttribute("zia-cs-peek");
    root.style.setProperty("--zia-cs-blur", getNum(PREF.blur, 18, 0, 60) + "px");
    root.style.setProperty("--zia-cs-rail", getNum(PREF.rail, 52, 36, 120) + "px");
    if (btn) {
      btn.hidden = false;
      btn.setAttribute("tooltiptext", collapsed ? "Expand sidebar (Ctrl+Shift+\\)" : "Collapse sidebar (Ctrl+Shift+\\)");
    }
  }

  function toggle() {
    if (!getBool(PREF.enabled, false)) return;
    Services.prefs.setBoolPref(PREF.collapsed, !getBool(PREF.collapsed, false));
  }

  function pointerInside() {
    try { return toolbox.matches(":hover"); } catch { return false; }
  }
  function popupOpen() {
    return !!document.querySelector("panel[panelopen='true'], menupopup[state='open'], panel[state='open']");
  }
  function maybeClosePeek() {
    if (pointerInside() || popupOpen()) return;
    root.removeAttribute("zia-cs-peek");
  }

  function wirePeek() {
    toolbox.addEventListener("mouseenter", () => {
      clearTimeout(leaveT);
      if (root.getAttribute("zia-cs-state") !== "collapsed") return;
      enterT = setTimeout(() => { refreshFull(); root.setAttribute("zia-cs-peek", ""); }, 110);
    });
    toolbox.addEventListener("mouseleave", () => {
      clearTimeout(enterT);
      leaveT = setTimeout(maybeClosePeek, 280);
    });
    // dragging a tab onto the rail opens it straight away so you can drop into folders
    toolbox.addEventListener("dragenter", () => {
      if (root.getAttribute("zia-cs-state") === "collapsed") root.setAttribute("zia-cs-peek", "");
    });
    // a menu opened from the sidebar keeps it out until the menu is gone
    window.addEventListener("popuphidden", () => {
      clearTimeout(leaveT);
      leaveT = setTimeout(maybeClosePeek, 200);
    }, true);
  }

  function buildButton() {
    btn = document.createXULElement("toolbarbutton");
    btn.id = "zia-cs-toggle";
    btn.className = "toolbarbutton-1 zen-sidebar-action-button";
    btn.setAttribute("label", "Collapse sidebar");
    btn.addEventListener("command", toggle);

    const top = document.getElementById("zen-sidebar-top-buttons");
    if (top) {
      // after the window controls (macOS traffic lights) if they are there
      const wc = top.querySelector(".titlebar-buttonbox-container");
      if (wc && wc.nextSibling) top.insertBefore(btn, wc.nextSibling);
      else top.appendChild(btn);
    } else {
      btn.setAttribute("zia-floating", "");
      toolbox.appendChild(btn);
    }
  }

  function init() {
    toolbox = document.getElementById("navigator-toolbox");
    if (!toolbox) return;
    injectCSS();
    buildButton();
    wirePeek();

    const observer = { observe() { apply(); } };
    Services.prefs.addObserver(PREF_BRANCH, observer);
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver(PREF_BRANCH, observer);
      if (sheetURI) {
        try { window.windowUtils.removeSheetUsingURIString(sheetURI, Ci.nsIDOMWindowUtils.AUTHOR_SHEET); } catch {}
      }
    }, { once: true });

    // Ctrl+Shift+\ toggles
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "Backslash") {
        e.preventDefault();
        toggle();
      }
    });

    apply();
  }

  // the sidebar may not exist yet when scripts load, so wait for it
  let tries = 0;
  const wait = setInterval(() => {
    if (document.getElementById("navigator-toolbox") || ++tries > 100) {
      clearInterval(wait);
      init();
    }
  }, 200);
})();
