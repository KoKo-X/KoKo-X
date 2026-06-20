import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, "..");
const sourcePath = path.join(rootDir, "source-data", "N03-20240101_12.geojson");
const outputPath = path.join(rootDir, "assets", "maps", "chiba.svg");
const width = 720;
const height = 900;
const padding = 22;
const simplifyTolerance = 0.55;
const minimumVisibleArea = 0.08;
const preferredLabelOffsets = new Map([
  ["chiba", { dx: -94, dy: 18, external: true }],
  ["funabashi", { dx: -70, dy: 10, external: true }],
  ["matsudo", { dx: -7, dy: 0 }],
  ["kashiwa", { dx: 8, dy: -2 }],
  ["narita", { dx: 7, dy: 0 }],
  ["ichihara", { dx: -75, dy: 10, external: true }],
  ["kisarazu", { dx: -72, dy: 8, external: true }],
  ["choshi", { dx: 42, dy: 0, external: true }],
  ["mobara", { dx: 5, dy: 3 }],
  ["tateyama", { dx: -48, dy: 8, external: true }],
  ["minamiboso", { dx: -76, dy: 2, external: true }],
]);
const coastalAreaIds = new Set([
  "ichikawa", "funabashi", "urayasu", "narashino", "chiba", "choshi",
  "asahi", "sosa", "yokoshibahikari", "sanmu", "kujukuri",
  "oamishirasato", "shirako", "chosei", "ichinomiya", "isumi",
  "onjuku", "katsuura", "kamogawa", "minamiboso", "tateyama",
  "kyonan", "futtsu", "kimitsu", "kisarazu", "sodegaura", "ichihara",
]);

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const escapeXml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const squaredDistance = (a, b) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};

const squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const ratio = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
};

const simplifyDouglasPeucker = (points, squaredTolerance) => {
  if (points.length <= 2) return points;
  const markers = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = 0;
    for (let cursor = first + 1; cursor < last; cursor += 1) {
      const distance = squaredSegmentDistance(points[cursor], points[first], points[last]);
      if (distance > maxDistance) {
        index = cursor;
        maxDistance = distance;
      }
    }
    if (maxDistance > squaredTolerance) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, index) => markers[index]);
};

const ringArc = (ring, start, end) => {
  const result = [ring[start]];
  let index = start;
  while (index !== end) {
    index = (index + 1) % ring.length;
    result.push(ring[index]);
  }
  return result;
};

const simplifyClosedRing = (sourceRing, tolerance) => {
  const ring = sourceRing.slice();
  if (ring.length > 1 && squaredDistance(ring[0], ring.at(-1)) < 1e-12) ring.pop();
  if (ring.length <= 5) return ring;

  let left = 0;
  let right = 0;
  for (let index = 1; index < ring.length; index += 1) {
    if (ring[index][0] < ring[left][0]) left = index;
    if (ring[index][0] > ring[right][0]) right = index;
  }
  if (left === right) {
    for (let index = 1; index < ring.length; index += 1) {
      if (ring[index][1] < ring[left][1]) left = index;
      if (ring[index][1] > ring[right][1]) right = index;
    }
  }

  const squaredTolerance = tolerance * tolerance;
  const firstArc = simplifyDouglasPeucker(ringArc(ring, left, right), squaredTolerance);
  const secondArc = simplifyDouglasPeucker(ringArc(ring, right, left), squaredTolerance);
  const simplified = firstArc.slice(0, -1).concat(secondArc.slice(0, -1));
  return simplified.length >= 3 ? simplified : ring;
};

const signedArea = (ring) => {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
};

const ringCentroid = (ring) => {
  let crossSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const cross = current[0] * next[1] - next[0] * current[1];
    crossSum += cross;
    xSum += (current[0] + next[0]) * cross;
    ySum += (current[1] + next[1]) * cross;
  }
  if (Math.abs(crossSum) < 1e-8) {
    return [
      ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
      ring.reduce((sum, point) => sum + point[1], 0) / ring.length,
    ];
  }
  return [xSum / (3 * crossSum), ySum / (3 * crossSum)];
};

