const target = await fetch(
  "http://127.0.0.1:9222/json/new?http://127.0.0.1:8765/map-test/",
  { method: "PUT" }
).then((response) => response.json());

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1800));

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
};

const initial = await evaluate(`({
  cityHitAreas: document.querySelectorAll("[data-map-region]").length,
  regionLabels: document.querySelectorAll("[data-map-region-label]").length,
  regionNameVariants: document.querySelectorAll(".map-label-variant.is-region-name").length,
  municipalityVariants: document.querySelectorAll(".map-label-variant.is-municipality-names").length,
  regionOutlines: document.querySelectorAll("[data-map-region-outline]").length,
  viewportWidth: innerWidth,
  pageWidth: document.documentElement.scrollWidth,
  mapWidth: Math.round(document.querySelector("[data-area-map]").getBoundingClientRect().width),
  integratedZoomButtons: document.querySelectorAll(".map-function-controls .area-map-zoom-controls button").length,
  prefectureOutlinePaths: document.querySelectorAll(".map-prefecture-outline-shape").length,
  controlsRect: (() => {
    const rect = document.querySelector(".map-function-controls").getBoundingClientRect();
    return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
  })()
})`);

const clickResult = await evaluate(`(() => {
  document.querySelector('[data-map-region="katsunan"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  );
  return {
    activeCities: document.querySelectorAll('[data-map-region="katsunan"].is-group-active').length,
    activeOutline: document.querySelector('[data-map-region-outline="katsunan"]').classList.contains("is-group-active"),
    activeLabel: document.querySelector('[data-map-region-label="katsunan"]').classList.contains("is-group-active"),
    previewVisible: !document.querySelector("[data-area-selection-preview]").hidden,
    previewText: document.querySelector("[data-area-selection-preview]").innerText
  };
})()`);

await send("Emulation.setDeviceMetricsOverride", {
  width: 1200,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1200));

const hoverResult = await evaluate(`(() => {
  document.querySelector('[data-map-region="katori"]').dispatchEvent(
    new PointerEvent("pointerenter", { bubbles: false })
  );
  return {
    activeCities: document.querySelectorAll('[data-map-region="katori"].is-group-active').length,
    activeOutline: document.querySelector('[data-map-region-outline="katori"]').classList.contains("is-group-active"),
    status: document.querySelector("[data-area-map-status]").textContent
  };
})()`);

const desktopClickResult = await evaluate(`(() => {
  document.querySelector('[data-map-region="higashikatsushika"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  );
  const preview = document.querySelector("[data-area-selection-preview]");
  const style = getComputedStyle(preview);
  return {
    visible: !preview.hidden,
    position: style.position,
    containsMunicipalityNames: preview.innerText.includes("柏市") && preview.innerText.includes("我孫子市") && preview.innerText.includes("松戸市")
  };
})()`);

