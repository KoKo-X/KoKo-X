const pages = [
  "http://127.0.0.1:8765/",
  "http://127.0.0.1:8765/chiba/",
];

const openTab = async (url) => fetch(
  `http://127.0.0.1:9222/json/new?${url}`,
  { method: "PUT" }
).then((response) => response.json());

const verifyPage = async (url) => {
  const target = await openTab(url);
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

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const result = await evaluate(`(async () => {
    const cityMode = document.querySelector('input[name="map-view-mode"][value="municipalities"]');
    if (cityMode && !cityMode.checked) {
      cityMode.checked = true;
      cityMode.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.querySelector('[data-area-map] [data-area-link="kashiwa"]').dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 220));
    const selectedMapItem = document.querySelector('[data-area-map] [data-area-link="kashiwa"].is-mobile-selected');
    const selectedListItem = document.querySelector('[data-area-list] [data-area-link="kashiwa"].is-mobile-selected');
    const selectedShape = selectedMapItem?.querySelector(".area-region-shape");
    const preview = document.querySelector("[data-area-selection-preview]");
    return {
      url: location.pathname,
      mode: document.querySelector("[data-area-map]")?.dataset.mapViewMode || "",
      selectedMapItem: Boolean(selectedMapItem),
      selectedListItem: Boolean(selectedListItem),
      selectedFill: selectedShape ? getComputedStyle(selectedShape).fill : "",
      selectedStroke: selectedShape ? getComputedStyle(selectedShape).stroke : "",
      previewVisible: preview ? !preview.hidden : false,
      ctaText: preview?.querySelector(".area-preview-actions .button.primary")?.textContent.trim() || "",
      ctaHref: preview?.querySelector(".area-preview-actions .button.primary")?.getAttribute("href") || "",
      embeddedSvgStyles: document.querySelectorAll(".chiba-area-map style").length
    };
  })()`);
  socket.close();
  return result;
};

const verifyRegionSearch = async () => {
  const target = await openTab("http://127.0.0.1:8765/search/?region=higashikatsushika");
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

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const result = await evaluate(`({
    title: document.querySelector("[data-search-title]")?.textContent.trim() || "",
    count: document.querySelector("[data-search-count]")?.textContent.trim() || "",
    cards: document.querySelectorAll("[data-search-results] .store-card").length,
    includesAbiko: document.body.innerText.includes("我孫子市"),
    includesKashiwa: document.body.innerText.includes("柏市"),
    includesMatsudo: document.body.innerText.includes("松戸市")
  })`);
  socket.close();
  return result;
};

const verifyRegionPage = async () => {
  const target = await openTab("http://127.0.0.1:8765/chiba/regions/higashikatsushika/");
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

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const result = await evaluate(`({
    title: document.querySelector("h1")?.textContent.trim() || "",
    count: document.querySelector("[data-region-page-count]")?.textContent.trim() || "",
    cards: document.querySelectorAll("[data-region-page-stores] .store-card").length,
    areaLinks: document.querySelectorAll("[data-region-areas] .neighbor-link").length,
    neighborLinks: document.querySelectorAll("[data-region-neighbors] .neighbor-link").length,
    areaHrefOk: [...document.querySelectorAll("[data-region-areas] .neighbor-link")]
      .every((link) => link.getAttribute("href")?.includes("/chiba/")),
    neighborHrefOk: [...document.querySelectorAll("[data-region-neighbors] .neighbor-link")]
      .every((link) => link.getAttribute("href")?.includes("/chiba/regions/"))
  })`);
  socket.close();
  return result;
};

const results = [];
for (const page of pages) {
  results.push(await verifyPage(page));
}
const regionSearchResult = await verifyRegionSearch();
const regionPageResult = await verifyRegionPage();

console.log(JSON.stringify({ results, regionSearchResult, regionPageResult }, null, 2));
if (results.some((result) =>
  result.mode !== "municipalities"
  || !result.selectedMapItem
  || !result.selectedListItem
  || result.selectedFill !== "rgb(12, 117, 74)"
  || result.selectedStroke !== "rgb(5, 62, 40)"
  || !result.previewVisible
  || result.ctaText !== "この市区町村の掲載店舗へ"
  || !result.ctaHref.includes("/chiba/kashiwa/")
  || result.embeddedSvgStyles !== 0
)
  || regionSearchResult.title !== "東葛飾地域の掲載店舗"
  || regionSearchResult.count !== "3件"
  || regionSearchResult.cards !== 3
  || !regionSearchResult.includesAbiko
  || !regionSearchResult.includesKashiwa
  || !regionSearchResult.includesMatsudo
  || regionPageResult.title !== "東葛飾地域のお店案内"
  || regionPageResult.count !== "3件"
  || regionPageResult.cards !== 3
  || regionPageResult.areaLinks !== 6
  || regionPageResult.neighborLinks !== 4
  || !regionPageResult.areaHrefOk
  || !regionPageResult.neighborHrefOk
) {
  process.exitCode = 1;
}
