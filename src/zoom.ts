import { MAX_ZOOM, MIN_ZOOM, WHEEL_ZOOM_SPEED } from "./constants";

export type Size = {
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type PanZoom = {
  zoom: number;
  panX: number;
  panY: number;
};

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 100) / 100));
}

export function wheelFactor(event: WheelEvent, viewportHeight: number): number {
  let delta = event.deltaY;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= 16;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= viewportHeight || window.innerHeight;
  }

  return Math.exp(-delta * WHEEL_ZOOM_SPEED);
}

export function clampPan(pan: Point, baseSize: Size, viewportSize: Size, zoom: number): Point {
  if (zoom <= MIN_ZOOM) {
    return { x: 0, y: 0 };
  }

  const scaledWidth = baseSize.width * zoom;
  const scaledHeight = baseSize.height * zoom;
  const maxX = scaledWidth > viewportSize.width ? (scaledWidth - viewportSize.width) / 2 : 0;
  const maxY = scaledHeight > viewportSize.height ? (scaledHeight - viewportSize.height) / 2 : 0;

  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export function zoomAroundPoint(
  current: PanZoom,
  nextZoomValue: number,
  point: Point,
  viewportSize: Size,
  baseSize: Size
): PanZoom {
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
    y: viewportSize.height / 2,
  };
  const imagePoint = {
    x: (point.x - center.x - current.panX) / oldZoom,
    y: (point.y - center.y - current.panY) / oldZoom,
  };
  const unclampedPan = {
    x: point.x - center.x - imagePoint.x * nextZoom,
    y: point.y - center.y - imagePoint.y * nextZoom,
  };
  const clampedPan = clampPan(unclampedPan, baseSize, viewportSize, nextZoom);

  return {
    zoom: nextZoom,
    panX: clampedPan.x,
    panY: clampedPan.y,
  };
}