const shortAreaName = (name) => name.replace(/[市町村]$/, "");

const labelBox = (x, y, labelWidth) => ({
  left: x - labelWidth / 2 - 2,
  right: x + labelWidth / 2 + 2,
  top: y - 10,
  bottom: y + 10,
});

const boxesOverlap = (first, second) =>
  first.left < second.right
  && first.right > second.left
  && first.top < second.bottom
  && first.bottom > second.top;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const createCandidateOffsets = (preferredAngle = 0) => {
  const candidates = [[0, 0]];
  for (let radius = 16; radius <= 132; radius += 12) {
    for (let step = 0; step < 16; step += 1) {
      const angle = preferredAngle + (step % 2 ? -1 : 1) * Math.ceil(step / 2) * Math.PI / 8;
      candidates.push([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ]);
    }
  }
  return candidates;
};

const ringToPath = (ring) => {
  if (ring.length < 3) return "";
  return `${ring.map((point, index) =>
    `${index ? "L" : "M"}${point[0].toFixed(2)} ${point[1].toFixed(2)}`
  ).join("")}Z`;
};

const geojson = await readJson(sourcePath);
const areas = await readJson(path.join(rootDir, "data", "areas.json"));
const stores = await readJson(path.join(rootDir, "data", "stores.json"));
const areaByName = new Map(areas.map((area) => [area.name, area]));
const groupedPolygons = new Map(areas.map((area) => [area.id, []]));

for (const feature of geojson.features) {
  const municipalityName = feature.properties?.N03_004;
  const area = areaByName.get(municipalityName);
  if (!area || feature.geometry?.type !== "Polygon") continue;
  groupedPolygons.get(area.id).push(feature.geometry.coordinates);
}

const missingAreas = areas.filter((area) => !groupedPolygons.get(area.id)?.length);
if (missingAreas.length) {
  throw new Error(`行政区域データに見つからない市町村: ${missingAreas.map((area) => area.name).join("、")}`);
}

let minLongitude = Infinity;
let minLatitude = Infinity;
let maxLongitude = -Infinity;
let maxLatitude = -Infinity;
for (const polygons of groupedPolygons.values()) {
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        minLongitude = Math.min(minLongitude, longitude);
        minLatitude = Math.min(minLatitude, latitude);
        maxLongitude = Math.max(maxLongitude, longitude);
        maxLatitude = Math.max(maxLatitude, latitude);
      }
    }
  }
}

const averageLatitude = (minLatitude + maxLatitude) / 2;
const longitudeScale = Math.cos(averageLatitude * Math.PI / 180);
const geographicWidth = (maxLongitude - minLongitude) * longitudeScale;
const geographicHeight = maxLatitude - minLatitude;
const scale = Math.min(
  (width - padding * 2) / geographicWidth,
  (height - padding * 2) / geographicHeight
);
const renderedWidth = geographicWidth * scale;
const renderedHeight = geographicHeight * scale;
const offsetX = (width - renderedWidth) / 2;
const offsetY = (height - renderedHeight) / 2;

const project = ([longitude, latitude]) => [
  offsetX + (longitude - minLongitude) * longitudeScale * scale,
  offsetY + (maxLatitude - latitude) * scale,
];

const storeCounts = new Map(areas.map((area) => [
  area.id,
  stores.filter((store) => store.areaId === area.id).length,
]));

let sourceRingCount = 0;
let renderedRingCount = 0;
let sourcePointCount = 0;
let renderedPointCount = 0;
const labelPositions = new Map();

