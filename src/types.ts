export type LightboxItem = {
  key: string;
  href: string;
  src: string;
  title: string;
  fileName: string;
  anchor: HTMLAnchorElement;
  groupElement: Element;
  groupKey: string;
  groupLabel: string;
  postedText: string;
  groupIndex: number;
  groupItemIndex: number;
  groupItemCount: number;
};

export type LightboxGroup = {
  key: string;
  label: string;
  element: Element;
  items: LightboxItem[];
};

export type LightboxNodes = {
  viewport: HTMLElement;
  stage: HTMLElement;
  image: HTMLImageElement;
  caption: HTMLElement;
  status: HTMLElement;
  counter: HTMLElement;
  sectionCounter: HTMLElement;
  fileName: HTMLElement;
  meta: HTMLElement;
  sectionSummary: HTMLElement;
  zoomLevel: HTMLElement;
  zoomOut: HTMLButtonElement;
  zoomReset: HTMLButtonElement;
  zoomIn: HTMLButtonElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  previousGroup: HTMLButtonElement;
  nextGroup: HTMLButtonElement;
  close: HTMLButtonElement;
};

export type LightboxState = {
  root: HTMLElement | null;
  nodes: LightboxNodes | null;
  items: LightboxItem[];
  groups: LightboxGroup[];
  index: number;
  zoom: number;
  panX: number;
  panY: number;
  lastFocus: Element | null;
  lastGroupKey: string | null;
  htmlOverflow: string;
  bodyOverflow: string;
  touchStartX: number;
  touchStartY: number;
  isPanning: boolean;
  didPan: boolean;
  panStartX: number;
  panStartY: number;
  panOriginX: number;
  panOriginY: number;
};

export type GroupableElement = Element & {
  __ghslbGroupId?: string;
};

declare global {
  interface Window {
    __githubScreenshotLightboxLoaded?: boolean;
  }
}
