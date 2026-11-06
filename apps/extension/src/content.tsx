/**
 * D-Vault content script.
 *
 * Injected ONLY on explicit activation (toolbar click or popup "Activate").
 * Creates a shadow-DOM host with:
 *  - the floating D button (draggable, repositionable)
 *  - the assistant panel: voice commands, form analysis, confidence-scored
 *    review and approved autofill.
 *
 * It never touches the page before activation, never submits forms and
 * never reads field values during inspection.
 */

import { createRoot } from "react-dom/client";
import { DPanel } from "./panel/DPanel";

function mount() {
  if (document.getElementById("dvault-root")) {
    // already active — toggle visibility
    const existing = document.getElementById("dvault-root");
    const shadow = existing?.shadowRoot;
    const panel = shadow?.querySelector(".dv-panel");
    if (panel) panel.classList.toggle("dv-hidden");
    return;
  }
  const host = document.createElement("div");
  host.id = "dvault-root";
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });

  const css = document.createElement("style");
  css.textContent = PANEL_CSS;
  shadow.appendChild(css);

  const reactRoot = document.createElement("div");
  reactRoot.className = "dv-root";
  shadow.appendChild(reactRoot);

  document.documentElement.appendChild(host);
  createRoot(reactRoot).render(<DPanel />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(mount, 60));
} else {
  setTimeout(mount, 60);
}

