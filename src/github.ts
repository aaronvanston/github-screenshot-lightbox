import { GROUP_SELECTORS, IMAGE_EXTENSIONS } from "./constants";
import type { GroupableElement, LightboxGroup, LightboxItem } from "./types";

let nextGroupId = 1;

function resolveUrl(value: string | null): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, window.location.href);
  } catch (_error) {
    return null;
  }
}

function isDirectImageUrl(url: URL): boolean {
  return IMAGE_EXTENSIONS.test(url.pathname);
}

function isGitHubAttachmentUrl(url: URL): boolean {
  return (
    url.hostname === "github.com" &&
    (url.pathname.indexOf("/user-attachments/assets/") === 0 || /\/assets\/\d+\//.test(url.pathname))
  );
}

function isGitHubImageDeliveryUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();

  if (
    host === "user-images.githubusercontent.com" ||
    host === "private-user-images.githubusercontent.com" ||
    host === "camo.githubusercontent.com"
  ) {
    return true;
  }

  return host.endsWith(".githubusercontent.com") && host !== "avatars.githubusercontent.com" && isDirectImageUrl(url);
}

function isRenderableImageUrl(url: URL): boolean {
  return isDirectImageUrl(url) || isGitHubAttachmentUrl(url) || isGitHubImageDeliveryUrl(url);
}

function cleanText(value: string | null | undefined): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripImageExtension(value: string): string {
  return cleanText(value).replace(IMAGE_EXTENSIONS, "");
}

function titleFromUrl(url: URL): string {
  const lastSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
  return cleanText(lastSegment.replace(IMAGE_EXTENSIONS, "")) || "GitHub image";
}

function fileNameFromUrl(url: URL): string {
  const lastSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
  return cleanText(lastSegment) || "GitHub image";
}

function isGenericImageLabel(value: string): boolean {
  const text = cleanText(value).toLowerCase();
  return !text || text === "image" || text === "screenshot" || text === "attachment";
}

function looksLikeScreenshotImage(image: HTMLImageElement | null): boolean {
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

function findGroupElement(anchor: HTMLAnchorElement): Element {
  return anchor.closest(GROUP_SELECTORS) || anchor.closest("main") || document.body;
}

function groupKeyForElement(groupElement: Element | null): string {
  if (!groupElement) {
    return "page";
  }

  if (groupElement.id) {
    return groupElement.id;
  }

  if (groupElement instanceof HTMLElement && groupElement.dataset.ghslbGroup) {
    return groupElement.dataset.ghslbGroup;
  }

  const groupable = groupElement as GroupableElement;
  if (!groupable.__ghslbGroupId) {
    groupable.__ghslbGroupId = "ghslb-group-" + String(nextGroupId++);
  }

  return groupable.__ghslbGroupId;
}

function findGroupLabel(groupElement: Element | null): string {
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

function formatClock(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  } catch (_error) {
    return "";
  }
}

function formatRelativeTime(date: Date): string {
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
    { name: "minute", value: 60 },
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

function findPostedText(groupElement: Element | null): string {
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

export function itemFromAnchor(anchor: HTMLAnchorElement | null): LightboxItem | null {
  if (!anchor || !anchor.href) {
    return null;
  }

  const hrefUrl = resolveUrl(anchor.getAttribute("href"));
  if (!hrefUrl || (hrefUrl.protocol !== "https:" && hrefUrl.protocol !== "http:")) {
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
    groupItemCount: 1,
  };
}

function isVisibleAnchor(anchor: HTMLAnchorElement): boolean {
  if (!anchor.isConnected || anchor.getClientRects().length === 0) {
    return false;
  }

  const style = window.getComputedStyle(anchor);
  return style.visibility !== "hidden" && style.display !== "none";
}

export function buildGroups(items: LightboxItem[]): LightboxGroup[] {
  const groupMap = new Map<string, LightboxGroup>();
  const groups: LightboxGroup[] = [];

  items.forEach((item) => {
    let group = groupMap.get(item.groupKey);
    if (!group) {
      group = {
        key: item.groupKey,
        label: item.groupLabel,
        element: item.groupElement,
        items: [],
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

export function collectItems(clickedAnchor: HTMLAnchorElement): LightboxItem[] {
  const scope = document.querySelector("main") || document.body;
  const anchors = Array.prototype.slice.call(scope.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  const clickedItem = itemFromAnchor(clickedAnchor);
  const seen = new Set<string>();
  const items: LightboxItem[] = [];

  anchors.forEach((anchor) => {
    const item = itemFromAnchor(anchor);

    if (!item || (!isVisibleAnchor(anchor) && anchor !== clickedAnchor) || seen.has(item.key)) {
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
