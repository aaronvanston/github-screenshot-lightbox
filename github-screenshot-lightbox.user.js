// ==UserScript==
// @name         GitHub Screenshot Lightbox
// @namespace    https://github-screenshot-lightbox.local/
// @version      0.4.0
// @description  Open GitHub screenshots and image attachments in a lightweight in-page lightbox.
// @match        https://github.com/*
// @run-at       document-idle
// ==/UserScript==
(() => {

  // src/constants.ts
  var ROOT_ID = "gh-screenshot-lightbox-root";
  var STYLE_ID = "gh-screenshot-lightbox-style";
  var IMAGE_EXTENSIONS = /\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 8;
  var WHEEL_ZOOM_SPEED = 0.0024;
  var DRAG_THRESHOLD = 3;
  var GROUP_SELECTORS = [
    ".js-comment-container",
    ".timeline-comment-group",
    ".timeline-comment",
    ".TimelineItem",
    "[id^='issuecomment-']",
    "[id^='pullrequestreview-']",
    "[data-ghslb-group]",
    "article",
    "section",
    ".comment"
  ].join(", ");

  // src/github.ts
  var nextGroupId = 1;
  function resolveUrl(value) {
    if (!value) {
      return null;
    }
    try {
      return new URL(value, window.location.href);
    } catch (_error) {
      return null;
    }
  }
  function isDirectImageUrl(url) {
    return IMAGE_EXTENSIONS.test(url.pathname);
  }
  function isGitHubAttachmentUrl(url) {
    return url.hostname === "github.com" && (url.pathname.indexOf("/user-attachments/assets/") === 0 || /\/assets\/\d+\//.test(url.pathname));
  }
  function isGitHubImageDeliveryUrl(url) {
    const host = url.hostname.toLowerCase();
    if (host === "user-images.githubusercontent.com" || host === "private-user-images.githubusercontent.com" || host === "camo.githubusercontent.com") {
      return true;
    }
    return host.endsWith(".githubusercontent.com") && host !== "avatars.githubusercontent.com" && isDirectImageUrl(url);
  }
  function isRenderableImageUrl(url) {
    return isDirectImageUrl(url) || isGitHubAttachmentUrl(url) || isGitHubImageDeliveryUrl(url);
  }
  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function stripImageExtension(value) {
    return cleanText(value).replace(IMAGE_EXTENSIONS, "");
  }
  function titleFromUrl(url) {
    const lastSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return cleanText(lastSegment.replace(IMAGE_EXTENSIONS, "")) || "GitHub image";
  }
  function fileNameFromUrl(url) {
    const lastSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return cleanText(lastSegment) || "GitHub image";
  }
  function isGenericImageLabel(value) {
    const text = cleanText(value).toLowerCase();
    return !text || text === "image" || text === "screenshot" || text === "attachment";
  }
  function looksLikeScreenshotImage(image) {
    if (!image) {
      return false;
    }
    if (image.closest(".avatar, [data-hovercard-type='user']")) {
      return false;
    }
    const rect = image.getBoundingClientRect();
    const width = image.naturalWidth || rect.width;
    const height = image.naturalHeight || rect.height;
    return width >= 80 && height >= 80 && rect.width >= 40 && rect.height >= 40;
  }
  function findGroupElement(anchor) {
    return anchor.closest(GROUP_SELECTORS) || anchor.closest("main") || document.body;
  }
  function groupKeyForElement(groupElement) {
    if (!groupElement) {
      return "page";
    }
    if (groupElement.id) {
      return groupElement.id;
    }
    if (groupElement instanceof HTMLElement && groupElement.dataset.ghslbGroup) {
      return groupElement.dataset.ghslbGroup;
    }
    const groupable = groupElement;
    if (!groupable.__ghslbGroupId) {
      groupable.__ghslbGroupId = "ghslb-group-" + String(nextGroupId++);
    }
    return groupable.__ghslbGroupId;
  }
  function findGroupLabel(groupElement) {
    if (!groupElement) {
      return "Page";
    }
    if (groupElement instanceof HTMLElement && groupElement.dataset.commentLabel) {
      return cleanText(groupElement.dataset.commentLabel);
    }
    const author = groupElement.querySelector(".author, a[data-hovercard-type='user'], a.Link--primary");
    if (author && cleanText(author.textContent)) {
      return cleanText(author.textContent);
    }
    const heading = groupElement.querySelector("h1, h2, h3, h4, [data-testid='comment-header']");
    if (heading && cleanText(heading.textContent)) {
      return cleanText(heading.textContent);
    }
    return "Section";
  }
  function formatClock(date) {
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
    } catch (_error) {
      return "";
    }
  }
  function formatRelativeTime(date) {
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    const absSeconds = Math.abs(seconds);
    const units = [
      { name: "year", value: 31536000 },
      { name: "month", value: 2592000 },
      { name: "day", value: 86400 },
      { name: "hour", value: 3600 },
      { name: "minute", value: 60 }
    ];
    if (absSeconds < 45) {
      return seconds >= 0 ? "just now" : "in a few seconds";
    }
    for (const unit of units) {
      if (absSeconds >= unit.value) {
        const amount = Math.round(absSeconds / unit.value);
        const suffix = amount === 1 ? unit.name : unit.name + "s";
        return seconds >= 0 ? amount + " " + suffix + " ago" : "in " + amount + " " + suffix;
      }
    }
    return "";
  }
  function findPostedText(groupElement) {
    if (!groupElement) {
      return "";
    }
    const timeNode = groupElement.querySelector("relative-time[datetime], time[datetime], [datetime]");
    if (!timeNode) {
      return "";
    }
    const datetime = timeNode.getAttribute("datetime");
    let relative = cleanText(timeNode.textContent);
    let clock = "";
    if (datetime) {
      const date = new Date(datetime);
      relative = relative || formatRelativeTime(date);
      clock = formatClock(date);
    }
    if (relative && clock) {
      return relative + " · " + clock;
    }
    return relative || clock;
  }
  function itemFromAnchor(anchor) {
    if (!anchor || !anchor.href) {
      return null;
    }
    const hrefUrl = resolveUrl(anchor.getAttribute("href"));
    if (!hrefUrl || hrefUrl.protocol !== "https:" && hrefUrl.protocol !== "http:") {
      return null;
    }
    const image = anchor.querySelector("img");
    if (image && !looksLikeScreenshotImage(image)) {
      return null;
    }
    const imageUrl = image ? resolveUrl(image.currentSrc || image.src) : null;
    const hrefIsRenderable = isRenderableImageUrl(hrefUrl);
    const imageIsRenderable = imageUrl ? isRenderableImageUrl(imageUrl) : false;
    if (!hrefIsRenderable && !imageIsRenderable) {
      return null;
    }
    const srcUrl = hrefIsRenderable ? hrefUrl : imageUrl;
    if (!srcUrl) {
      return null;
    }
    const rawAlt = cleanText(image && image.alt);
    const anchorText = image ? "" : cleanText(anchor.textContent);
    const urlFileName = fileNameFromUrl(srcUrl);
    const title = !isGenericImageLabel(rawAlt) ? rawAlt : anchorText || titleFromUrl(srcUrl);
    const fileName = !isGenericImageLabel(rawAlt) ? rawAlt : urlFileName;
    const groupElement = findGroupElement(anchor);
    return {
      key: hrefUrl.href,
      href: hrefUrl.href,
      src: srcUrl.href,
      title: stripImageExtension(title),
      fileName,
      anchor,
      groupElement,
      groupKey: groupKeyForElement(groupElement),
      groupLabel: findGroupLabel(groupElement),
      postedText: findPostedText(groupElement),
      groupIndex: 0,
      groupItemIndex: 0,
      groupItemCount: 1
    };
  }
  function isVisibleAnchor(anchor) {
    if (!anchor.isConnected || anchor.getClientRects().length === 0) {
      return false;
    }
    const style = window.getComputedStyle(anchor);
    return style.visibility !== "hidden" && style.display !== "none";
  }
  function buildGroups(items) {
    const groupMap = new Map;
    const groups = [];
    items.forEach((item) => {
      let group = groupMap.get(item.groupKey);
      if (!group) {
        group = {
          key: item.groupKey,
          label: item.groupLabel,
          element: item.groupElement,
          items: []
        };
        groupMap.set(item.groupKey, group);
        groups.push(group);
      }
      group.items.push(item);
    });
    groups.forEach((group, groupIndex) => {
      group.items.forEach((item, itemIndex) => {
        item.groupIndex = groupIndex;
        item.groupItemIndex = itemIndex;
        item.groupItemCount = group.items.length;
      });
    });
    return groups;
  }
  function collectItems(clickedAnchor) {
    const scope = document.querySelector("main") || document.body;
    const anchors = Array.prototype.slice.call(scope.querySelectorAll("a[href]"));
    const clickedItem = itemFromAnchor(clickedAnchor);
    const seen = new Set;
    const items = [];
    anchors.forEach((anchor) => {
      const item = itemFromAnchor(anchor);
      if (!item || !isVisibleAnchor(anchor) && anchor !== clickedAnchor || seen.has(item.key)) {
        return;
      }
      seen.add(item.key);
      items.push(item);
    });
    if (clickedItem && !seen.has(clickedItem.key)) {
      items.unshift(clickedItem);
    }
    return items.length > 0 ? items : clickedItem ? [clickedItem] : [];
  }

  // src/icons.ts
  var paths = {
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    previous: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    sectionPrevious: '<path d="m12 19-7-7 7-7"/><path d="M19 5v14"/>',
    sectionNext: '<path d="m12 5 7 7-7 7"/><path d="M5 5v14"/>',
    zoomIn: '<circle cx="11" cy="11" r="6"/><path d="M11 8v6M8 11h6M16 16l4 4"/>',
    zoomOut: '<circle cx="11" cy="11" r="6"/><path d="M8 11h6M16 16l4 4"/>',
    resetZoom: '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M5 5l5 5"/><path d="m14 14 5 5"/>'
  };
  function icon(name) {
    return '<svg class="ghslb-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || "") + "</svg>";
  }
  function buttonHtml(className, action, label, iconName) {
    return '<button class="' + className + '" type="button" data-ghslb-action="' + action + '" aria-label="' + label + '" title="' + label + '">' + icon(iconName) + "</button>";
  }

  // src/styles.ts
  var styles = [
    "#" + ROOT_ID + "[hidden] { display: none !important; }",
    "#" + ROOT_ID + " { position: fixed; inset: 0; z-index: 2147483647; overflow: hidden; color: #f6f8fa; font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; user-select: none; }",
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
    "@media (max-width: 720px) { .ghslb-topbar, .ghslb-bottombar { padding: 12px; } .ghslb-nav-button { width: 38px; height: 38px; } .ghslb-prev { left: 12px; } .ghslb-next { right: 12px; } .ghslb-button { width: 36px; height: 36px; } .ghslb-file-name, .ghslb-meta { max-width: calc(100vw - 182px); } .ghslb-image { max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); } .ghslb-caption { left: 58px; right: 58px; bottom: 74px; } .ghslb-section-button span { display: none; } }"
  ].join(`
`);
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styles;
    document.head.appendChild(style);
  }

  // src/zoom.ts
  function clampZoom(value) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 100) / 100));
  }
  function wheelFactor(event, viewportHeight) {
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      delta *= 16;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      delta *= viewportHeight || window.innerHeight;
    }
    return Math.exp(-delta * WHEEL_ZOOM_SPEED);
  }
  function clampPan(pan, baseSize, viewportSize, zoom) {
    if (zoom <= MIN_ZOOM) {
      return { x: 0, y: 0 };
    }
    const scaledWidth = baseSize.width * zoom;
    const scaledHeight = baseSize.height * zoom;
    const maxX = scaledWidth > viewportSize.width ? (scaledWidth - viewportSize.width) / 2 : 0;
    const maxY = scaledHeight > viewportSize.height ? (scaledHeight - viewportSize.height) / 2 : 0;
    return {
      x: Math.max(-maxX, Math.min(maxX, pan.x)),
      y: Math.max(-maxY, Math.min(maxY, pan.y))
    };
  }
  function zoomAroundPoint(current, nextZoomValue, point, viewportSize, baseSize) {
    const oldZoom = current.zoom || MIN_ZOOM;
    const nextZoom = clampZoom(nextZoomValue);
    if (nextZoom === oldZoom) {
      return current;
    }
    if (nextZoom <= MIN_ZOOM) {
      return { zoom: MIN_ZOOM, panX: 0, panY: 0 };
    }
    const center = {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2
    };
    const imagePoint = {
      x: (point.x - center.x - current.panX) / oldZoom,
      y: (point.y - center.y - current.panY) / oldZoom
    };
    const unclampedPan = {
      x: point.x - center.x - imagePoint.x * nextZoom,
      y: point.y - center.y - imagePoint.y * nextZoom
    };
    const clampedPan = clampPan(unclampedPan, baseSize, viewportSize, nextZoom);
    return {
      zoom: nextZoom,
      panX: clampedPan.x,
      panY: clampedPan.y
    };
  }

  // src/lightbox.ts
  function initialState() {
    return {
      root: null,
      nodes: null,
      items: [],
      groups: [],
      index: 0,
      zoom: MIN_ZOOM,
      panX: 0,
      panY: 0,
      lastFocus: null,
      lastGroupKey: null,
      htmlOverflow: "",
      bodyOverflow: "",
      touchStartX: 0,
      touchStartY: 0,
      isPanning: false,
      didPan: false,
      panStartX: 0,
      panStartY: 0,
      panOriginX: 0,
      panOriginY: 0
    };
  }
  function queryRequired(root, selector) {
    const node = root.querySelector(selector);
    if (!node) {
      throw new Error("Missing lightbox element: " + selector);
    }
    return node;
  }

  class GitHubScreenshotLightbox {
    state = initialState();
    install() {
      document.addEventListener("click", this.handleDocumentClick, true);
      document.addEventListener("keydown", this.handleKeydown, true);
    }
    currentItem() {
      return this.state.items[this.state.index] || null;
    }
    ensureRoot() {
      if (this.state.root) {
        return this.state.root;
      }
      ensureStyles();
      const root = document.createElement("div");
      root.id = ROOT_ID;
      root.hidden = true;
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "GitHub screenshot lightbox");
      root.innerHTML = '<div class="ghslb-backdrop"></div>' + '<figure class="ghslb-viewport">' + '<div class="ghslb-stage">' + '<img class="ghslb-image" alt="" draggable="false">' + "</div>" + '<figcaption class="ghslb-caption"></figcaption>' + '<div class="ghslb-status" hidden></div>' + "</figure>" + '<div class="ghslb-shell">' + '<header class="ghslb-topbar">' + '<div class="ghslb-titleblock">' + '<div class="ghslb-kicker"><span class="ghslb-counter"></span><span class="ghslb-section-counter"></span></div>' + '<div class="ghslb-file-name"></div>' + '<div class="ghslb-meta"></div>' + "</div>" + '<div class="ghslb-toolbar">' + buttonHtml("ghslb-button ghslb-zoom-out", "zoom-out", "Zoom out", "zoomOut") + '<span class="ghslb-zoom-level">100%</span>' + buttonHtml("ghslb-button ghslb-zoom-reset", "zoom-reset", "Reset zoom", "resetZoom") + buttonHtml("ghslb-button ghslb-zoom-in", "zoom-in", "Zoom in", "zoomIn") + buttonHtml("ghslb-button ghslb-close", "close", "Close", "close") + "</div>" + "</header>" + buttonHtml("ghslb-nav-button ghslb-prev", "previous", "Previous image", "previous") + buttonHtml("ghslb-nav-button ghslb-next", "next", "Next image", "next") + '<footer class="ghslb-bottombar">' + '<div class="ghslb-section-nav">' + '<button class="ghslb-section-button ghslb-prev-section" type="button" data-ghslb-action="previous-group" aria-label="Previous section" title="Previous section">' + "<span>Previous section</span>" + "</button>" + '<button class="ghslb-section-button ghslb-next-section" type="button" data-ghslb-action="next-group" aria-label="Next section" title="Next section">' + "<span>Next section</span>" + "</button>" + "</div>" + '<div class="ghslb-section-summary"></div>' + "</footer>" + "</div>";
      document.documentElement.appendChild(root);
      this.state.root = root;
      this.state.nodes = {
        viewport: queryRequired(root, ".ghslb-viewport"),
        stage: queryRequired(root, ".ghslb-stage"),
        image: queryRequired(root, ".ghslb-image"),
        caption: queryRequired(root, ".ghslb-caption"),
        status: queryRequired(root, ".ghslb-status"),
        counter: queryRequired(root, ".ghslb-counter"),
        sectionCounter: queryRequired(root, ".ghslb-section-counter"),
        fileName: queryRequired(root, ".ghslb-file-name"),
        meta: queryRequired(root, ".ghslb-meta"),
        sectionSummary: queryRequired(root, ".ghslb-section-summary"),
        zoomLevel: queryRequired(root, ".ghslb-zoom-level"),
        zoomOut: queryRequired(root, ".ghslb-zoom-out"),
        zoomReset: queryRequired(root, ".ghslb-zoom-reset"),
        zoomIn: queryRequired(root, ".ghslb-zoom-in"),
        previous: queryRequired(root, ".ghslb-prev"),
        next: queryRequired(root, ".ghslb-next"),
        previousGroup: queryRequired(root, ".ghslb-prev-section"),
        nextGroup: queryRequired(root, ".ghslb-next-section"),
        close: queryRequired(root, ".ghslb-close")
      };
      root.addEventListener("click", this.handleRootClick);
      root.addEventListener("pointerdown", this.handlePointerDown);
      root.addEventListener("pointermove", this.handlePointerMove);
      root.addEventListener("pointerup", this.handlePointerEnd);
      root.addEventListener("pointercancel", this.handlePointerEnd);
      root.addEventListener("dragstart", this.handleDragStart);
      root.addEventListener("wheel", this.handleWheel, { passive: false, capture: true });
      root.addEventListener("touchstart", this.handleTouchStart, { passive: true });
      root.addEventListener("touchend", this.handleTouchEnd, { passive: true });
      window.addEventListener("resize", this.handleResize);
      return root;
    }
    getViewportSize() {
      const nodes = this.state.nodes;
      if (!nodes) {
        return { width: window.innerWidth, height: window.innerHeight };
      }
      const rect = nodes.viewport.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }
    getBaseImageSize() {
      const nodes = this.state.nodes;
      if (!nodes) {
        return { width: 0, height: 0 };
      }
      const rect = nodes.image.getBoundingClientRect();
      return {
        width: nodes.image.offsetWidth || rect.width / this.state.zoom,
        height: nodes.image.offsetHeight || rect.height / this.state.zoom
      };
    }
    pointFromEvent(event) {
      const nodes = this.state.nodes;
      if (!nodes) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }
      const rect = nodes.viewport.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
    applyZoomTransform() {
      const nodes = this.state.nodes;
      const zoomed = this.state.zoom > MIN_ZOOM;
      if (!nodes) {
        return;
      }
      nodes.viewport.classList.toggle("is-zoomed", zoomed);
      nodes.image.classList.toggle("is-zoomed", zoomed);
      nodes.zoomLevel.textContent = String(Math.round(this.state.zoom * 100)) + "%";
      nodes.zoomOut.disabled = this.state.zoom <= MIN_ZOOM;
      nodes.zoomReset.disabled = this.state.zoom <= MIN_ZOOM;
      nodes.zoomIn.disabled = this.state.zoom >= MAX_ZOOM;
      nodes.stage.style.transform = "translate3d(-50%, -50%, 0) translate3d(" + String(Math.round(this.state.panX)) + "px, " + String(Math.round(this.state.panY)) + "px, 0)";
      nodes.image.style.transform = "scale(" + String(this.state.zoom) + ")";
    }
    clampCurrentPan() {
      const pan = clampPan({ x: this.state.panX, y: this.state.panY }, this.getBaseImageSize(), this.getViewportSize(), this.state.zoom);
      this.state.panX = pan.x;
      this.state.panY = pan.y;
    }
    resetZoom() {
      this.state.zoom = MIN_ZOOM;
      this.state.panX = 0;
      this.state.panY = 0;
      this.applyZoomTransform();
    }
    zoomAt(value, event) {
      const nodes = this.state.nodes;
      if (!nodes) {
        return;
      }
      const viewportSize = this.getViewportSize();
      const next = zoomAroundPoint({
        zoom: this.state.zoom,
        panX: this.state.panX,
        panY: this.state.panY
      }, value, event ? this.pointFromEvent(event) : { x: viewportSize.width / 2, y: viewportSize.height / 2 }, viewportSize, this.getBaseImageSize());
      this.state.zoom = next.zoom;
      this.state.panX = next.panX;
      this.state.panY = next.panY;
      this.applyZoomTransform();
    }
    render(options) {
      const item = this.currentItem();
      const nodes = this.state.nodes;
      const hasMultipleItems = this.state.items.length > 1;
      const hasMultipleGroups = this.state.groups.length > 1;
      const shouldSync = options && options.syncPage;
      if (!item || !nodes) {
        return;
      }
      this.resetZoom();
      nodes.status.hidden = false;
      nodes.status.textContent = "Loading...";
      nodes.image.hidden = true;
      nodes.image.onload = () => {
        nodes.image.hidden = false;
        nodes.status.hidden = true;
        this.resetZoom();
      };
      nodes.image.onerror = () => {
        nodes.image.hidden = true;
        nodes.status.hidden = false;
        nodes.status.textContent = "Image could not be loaded";
      };
      nodes.image.removeAttribute("src");
      nodes.image.alt = item.title;
      nodes.image.draggable = false;
      nodes.image.src = item.src;
      nodes.fileName.textContent = item.fileName;
      nodes.fileName.title = item.fileName;
      nodes.caption.textContent = item.title;
      nodes.counter.textContent = "Image " + String(this.state.index + 1) + " / " + String(this.state.items.length);
      nodes.sectionCounter.textContent = "Section " + String(item.groupIndex + 1) + " / " + String(this.state.groups.length);
      nodes.meta.textContent = [item.groupLabel, item.postedText].filter(Boolean).join(" · ");
      nodes.sectionSummary.textContent = this.sectionSummary(item);
      nodes.previous.disabled = !hasMultipleItems;
      nodes.next.disabled = !hasMultipleItems;
      nodes.previousGroup.disabled = !hasMultipleGroups;
      nodes.nextGroup.disabled = !hasMultipleGroups;
      if (shouldSync || item.groupKey !== this.state.lastGroupKey) {
        this.syncPageToItem(item);
      }
      this.state.lastGroupKey = item.groupKey;
      this.preloadNeighbor(-1);
      this.preloadNeighbor(1);
    }
    sectionSummary(item) {
      const count = item.groupItemCount > 1 ? String(item.groupItemIndex + 1) + " of " + String(item.groupItemCount) + " images in section" : "1 image in section";
      return item.groupLabel && item.groupLabel !== "Section" ? item.groupLabel + " · " + count : count;
    }
    preloadNeighbor(delta) {
      if (this.state.items.length < 2) {
        return;
      }
      const index = (this.state.index + delta + this.state.items.length) % this.state.items.length;
      const image = new Image;
      image.src = this.state.items[index].src;
    }
    syncPageToItem(item) {
      const target = item && (item.groupElement || item.anchor);
      if (!target || !(target instanceof Element)) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const top = rect.top + window.scrollY - Math.max(24, (window.innerHeight - Math.min(rect.height, window.innerHeight)) / 2);
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    openLightbox(anchor) {
      const clickedItem = itemFromAnchor(anchor);
      if (!clickedItem) {
        return false;
      }
      const root = this.ensureRoot();
      this.state.items = collectItems(anchor);
      this.state.groups = buildGroups(this.state.items);
      this.state.index = Math.max(0, this.state.items.findIndex((item) => item.key === clickedItem.key || item.src === clickedItem.src));
      this.resetZoom();
      this.state.lastGroupKey = null;
      this.state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.state.htmlOverflow = document.documentElement.style.overflow;
      this.state.bodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      root.hidden = false;
      this.render({ syncPage: true });
      this.state.nodes?.close.focus({ preventScroll: true });
      return true;
    }
    closeLightbox() {
      if (!this.state.root || this.state.root.hidden) {
        return;
      }
      this.state.root.hidden = true;
      document.documentElement.style.overflow = this.state.htmlOverflow;
      document.body.style.overflow = this.state.bodyOverflow;
      if (this.state.nodes) {
        this.state.nodes.image.removeAttribute("src");
      }
      this.resetZoom();
      if (this.state.lastFocus && "focus" in this.state.lastFocus) {
        this.state.lastFocus.focus({ preventScroll: true });
      }
    }
    move(delta) {
      if (!this.state.root || this.state.root.hidden || this.state.items.length < 2) {
        return;
      }
      this.state.index = (this.state.index + delta + this.state.items.length) % this.state.items.length;
      this.resetZoom();
      this.render({ syncPage: true });
    }
    moveGroup(delta) {
      const item = this.currentItem();
      if (!item || this.state.groups.length < 2) {
        return;
      }
      const nextGroupIndex = (item.groupIndex + delta + this.state.groups.length) % this.state.groups.length;
      const nextGroup = this.state.groups[nextGroupIndex];
      const nextItem = delta > 0 ? nextGroup.items[0] : nextGroup.items[nextGroup.items.length - 1];
      const nextIndex = this.state.items.indexOf(nextItem);
      if (nextIndex >= 0) {
        this.state.index = nextIndex;
        this.resetZoom();
        this.render({ syncPage: true });
      }
    }
    handleRootClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const actionNode = target && target.closest("[data-ghslb-action]");
      const action = actionNode && actionNode.getAttribute("data-ghslb-action");
      if (action === "close") {
        this.closeLightbox();
      } else if (action === "previous") {
        this.move(-1);
      } else if (action === "next") {
        this.move(1);
      } else if (action === "previous-group") {
        this.moveGroup(-1);
      } else if (action === "next-group") {
        this.moveGroup(1);
      } else if (action === "zoom-in") {
        this.zoomAt(this.state.zoom + 0.5);
      } else if (action === "zoom-out") {
        this.zoomAt(this.state.zoom - 0.5);
      } else if (action === "zoom-reset") {
        this.resetZoom();
      } else if (target && target.closest(".ghslb-image") && !this.state.didPan) {
        if (this.state.zoom > MIN_ZOOM) {
          this.resetZoom();
        } else {
          this.zoomAt(2.5, event);
        }
      } else if (target && target.classList.contains("ghslb-viewport") && !this.state.didPan) {
        this.closeLightbox();
      }
    };
    handlePointerDown = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const imageTarget = target && target.closest(".ghslb-image");
      if (!target || target.closest("[data-ghslb-action]")) {
        return;
      }
      if (imageTarget) {
        event.preventDefault();
      }
      if (event.button !== 0 || this.state.zoom <= MIN_ZOOM || !imageTarget || !this.state.nodes) {
        return;
      }
      this.state.isPanning = true;
      this.state.didPan = false;
      this.state.panStartX = event.clientX;
      this.state.panStartY = event.clientY;
      this.state.panOriginX = this.state.panX;
      this.state.panOriginY = this.state.panY;
      this.state.nodes.viewport.classList.add("is-panning");
      this.state.nodes.viewport.setPointerCapture(event.pointerId);
    };
    handlePointerMove = (event) => {
      if (!this.state.isPanning) {
        return;
      }
      event.preventDefault();
      const deltaX = event.clientX - this.state.panStartX;
      const deltaY = event.clientY - this.state.panStartY;
      if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
        this.state.didPan = true;
      }
      this.state.panX = this.state.panOriginX + deltaX;
      this.state.panY = this.state.panOriginY + deltaY;
      this.clampCurrentPan();
      this.applyZoomTransform();
    };
    handlePointerEnd = (event) => {
      if (!this.state.isPanning || !this.state.nodes) {
        return;
      }
      this.state.isPanning = false;
      this.state.nodes.viewport.classList.remove("is-panning");
      if (this.state.nodes.viewport.hasPointerCapture(event.pointerId)) {
        this.state.nodes.viewport.releasePointerCapture(event.pointerId);
      }
      window.setTimeout(() => {
        this.state.didPan = false;
      }, 0);
    };
    handleDragStart = (event) => {
      if (event.target instanceof Element && event.target.closest(".ghslb-image")) {
        event.preventDefault();
      }
    };
    handleWheel = (event) => {
      if (!this.state.root || this.state.root.hidden || !this.state.nodes) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const viewportSize = this.getViewportSize();
      const factor = wheelFactor(event, viewportSize.height);
      this.zoomAt(clampZoom(this.state.zoom * factor), event);
    };
    handleTouchStart = (event) => {
      if (event.touches.length !== 1) {
        return;
      }
      this.state.touchStartX = event.touches[0].clientX;
      this.state.touchStartY = event.touches[0].clientY;
    };
    handleTouchEnd = (event) => {
      if (event.changedTouches.length !== 1 || this.state.isPanning || this.state.zoom > MIN_ZOOM) {
        return;
      }
      const deltaX = event.changedTouches[0].clientX - this.state.touchStartX;
      const deltaY = event.changedTouches[0].clientY - this.state.touchStartY;
      if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 80) {
        this.move(deltaX > 0 ? -1 : 1);
      }
    };
    handleResize = () => {
      if (!this.state.root || this.state.root.hidden) {
        return;
      }
      this.clampCurrentPan();
      this.applyZoomTransform();
    };
    handleDocumentClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target && target.closest("a[href]");
      if (!anchor || this.state.root && this.state.root.contains(anchor) || !itemFromAnchor(anchor)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.openLightbox(anchor);
    };
    handleKeydown = (event) => {
      if (!this.state.root || this.state.root.hidden) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.closeLightbox();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        event.shiftKey ? this.moveGroup(-1) : this.move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        event.shiftKey ? this.moveGroup(1) : this.move(1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        event.stopPropagation();
        this.zoomAt(this.state.zoom + 0.5);
      } else if (event.key === "-") {
        event.preventDefault();
        event.stopPropagation();
        this.zoomAt(this.state.zoom - 0.5);
      } else if (event.key === "0") {
        event.preventDefault();
        event.stopPropagation();
        this.resetZoom();
      }
    };
  }

  // src/index.ts
  (() => {
    if (window.__githubScreenshotLightboxLoaded) {
      return;
    }
    window.__githubScreenshotLightboxLoaded = true;
    new GitHubScreenshotLightbox().install();
  })();
})();
