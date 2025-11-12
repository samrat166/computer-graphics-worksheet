function makeSquare(px, py, color, toClipSpace, size = 6) {
  const [x0, y0] = toClipSpace(px - size / 2, py - size / 2);
  const [x1, y1] = toClipSpace(px + size / 2, py - size / 2);
  const [x2, y2] = toClipSpace(px - size / 2, py + size / 2);
  const [x3, y3] = toClipSpace(px + size / 2, py + size / 2);
  const [r, g, b, a] = color;
  return [
    x0,
    y0,
    r,
    g,
    b,
    a,
    x1,
    y1,
    r,
    g,
    b,
    a,
    x2,
    y2,
    r,
    g,
    b,
    a,
    x1,
    y1,
    r,
    g,
    b,
    a,
    x3,
    y3,
    r,
    g,
    b,
    a,
    x2,
    y2,
    r,
    g,
    b,
    a,
  ];
}
