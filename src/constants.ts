export const ROOT_ID = "gh-screenshot-lightbox-root";
export const STYLE_ID = "gh-screenshot-lightbox-style";
export const IMAGE_EXTENSIONS = /\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const WHEEL_ZOOM_SPEED = 0.0024;
export const DRAG_THRESHOLD = 3;

export const GROUP_SELECTORS = [
  ".js-comment-container",
  ".timeline-comment-group",
  ".timeline-comment",
  ".TimelineItem",
  "[id^='issuecomment-']",
  "[id^='pullrequestreview-']",
  "[data-ghslb-group]",
  "article",
  "section",
  ".comment",
].join(", ");
