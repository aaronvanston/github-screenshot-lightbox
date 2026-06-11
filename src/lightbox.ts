import { DRAG_THRESHOLD, MAX_ZOOM, MIN_ZOOM, ROOT_ID } from "./constants";
import { buildGroups, collectItems, itemFromAnchor } from "./github";
import { buttonHtml } from "./icons";
import { ensureStyles } from "./styles";
import type { LightboxItem, LightboxNodes, LightboxState } from "./types";
import { clampPan, clampZoom, wheelFactor, zoomAroundPoint } from "./zoom";

function initialState(): LightboxState {
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
    panOriginY: 0,
  };
}

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) {
    throw new Error("Missing lightbox element: " + selector);
  }

  return node;
}

export class GitHubScreenshotLightbox {
  private state = initialState();

  install(): void {
    document.addEventListener("click", this.handleDocumentClick, true);
    document.addEventListener("keydown", this.handleKeydown, true);
  }

  private currentItem(): LightboxItem | null {
    return this.state.items[this.state.index] || null;
  }

  private ensureRoot(): HTMLElement {
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
    root.innerHTML =
      '<div class="ghslb-backdrop"></div>' +
      '<figure class="ghslb-viewport">' +
      '<div class="ghslb-stage">' +
      '<img class="ghslb-image" alt="" draggable="false">' +
      "</div>" +
      '<figcaption class="ghslb-caption"></figcaption>' +
      '<div class="ghslb-status" hidden></div>' +
      "</figure>" +
      '<div class="ghslb-shell">' +
      '<header class="ghslb-topbar">' +
      '<div class="ghslb-titleblock">' +
      '<div class="ghslb-kicker"><span class="ghslb-counter"></span><span class="ghslb-section-counter"></span></div>' +
      '<div class="ghslb-file-name"></div>' +
      '<div class="ghslb-meta"></div>' +
      "</div>" +
      '<div class="ghslb-toolbar">' +
      buttonHtml("ghslb-button ghslb-zoom-out", "zoom-out", "Zoom out", "zoomOut") +
      '<span class="ghslb-zoom-level">100%</span>' +
      buttonHtml("ghslb-button ghslb-zoom-reset", "zoom-reset", "Reset zoom", "resetZoom") +
      buttonHtml("ghslb-button ghslb-zoom-in", "zoom-in", "Zoom in", "zoomIn") +
      buttonHtml("ghslb-button ghslb-close", "close", "Close", "close") +
      "</div>" +
      "</header>" +
      buttonHtml("ghslb-nav-button ghslb-prev", "previous", "Previous image", "previous") +
      buttonHtml("ghslb-nav-button ghslb-next", "next", "Next image", "next") +
      '<footer class="ghslb-bottombar">' +
      '<div class="ghslb-section-nav">' +
      '<button class="ghslb-section-button ghslb-prev-section" type="button" data-ghslb-action="previous-group" aria-label="Previous section" title="Previous section">' +
      '<span>Previous section</span>' +
      "</button>" +
      '<button class="ghslb-section-button ghslb-next-section" type="button" data-ghslb-action="next-group" aria-label="Next section" title="Next section">' +
      '<span>Next section</span>' +
      "</button>" +
      "</div>" +
      '<div class="ghslb-section-summary"></div>' +
      "</footer>" +
      "</div>";

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
      close: queryRequired(root, ".ghslb-close"),
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

  private getViewportSize() {
    const nodes = this.state.nodes;
    if (!nodes) {
      return { width: window.innerWidth, height: window.innerHeight };
    }

    const rect = nodes.viewport.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  private getBaseImageSize() {
    const nodes = this.state.nodes;
    if (!nodes) {
      return { width: 0, height: 0 };
    }

    const rect = nodes.image.getBoundingClientRect();
    return {
      width: nodes.image.offsetWidth || rect.width / this.state.zoom,
      height: nodes.image.offsetHeight || rect.height / this.state.zoom,
    };
  }

  private pointFromEvent(event: MouseEvent | PointerEvent | WheelEvent) {
    const nodes = this.state.nodes;
    if (!nodes) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const rect = nodes.viewport.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private applyZoomTransform(): void {
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
    nodes.stage.style.transform =
      "translate3d(-50%, -50%, 0) translate3d(" +
      String(Math.round(this.state.panX)) +
      "px, " +
      String(Math.round(this.state.panY)) +
      "px, 0)";
    nodes.image.style.transform = "scale(" + String(this.state.zoom) + ")";
  }

  private clampCurrentPan(): void {
    const pan = clampPan(
      { x: this.state.panX, y: this.state.panY },
      this.getBaseImageSize(),
      this.getViewportSize(),
      this.state.zoom
    );

    this.state.panX = pan.x;
    this.state.panY = pan.y;
  }

  private resetZoom(): void {
    this.state.zoom = MIN_ZOOM;
    this.state.panX = 0;
    this.state.panY = 0;
    this.applyZoomTransform();
  }

  private zoomAt(value: number, event?: MouseEvent | PointerEvent | WheelEvent): void {
    const nodes = this.state.nodes;
    if (!nodes) {
      return;
    }

    const viewportSize = this.getViewportSize();
    const next = zoomAroundPoint(
      {
        zoom: this.state.zoom,
        panX: this.state.panX,
        panY: this.state.panY,
      },
      value,
      event ? this.pointFromEvent(event) : { x: viewportSize.width / 2, y: viewportSize.height / 2 },
      viewportSize,
      this.getBaseImageSize()
    );

    this.state.zoom = next.zoom;
    this.state.panX = next.panX;
    this.state.panY = next.panY;
    this.applyZoomTransform();
  }

  private render(options?: { syncPage?: boolean }): void {
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
    nodes.sectionCounter.textContent =
      "Section " + String(item.groupIndex + 1) + " / " + String(this.state.groups.length);
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

  private sectionSummary(item: LightboxItem): string {
    const count =
      item.groupItemCount > 1
        ? String(item.groupItemIndex + 1) + " of " + String(item.groupItemCount) + " images in section"
        : "1 image in section";

    return item.groupLabel && item.groupLabel !== "Section" ? item.groupLabel + " · " + count : count;
  }

  private preloadNeighbor(delta: number): void {
    if (this.state.items.length < 2) {
      return;
    }

    const index = (this.state.index + delta + this.state.items.length) % this.state.items.length;
    const image = new Image();
    image.src = this.state.items[index].src;
  }

  private syncPageToItem(item: LightboxItem): void {
    const target = item && (item.groupElement || item.anchor);
    if (!target || !(target instanceof Element)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const top = rect.top + window.scrollY - Math.max(24, (window.innerHeight - Math.min(rect.height, window.innerHeight)) / 2);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  private openLightbox(anchor: HTMLAnchorElement): boolean {
    const clickedItem = itemFromAnchor(anchor);
    if (!clickedItem) {
      return false;
    }

    const root = this.ensureRoot();

    this.state.items = collectItems(anchor);
    this.state.groups = buildGroups(this.state.items);
    this.state.index = Math.max(
      0,
      this.state.items.findIndex((item) => item.key === clickedItem.key || item.src === clickedItem.src)
    );
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

  private closeLightbox(): void {
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
      (this.state.lastFocus as HTMLElement).focus({ preventScroll: true });
    }
  }

  private move(delta: number): void {
    if (!this.state.root || this.state.root.hidden || this.state.items.length < 2) {
      return;
    }

    this.state.index = (this.state.index + delta + this.state.items.length) % this.state.items.length;
    this.resetZoom();
    this.render({ syncPage: true });
  }

  private moveGroup(delta: number): void {
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

  private handleRootClick = (event: MouseEvent): void => {
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

  private handlePointerDown = (event: PointerEvent): void => {
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

  private handlePointerMove = (event: PointerEvent): void => {
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

  private handlePointerEnd = (event: PointerEvent): void => {
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

  private handleDragStart = (event: DragEvent): void => {
    if (event.target instanceof Element && event.target.closest(".ghslb-image")) {
      event.preventDefault();
    }
  };

  private handleWheel = (event: WheelEvent): void => {
    if (!this.state.root || this.state.root.hidden || !this.state.nodes) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const viewportSize = this.getViewportSize();
    const factor = wheelFactor(event, viewportSize.height);
    this.zoomAt(clampZoom(this.state.zoom * factor), event);
  };

  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      return;
    }

    this.state.touchStartX = event.touches[0].clientX;
    this.state.touchStartY = event.touches[0].clientY;
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (event.changedTouches.length !== 1 || this.state.isPanning || this.state.zoom > MIN_ZOOM) {
      return;
    }

    const deltaX = event.changedTouches[0].clientX - this.state.touchStartX;
    const deltaY = event.changedTouches[0].clientY - this.state.touchStartY;

    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 80) {
      this.move(deltaX > 0 ? -1 : 1);
    }
  };

  private handleResize = (): void => {
    if (!this.state.root || this.state.root.hidden) {
      return;
    }

    this.clampCurrentPan();
    this.applyZoomTransform();
  };

  private handleDocumentClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const anchor = target && target.closest<HTMLAnchorElement>("a[href]");

    if (!anchor || (this.state.root && this.state.root.contains(anchor)) || !itemFromAnchor(anchor)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openLightbox(anchor);
  };

  private handleKeydown = (event: KeyboardEvent): void => {
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