const municipalityMarkup = areas.map((area) => {
  const projectedPolygons = groupedPolygons.get(area.id).map((polygon) =>
    polygon.map((ring) => {
      sourceRingCount += 1;
      sourcePointCount += ring.length;
      return ring.map(project);
    })
  );
  const largestOuterArea = Math.max(...projectedPolygons.map((polygon) => Math.abs(signedArea(polygon[0]))));
  const largestPolygon = projectedPolygons.find(
    (polygon) => Math.abs(signedArea(polygon[0])) === largestOuterArea
  );
  const [centerX, centerY] = ringCentroid(largestPolygon[0]);
  const outerRing = largestPolygon[0];
  const minX = Math.min(...outerRing.map((point) => point[0]));
  const maxX = Math.max(...outerRing.map((point) => point[0]));
  const minY = Math.min(...outerRing.map((point) => point[1]));
  const maxY = Math.max(...outerRing.map((point) => point[1]));
  labelPositions.set(area.id, {
    name: shortAreaName(area.name),
    anchorX: centerX,
    anchorY: centerY,
    areaSize: largestOuterArea,
    bounds: { minX, maxX, minY, maxY },
  });
  const paths = [];

  for (const polygon of projectedPolygons) {
    const outerArea = Math.abs(signedArea(polygon[0]));
    if (outerArea < minimumVisibleArea && outerArea !== largestOuterArea) continue;
    for (const ring of polygon) {
      const simplified = simplifyClosedRing(ring, simplifyTolerance);
      if (Math.abs(signedArea(simplified)) < minimumVisibleArea && outerArea !== largestOuterArea) continue;
      renderedRingCount += 1;
      renderedPointCount += simplified.length;
      paths.push(ringToPath(simplified));
    }
  }

  const count = storeCounts.get(area.id) || 0;
  const label = `${area.name}、${count ? `掲載${count}件` : "掲載準備中"}`;
  const classes = `area-region${count ? " has-stores" : " no-stores"}`;
  return `    <a class="${classes}" data-area-link="${escapeXml(area.id)}" href="/chiba/${escapeXml(area.id)}/" aria-label="${escapeXml(label)}">
      <title>${escapeXml(label)}</title>
      <path id="area-${escapeXml(area.id)}" class="area-region-shape" data-area-id="${escapeXml(area.id)}" d="${paths.join("")}" fill-rule="evenodd" vector-effect="non-scaling-stroke"/>
    </a>`;
}).join("\n");

const acceptedLabelBoxes = [];
const visibleLabels = [];
const placementOrder = [
  ...preferredLabelOffsets.keys(),
  ...areas
    .filter((area) => !preferredLabelOffsets.has(area.id))
    .sort((first, second) =>
      labelPositions.get(second.id).areaSize - labelPositions.get(first.id).areaSize
    )
    .map((area) => area.id),
];

for (const areaId of placementOrder) {
  const label = labelPositions.get(areaId);
  if (!label) continue;
  const labelWidth = Math.max(25, label.name.length * 8.5 + 10);
  const preferred = preferredLabelOffsets.get(areaId);
  const isCoastal = coastalAreaIds.has(areaId);
  const mapCenterX = width / 2;
  const mapCenterY = height / 2;
  const radialAngle = Math.atan2(label.anchorY - mapCenterY, label.anchorX - mapCenterX);
  const baseDistance = isCoastal ? 34 : 0;
  const desiredX = preferred
    ? label.anchorX + preferred.dx
    : label.anchorX + Math.cos(radialAngle) * baseDistance;
  const desiredY = preferred
    ? label.anchorY + preferred.dy
    : label.anchorY + Math.sin(radialAngle) * baseDistance;
  const preferredAngle = isCoastal ? radialAngle : -Math.PI / 2;
  const candidates = createCandidateOffsets(preferredAngle);
  let placement;

  for (const [offsetX, offsetY] of candidates) {
    const x = clamp(desiredX + offsetX, labelWidth / 2 + 4, width - labelWidth / 2 - 4);
    const y = clamp(desiredY + offsetY, 12, height - 12);
    const box = labelBox(x, y, labelWidth);
    if (acceptedLabelBoxes.some((accepted) => boxesOverlap(box, accepted))) continue;
    placement = { x, y, box };
    break;
  }

  if (!placement) {
    const row = visibleLabels.length % 27;
    const side = visibleLabels.length % 2;
    const x = side ? width - labelWidth / 2 - 4 : labelWidth / 2 + 4;
    const y = clamp(18 + row * 32, 12, height - 12);
    placement = { x, y, box: labelBox(x, y, labelWidth) };
  }

  acceptedLabelBoxes.push(placement.box);
  const distanceFromAnchor = Math.hypot(
    placement.x - label.anchorX,
    placement.y - label.anchorY
  );
  visibleLabels.push({
    areaId,
    label: {
      ...label,
      x: placement.x,
      y: placement.y,
      external: Boolean(preferred?.external) || isCoastal || distanceFromAnchor > 14,
    },
    labelWidth,
  });
}