await evaluate(`document.querySelector("[data-area-map]").dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true })
)`);
const realClickPoint = await evaluate(`(() => {
  const rect = document.querySelector(
    '[data-map-region="higashikatsushika"] .area-region-shape'
  ).getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
})()`);
await send("Input.dispatchMouseEvent", {
  type: "mouseMoved",
  x: realClickPoint.x,
  y: realClickPoint.y,
});
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: realClickPoint.x,
  y: realClickPoint.y,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: realClickPoint.x,
  y: realClickPoint.y,
  button: "left",
  clickCount: 1,
});
const realDesktopClickResult = await evaluate(`(() => {
  const preview = document.querySelector("[data-area-selection-preview]");
  return {
    visible: !preview.hidden,
    containsMunicipalityNames: preview.innerText.includes("柏市") && preview.innerText.includes("我孫子市") && preview.innerText.includes("松戸市")
  };
})()`);
await evaluate(`document.querySelector('[data-map-region="higashikatsushika"]').dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true })
)`);
await new Promise((resolve) => setTimeout(resolve, 450));
const desktopAutoFocusResult = await evaluate(`(() => {
  const svg = document.querySelector(".chiba-area-map");
  const selected = document.querySelector('[data-map-region="higashikatsushika"].is-group-active');
  const preview = document.querySelector("[data-area-selection-preview]");
  const selectedRect = selected.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  return {
    viewBox: svg.getAttribute("viewBox"),
    movedFromDefault: svg.getAttribute("viewBox") !== "0 0 720 900",
    selectedCenterX: Math.round(selectedRect.left + selectedRect.width / 2),
    previewLeft: Math.round(previewRect.left),
    selectedIsLeftOfCard: selectedRect.left + selectedRect.width / 2 < previewRect.left
  };
})()`);
const desktopAutoFocusScreenshot = await send("Page.captureScreenshot", { format: "png" });
const desktopAutoFocusScreenshotPath = path.join(tmpdir(), "map-test-auto-focus-desktop.png");
await writeFile(desktopAutoFocusScreenshotPath, Buffer.from(desktopAutoFocusScreenshot.data, "base64"));
await evaluate(`(() => {
  const control = document.querySelector('input[name="map-view-mode"][value="municipalities"]');
  control.checked = true;
  control.dispatchEvent(new Event("change", { bubbles: true }));
})()`);
const desktopCityScreenshot = await send("Page.captureScreenshot", { format: "png" });
const desktopCityScreenshotPath = path.join(tmpdir(), "map-test-city-mode-desktop.png");
await writeFile(desktopCityScreenshotPath, Buffer.from(desktopCityScreenshot.data, "base64"));

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1200));
await evaluate(`document.querySelector('[data-map-region="awa"]').dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true })
)`);
await new Promise((resolve) => setTimeout(resolve, 450));
const mobileAutoFocusResult = await evaluate(`(() => {
  const svg = document.querySelector(".chiba-area-map");
  const selected = document.querySelector('[data-map-region="awa"].is-group-active');
  const preview = document.querySelector("[data-area-selection-preview]");
  const selectedRect = selected.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  return {
    viewBox: svg.getAttribute("viewBox"),
    movedFromDefault: svg.getAttribute("viewBox") !== "0 0 720 900",
    selectedCenterY: Math.round(selectedRect.top + selectedRect.height / 2),
    previewTop: Math.round(previewRect.top),
    selectedIsAboveCard: selectedRect.top + selectedRect.height / 2 < previewRect.top
  };
})()`);
const mobileAutoFocusScreenshot = await send("Page.captureScreenshot", { format: "png" });
const mobileAutoFocusScreenshotPath = path.join(tmpdir(), "map-test-auto-focus-mobile.png");
await writeFile(mobileAutoFocusScreenshotPath, Buffer.from(mobileAutoFocusScreenshot.data, "base64"));
const labelModeResult = await evaluate(`(() => {
  const control = document.querySelector('input[name="map-view-mode"][value="municipalities"]');
  control.checked = true;
  control.dispatchEvent(new Event("change", { bubbles: true }));
  const map = document.querySelector("[data-area-map]");
  return {
    mode: map.dataset.mapViewMode,
    groupedLabelsDisplay: getComputedStyle(map.querySelector(".map-region-labels")).display,
    cityLabelsDisplay: getComputedStyle(map.querySelector(".major-city-labels")).display,
    cityLabelFontSize: getComputedStyle(map.querySelector(".major-city-label text")).fontSize
  };
})()`);
const cityModeScreenshot = await send("Page.captureScreenshot", { format: "png" });
const cityModeScreenshotPath = path.join(tmpdir(), "map-test-city-mode-mobile.png");
await writeFile(cityModeScreenshotPath, Buffer.from(cityModeScreenshot.data, "base64"));
await evaluate(`document.querySelector('[data-area-link="kashiwa"]').dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true })
)`);
const municipalityClickResult = await evaluate(`(() => {
  const preview = document.querySelector("[data-area-selection-preview]");
  return {
    visible: !preview.hidden,
    text: preview.innerText,
    onlyKashiwaSelected: document.querySelectorAll(".is-mobile-selected").length === 1
      && document.querySelector('[data-area-link="kashiwa"]').classList.contains("is-mobile-selected")
  };
})()`);
await evaluate(`document.querySelector('[data-area-link="tateyama"]').dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true })
)`);
await new Promise((resolve) => setTimeout(resolve, 450));
const municipalityAutoFocusResult = await evaluate(`(() => {
  const selected = document.querySelector('[data-area-link="tateyama"].is-mobile-selected');
  const preview = document.querySelector("[data-area-selection-preview]");
  const selectedRect = selected.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  return {
    viewBox: document.querySelector(".chiba-area-map").getAttribute("viewBox"),
    selectedCenterY: Math.round(selectedRect.top + selectedRect.height / 2),
    previewTop: Math.round(previewRect.top),
    selectedIsAboveCard: selectedRect.top + selectedRect.height / 2 < previewRect.top,
    cardShowsTateyama: preview.innerText.includes("館山市")
  };
})()`);

