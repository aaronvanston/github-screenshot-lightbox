const paths: Record<string, string> = {
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  previous: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  sectionPrevious: '<path d="m12 19-7-7 7-7"/><path d="M19 5v14"/>',
  sectionNext: '<path d="m12 5 7 7-7 7"/><path d="M5 5v14"/>',
  zoomIn: '<circle cx="11" cy="11" r="6"/><path d="M11 8v6M8 11h6M16 16l4 4"/>',
  zoomOut: '<circle cx="11" cy="11" r="6"/><path d="M8 11h6M16 16l4 4"/>',
  resetZoom: '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M5 5l5 5"/><path d="m14 14 5 5"/>',
};

export function icon(name: string): string {
  return (
    '<svg class="ghslb-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    (paths[name] || "") +
    "</svg>"
  );
}

export function buttonHtml(className: string, action: string, label: string, iconName: string): string {
  return (
    '<button class="' +
    className +
    '" type="button" data-ghslb-action="' +
    action +
    '" aria-label="' +
    label +
    '" title="' +
    label +
    '">' +
    icon(iconName) +
    "</button>"
  );
}
