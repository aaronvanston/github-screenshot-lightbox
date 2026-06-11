import { ROOT_ID, STYLE_ID } from "./constants";

const styles = [
  "#" + ROOT_ID + "[hidden] { display: none !important; }",
  "#" +
    ROOT_ID +
    " { position: fixed; inset: 0; z-index: 2147483647; overflow: hidden; color: #f6f8fa; font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; user-select: none; }",
  "#" + ROOT_ID + " * { box-sizing: border-box; }",
  ".ghslb-backdrop { position: absolute; inset: 0; z-index: 1; background: rgba(9, 11, 15, 0.82); backdrop-filter: blur(3px); }",
  ".ghslb-viewport { position: absolute; inset: 0; z-index: 2; margin: 0; overflow: hidden; cursor: zoom-in; pointer-events: auto; touch-action: none; overscroll-behavior: contain; }",
  ".ghslb-viewport.is-zoomed { cursor: grab; }",
  ".ghslb-viewport.is-panning { cursor: grabbing; }",
  ".ghslb-stage { position: absolute; left: 50%; top: 50%; z-index: 1; display: block; transform: translate3d(-50%, -50%, 0); will-change: transform; }",
  ".ghslb-image { display: block; max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); object-fit: contain; transform: scale(1); transform-origin: center center; will-change: transform; box-shadow: 0 24px 90px rgba(0, 0, 0, 0.52); background: #0d1117; border-radius: 6px; cursor: zoom-in; user-select: none; -webkit-user-drag: none; }",
  ".ghslb-image.is-zoomed { cursor: grab; }",
  ".ghslb-viewport.is-panning .ghslb-image.is-zoomed { cursor: grabbing; }",
  ".ghslb-caption { position: absolute; z-index: 3; left: 96px; right: 96px; bottom: 78px; text-align: center; color: rgba(246, 248, 250, 0.72); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }",
  ".ghslb-status { position: absolute; z-index: 12; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 8px 10px; border: 1px solid rgba(240, 246, 252, 0.16); border-radius: 8px; background: rgba(22, 27, 34, 0.92); color: #f6f8fa; }",
  ".ghslb-shell { position: absolute; inset: 0; z-index: 10; pointer-events: none; }",
  ".ghslb-topbar, .ghslb-bottombar { position: absolute; left: 0; right: 0; z-index: 11; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; pointer-events: none; }",
  ".ghslb-topbar > *, .ghslb-bottombar > * { pointer-events: auto; }",
  ".ghslb-topbar { top: 0; background: linear-gradient(180deg, rgba(9, 11, 15, 0.78), rgba(9, 11, 15, 0)); }",
  ".ghslb-bottombar { bottom: 0; align-items: center; background: linear-gradient(0deg, rgba(9, 11, 15, 0.74), rgba(9, 11, 15, 0)); }",
  ".ghslb-titleblock { min-width: 0; display: grid; gap: 2px; }",
  ".ghslb-kicker, .ghslb-meta, .ghslb-section-counter { color: rgba(246, 248, 250, 0.66); font-size: 12px; }",
  ".ghslb-kicker { display: flex; align-items: center; gap: 8px; min-height: 17px; }",
  ".ghslb-file-name { color: #f6f8fa; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: min(72vw, 820px); }",
  ".ghslb-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: min(72vw, 820px); }",
  ".ghslb-toolbar, .ghslb-section-nav { display: flex; align-items: center; gap: 8px; }",
  ".ghslb-button, .ghslb-nav-button, .ghslb-section-button { appearance: none; border: 1px solid rgba(240, 246, 252, 0.2); background: rgba(22, 24, 29, 0.78); color: #f6f8fa; display: inline-grid; place-items: center; cursor: pointer; transition: background 120ms ease, border-color 120ms ease, transform 120ms ease; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22); }",
  ".ghslb-button { width: 38px; height: 38px; border-radius: 999px; }",
  ".ghslb-nav-button { position: absolute; top: 50%; z-index: 12; width: 44px; height: 44px; border-radius: 999px; pointer-events: auto; }",
  ".ghslb-prev { left: 20px; transform: translateY(-50%); }",
  ".ghslb-next { right: 20px; transform: translateY(-50%); }",
  ".ghslb-section-button { grid-auto-flow: column; gap: 6px; min-width: 42px; height: 36px; padding: 0 10px; border-radius: 999px; color: rgba(246, 248, 250, 0.88); }",
  ".ghslb-section-button span { font-size: 12px; font-weight: 600; }",
  ".ghslb-button:hover, .ghslb-section-button:hover { background: rgba(48, 54, 61, 0.96); border-color: rgba(240, 246, 252, 0.36); transform: translateY(-1px); }",
  ".ghslb-nav-button:hover { background: rgba(48, 54, 61, 0.96); border-color: rgba(240, 246, 252, 0.36); transform: translateY(-50%) scale(1.04); }",
  ".ghslb-button:focus-visible, .ghslb-nav-button:focus-visible, .ghslb-section-button:focus-visible { outline: 2px solid #2f81f7; outline-offset: 3px; }",
  ".ghslb-button:disabled, .ghslb-nav-button:disabled, .ghslb-section-button:disabled { opacity: 0.34; cursor: default; transform: none; }",
  ".ghslb-nav-button:disabled { transform: translateY(-50%); }",
  ".ghslb-icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }",
  ".ghslb-zoom-level { min-width: 42px; text-align: center; color: rgba(246, 248, 250, 0.72); font-size: 12px; font-variant-numeric: tabular-nums; }",
  ".ghslb-section-summary { min-width: 0; color: rgba(246, 248, 250, 0.78); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
  "@media (max-width: 720px) { .ghslb-topbar, .ghslb-bottombar { padding: 12px; } .ghslb-nav-button { width: 38px; height: 38px; } .ghslb-prev { left: 12px; } .ghslb-next { right: 12px; } .ghslb-button { width: 36px; height: 36px; } .ghslb-file-name, .ghslb-meta { max-width: calc(100vw - 182px); } .ghslb-image { max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); } .ghslb-caption { left: 58px; right: 58px; bottom: 74px; } .ghslb-section-button span { display: none; } }",
].join("\n");

export function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styles;
  document.head.appendChild(style);
}