const listedOnlyResult = await evaluate(`(() => {
  const toggle = document.querySelector(".map-function-controls [data-listed-only-toggle]");
  toggle.checked = true;
  toggle.dispatchEvent(new Event("change", { bubbles: true }));
  return {
    mapEnabled: document.querySelector("[data-area-map]").classList.contains("is-listed-only"),
    hiddenMapCities: [...document.querySelectorAll("[data-area-map] .area-region.no-stores")]
      .filter((item) => getComputedStyle(item).display === "none").length,
    grayMapCities: [...document.querySelectorAll("[data-area-map] .area-region.no-stores .area-region-shape")]
      .filter((item) => getComputedStyle(item).fill === "rgb(217, 222, 220)").length,
    firstUnlistedFill: getComputedStyle(
      document.querySelector("[data-area-map] .area-region.no-stores .area-region-shape")
    ).fill,
    graySelectorMatches: document.querySelector(
      "[data-area-map] .area-region.no-stores .area-region-shape"
    ).matches(".is-listed-only .area-region.no-stores .area-region-shape"),
    firstUnlistedFilter: getComputedStyle(
      document.querySelector("[data-area-map] .area-region.no-stores .area-region-shape")
    ).filter,
    hiddenUnlistedLabels: [...document.querySelectorAll("[data-area-map] .major-city-label.is-filter-hidden")]
      .filter((item) => getComputedStyle(item).display === "none").length,
    prefectureOutlineVisible: getComputedStyle(document.querySelector(".map-prefecture-outline")).display !== "none",
    visibleListedButtons: [...document.querySelectorAll("[data-area-list] .area-list-button.has-stores")]
      .filter((item) => getComputedStyle(item).display !== "none").length,
    hiddenUnlistedButtons: [...document.querySelectorAll("[data-area-list] .area-list-button:not(.has-stores)")]
      .filter((item) => getComputedStyle(item).display === "none").length
  };
})()`);

const zoomResult = await evaluate(`(() => {
  const svg = document.querySelector(".chiba-area-map");
  const before = svg.getAttribute("viewBox");
  document.querySelector("[data-map-zoom-in]").click();
  const after = svg.getAttribute("viewBox");
  return {
    changedViewBox: before !== after,
    before,
    after,
    cssTransform: svg.style.transform,
    zoomedClass: document.querySelector("[data-area-map]").classList.contains("is-map-zoomed")
  };
})()`);

const listedOnlyScreenshot = await send("Page.captureScreenshot", { format: "png" });
const listedOnlyScreenshotPath = path.join(tmpdir(), "map-test-listed-only-mobile.png");
await writeFile(listedOnlyScreenshotPath, Buffer.from(listedOnlyScreenshot.data, "base64"));

const screenshot = await send("Page.captureScreenshot", { format: "png" });
const screenshotPath = path.join(tmpdir(), "map-test-cdp-mobile.png");
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

console.log(JSON.stringify({
  initial,
  clickResult,
  hoverResult,
  desktopClickResult,
  realDesktopClickResult,
  desktopAutoFocusResult,
  desktopAutoFocusScreenshotPath,
  desktopCityScreenshotPath,
  mobileAutoFocusResult,
  mobileAutoFocusScreenshotPath,
  labelModeResult,
  municipalityClickResult,
  municipalityAutoFocusResult,
  listedOnlyResult,
  zoomResult,
  cityModeScreenshotPath,
  listedOnlyScreenshotPath,
  screenshotPath
}, null, 2));
socket.close();
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