const labelMarkup = visibleLabels.map(({ areaId, label, labelWidth }) =>
  `${label.external ? `    <path class="major-city-leader" d="M${label.anchorX.toFixed(2)} ${label.anchorY.toFixed(2)} L${label.x.toFixed(2)} ${label.y.toFixed(2)}"/>
    <circle class="major-city-anchor" cx="${label.anchorX.toFixed(2)}" cy="${label.anchorY.toFixed(2)}" r="2.2"/>` : ""}
    <g class="major-city-label${label.external ? " is-external" : ""}" data-label-area="${escapeXml(areaId)}" transform="translate(${label.x.toFixed(2)} ${label.y.toFixed(2)})">
      <rect x="${(-labelWidth / 2).toFixed(1)}" y="-10" width="${labelWidth.toFixed(1)}" height="20" rx="6"/>
      <text x="0" y="4">${escapeXml(label.name)}</text>
    </g>`
).join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="chiba-area-map" role="img" aria-labelledby="chiba-map-title chiba-map-desc">
  <title id="chiba-map-title">千葉県の市町村境界マップ</title>
  <desc id="chiba-map-desc">国土数値情報の行政区域データを加工した地図です。市町村を選ぶと案内ページへ移動します。</desc>
  <metadata>出典：国土交通省 国土数値情報（行政区域データ）を加工して作成</metadata>
  <style>
    .area-region { cursor: pointer; outline: none; }
    .area-region-shape { fill: #e7f2ed; stroke: #527064; stroke-width: 0.8; stroke-linejoin: round; transition: fill 150ms ease, stroke 150ms ease; }
    .area-region.has-stores .area-region-shape { fill: #75d5aa; stroke: #0b7d4d; stroke-width: 1.6; }
    .area-region:hover .area-region-shape, .area-region:focus .area-region-shape { fill: #a7e3c7; stroke: #0b8051; stroke-width: 1.8; }
    .area-region.is-active .area-region-shape { fill: #118d5b; stroke: #075d3a; stroke-width: 2.2; }
    .area-region.is-linked-highlight .area-region-shape { fill: #a7e3c7; stroke: #0b8051; stroke-width: 1.8; }
    .area-region.is-mobile-selected .area-region-shape { fill: #0c754a; stroke: #053e28; stroke-width: 2.6; }
    .major-city-label { pointer-events: none; }
    .major-city-leader { fill: none; stroke: rgba(35, 79, 63, 0.72); stroke-width: 0.9; vector-effect: non-scaling-stroke; pointer-events: none; }
    .major-city-anchor { fill: #315f50; stroke: #fff; stroke-width: 0.8; vector-effect: non-scaling-stroke; pointer-events: none; }
    .major-city-label rect { fill: rgba(255, 255, 255, 0.9); stroke: rgba(42, 84, 69, 0.34); stroke-width: 0.65; vector-effect: non-scaling-stroke; }
    .major-city-label text { fill: #173d31; font-family: sans-serif; font-size: 9px; font-weight: 700; text-anchor: middle; }
  </style>
  <g class="area-map-regions">
${municipalityMarkup}
  </g>
  <g class="major-city-labels" aria-hidden="true">
${labelMarkup}
  </g>
</svg>
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(JSON.stringify({
  source: path.relative(rootDir, sourcePath),
  output: path.relative(rootDir, outputPath),
  municipalities: areas.length,
  municipalityLabels: visibleLabels.length,
  sourceRings: sourceRingCount,
  renderedRings: renderedRingCount,
  sourcePoints: sourcePointCount,
  renderedPoints: renderedPointCount,
  reductionPercent: Number((100 - renderedPointCount / sourcePointCount * 100).toFixed(1)),
}, null, 2));