const PANEL_CSS = `
  :host, .dv-root { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, "Segoe UI", system-ui, sans-serif; }
  .dv-hidden { display: none !important; }

  .dv-fab {
    position: fixed; right: 24px; bottom: 24px; width: 54px; height: 54px;
    border-radius: 50%; cursor: pointer; user-select: none;
    background: #060B1B; border: 1.5px solid rgba(147,197,253,.35);
    box-shadow: 0 10px 30px -8px rgba(37,99,235,.55), 0 0 0 0 rgba(37,99,235,.4);
    display: flex; align-items: center; justify-content: center;
    transition: transform .18s ease, box-shadow .3s ease; z-index: 2147483647;
  }
  .dv-fab:hover { transform: scale(1.06); }
  .dv-fab.listening { animation: dv-pulse 1.6s infinite; }
  .dv-fab.error { border-color: rgba(248,113,113,.6); }
  @keyframes dv-pulse {
    0% { box-shadow: 0 10px 30px -8px rgba(37,99,235,.55), 0 0 0 0 rgba(37,99,235,.45); }
    70% { box-shadow: 0 10px 30px -8px rgba(37,99,235,.55), 0 0 0 16px rgba(37,99,235,0); }
    100% { box-shadow: 0 10px 30px -8px rgba(37,99,235,.55), 0 0 0 0 rgba(37,99,235,0); }
  }
  .dv-fab svg { pointer-events: none; }

  .dv-panel {
    position: fixed; right: 24px; bottom: 92px; width: 388px; max-width: calc(100vw - 32px);
    max-height: min(560px, calc(100vh - 120px));
    display: flex; flex-direction: column; overflow: hidden; z-index: 2147483647;
    background: linear-gradient(180deg, #091025 0%, #060B1B 30%);
    color: #e2e8f0; border: 1px solid rgba(147,197,253,.22);
    border-radius: 18px;
    box-shadow: 0 30px 80px -20px rgba(4,6,15,.8), 0 0 40px -14px rgba(37,99,235,.35);
  }

  .dv-head { padding: 14px 16px 10px; border-bottom: 1px solid rgba(147,197,253,.12); }
  .dv-head-row { display: flex; align-items: center; justify-content: space-between; }
  .dv-title { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #fff; }
  .dv-sub { font-size: 11px; color: #64748b; margin-top: 3px; line-height: 1.4; }
  .dv-x { background: none; border: 0; color: #475569; cursor: pointer; font-size: 15px; padding: 4px 6px; border-radius: 6px; }
  .dv-x:hover { color: #e2e8f0; background: rgba(255,255,255,.05); }

  .dv-wave { display: block; width: 100%; height: 34px; margin-top: 8px; }

  .dv-body { padding: 12px 14px; overflow-y: auto; flex: 1; font-size: 12.5px; line-height: 1.5; }
  .dv-body::-webkit-scrollbar { width: 8px; }
  .dv-body::-webkit-scrollbar-thumb { background: rgba(147,197,253,.15); border-radius: 8px; }

  .dv-bubble { border-radius: 12px; padding: 9px 12px; margin-bottom: 8px; max-width: 92%; font-size: 12.5px; }
  .dv-bubble.user { background: #2e6efa; color: #fff; margin-left: auto; }
  .dv-bubble.d { background: rgba(255,255,255,.045); border: 1px solid rgba(147,197,253,.1); color: #cbd5e1; }
  .dv-bubble .intent { display: block; font-size: 9.5px; letter-spacing: .08em; color: #60a5fa; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
  .dv-bubble.err { border-color: rgba(248,113,113,.3); color: #fca5a5; }

  .dv-controls { padding: 12px 14px; border-top: 1px solid rgba(147,197,253,.12); }
  .dv-mic-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .dv-mic {
    width: 46px; height: 46px; border-radius: 50%; border: 0; cursor: pointer;
    background: #2e6efa; color: #fff; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px -8px rgba(37,99,235,.8); transition: background .15s;
  }
  .dv-mic:hover { background: #5291ff; }
  .dv-mic.stop { background: #fff; color: #091025; }
  .dv-status { text-align: center; font-size: 11px; color: #64748b; margin-top: 8px; min-height: 15px; }
  .dv-status.listening { color: #b5cdff; }

  .dv-typed { display: flex; gap: 8px; margin-top: 10px; }
  .dv-typed input {
    flex: 1; background: rgba(4,6,15,.6); border: 1px solid rgba(147,197,253,.16); border-radius: 10px;
    color: #fff; font-size: 12.5px; padding: 8px 11px;
  }
  .dv-typed input:focus { outline: none; border-color: #5291ff; }
  .dv-btn { border: 0; border-radius: 10px; padding: 8px 13px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .dv-btn.primary { background: #2e6efa; color: #fff; }
  .dv-btn.primary:hover { background: #5291ff; }
  .dv-btn.ghost { background: rgba(255,255,255,.06); color: #cbd5e1; }
  .dv-btn.pink { background: rgba(244,166,200,.12); border: 1px solid rgba(244,166,200,.3); color: #fa6eab; }
  .dv-btn:disabled { opacity: .5; cursor: default; }

  .dv-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
  .dv-chip {
    border: 1px solid rgba(147,197,253,.2); background: rgba(255,255,255,.04); color: #b5cdff;
    font-size: 10.5px; font-weight: 600; padding: 4px 10px; border-radius: 999px; cursor: pointer;
  }
  .dv-chip:hover { border-color: rgba(147,197,253,.5); }

  /* review panel */
  .dv-review-head { font-size: 12px; color: #b5cdff; font-weight: 700; margin: 4px 0 8px; }
  .dv-field { border: 1px solid rgba(147,197,253,.12); border-radius: 12px; padding: 9px 11px; margin-bottom: 7px; background: rgba(255,255,255,.025); }
  .dv-field.excluded { opacity: .45; }
  .dv-field-top { display: flex; align-items: center; gap: 7px; }
  .dv-field-label { font-size: 12px; font-weight: 600; color: #e2e8f0; flex: 1; }
  .dv-conf { font-size: 9px; font-weight: 800; letter-spacing: .05em; padding: 2px 7px; border-radius: 999px; }
  .dv-conf.high { background: rgba(16,185,129,.15); color: #34d399; }
  .dv-conf.medium { background: rgba(245,158,11,.15); color: #fbbf24; }
  .dv-conf.low { background: rgba(244,166,200,.15); color: #fa6eab; }
  .dv-conf.missing { background: rgba(148,163,184,.15); color: #94a3b8; }
  .dv-conf.unsupported { background: rgba(248,113,113,.15); color: #f87171; }
  .dv-mapto { font-size: 10.5px; color: #64748b; margin-top: 2px; }
  .dv-value-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  .dv-value-row input, .dv-value-row select {
    flex: 1; background: rgba(4,6,15,.5); border: 1px solid rgba(147,197,253,.14); border-radius: 8px;
    color: #fff; font-size: 12px; padding: 6px 9px; min-width: 0;
  }
  .dv-eye { background: none; border: 0; color: #64748b; cursor: pointer; font-size: 12px; padding: 4px; }
  .dv-eye:hover { color: #b5cdff; }
  .dv-exclude { background: none; border: 0; color: #64748b; cursor: pointer; padding: 3px 6px; font-size: 11px; border-radius: 6px; }
  .dv-exclude:hover { color: #f87171; background: rgba(248,113,113,.08); }
  .dv-review-actions { display: flex; gap: 8px; margin-top: 10px; }
  .dv-review-actions .dv-btn { flex: 1; }
  .dv-note { font-size: 10.5px; color: #475569; line-height: 1.5; margin-top: 8px; }

  .dv-profile-row { display: flex; gap: 6px; margin: 6px 0; }
  .dv-profile {
    flex: 1; border: 1px solid rgba(147,197,253,.2); background: rgba(255,255,255,.03); color: #94a3b8;
    border-radius: 10px; padding: 7px; font-size: 11.5px; font-weight: 600; cursor: pointer;
  }
  .dv-profile.active { border-color: #5291ff; background: rgba(37,99,235,.15); color: #fff; }

  .dv-ref { font-family: ui-monospace, monospace; background: rgba(37,99,235,.12); color: #b5cdff; border-radius: 8px; padding: 3px 8px; }
  .dv-checkline { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #94a3b8; margin-top: 8px; }
  .dv-spinner { width: 14px; height: 14px; border: 2px solid rgba(147,197,253,.3); border-top-color: #5291ff; border-radius: 50%; animation: dv-spin .7s linear infinite; display: inline-block; }
  @keyframes dv-spin { to { transform: rotate(360deg); } }
`;
