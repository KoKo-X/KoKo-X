const siteRootUrl = new URL("./", document.currentScript.src);

const siteUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|tel:|mailto:)/.test(path)) return path;
  return new URL(path.replace(/^\//, ""), siteRootUrl).href;
};

const DATA_PATHS = {
  stores: siteUrl("data/stores.json"),
  categories: siteUrl("data/categories.json"),
  areas: siteUrl("data/areas.json"),
  chibaMap: siteUrl("maps/chiba.svg?v=isolated-1"),
};

const state = {
  stores: [],
  categories: [],
  areas: [],
};

const MAP_REGION_GROUPS = [
  { id: "chiba", name: "千葉", reading: "ちば", labelX: 228, labelY: 447, municipalityX: 160, municipalityY: 450, areas: ["chiba", "ichihara"] },
  { id: "katsunan", name: "葛南", reading: "かつなん", labelX: 156, labelY: 319, municipalityX: 62, municipalityY: 355, areas: ["ichikawa", "funabashi", "narashino", "yachiyo", "urayasu"] },
  { id: "higashikatsushika", name: "東葛飾", reading: "ひがしかつしか", labelX: 169, labelY: 210, municipalityX: 108, municipalityY: 128, areas: ["matsudo", "noda", "kashiwa", "nagareyama", "abiko", "kamagaya"] },
  { id: "inba", name: "印旛", reading: "いんば", labelX: 333, labelY: 276, municipalityX: 335, municipalityY: 180, areas: ["narita", "sakura", "yotsukaido", "yachimata", "inzai", "shiroi", "tomisato", "shisui", "sakae"] },
  { id: "katori", name: "香取", reading: "かとり", labelX: 485, labelY: 205, municipalityX: 505, municipalityY: 105, areas: ["katori", "kozaki", "tako", "tounosho"] },
  { id: "kaiso", name: "海匝", reading: "かいそう", labelX: 596, labelY: 300, municipalityX: 630, municipalityY: 250, areas: ["choshi", "asahi", "sosa"] },
  { id: "sanbu", name: "山武", reading: "さんぶ", labelX: 458, labelY: 397, municipalityX: 570, municipalityY: 395, areas: ["togane", "sanmu", "oamishirasato", "kujukuri", "shibayama", "yokoshibahikari"] },
  { id: "chosei", name: "長生", reading: "ちょうせい", labelX: 365, labelY: 525, municipalityX: 525, municipalityY: 520, areas: ["mobara", "ichinomiya", "mutsuzawa", "chosei", "shirako", "nagara", "chonan"] },
  { id: "isumi", name: "夷隅", reading: "いすみ", labelX: 371, labelY: 644, municipalityX: 500, municipalityY: 650, areas: ["katsuura", "isumi", "otaki", "onjuku"] },
  { id: "awa", name: "安房", reading: "あわ", labelX: 172, labelY: 790, municipalityX: 70, municipalityY: 805, areas: ["tateyama", "kamogawa", "minamiboso", "kyonan"] },
  { id: "kimitsu", name: "君津", reading: "きみつ", labelX: 156, labelY: 616, municipalityX: 66, municipalityY: 620, areas: ["kisarazu", "kimitsu", "futtsu", "sodegaura"] },
];

const getMapRegion = (regionId) => MAP_REGION_GROUPS.find((region) => region.id === regionId);
const getMapRegionByArea = (areaId) => MAP_REGION_GROUPS.find((region) => region.areas.includes(areaId));

const splitMunicipalityLabelLines = (names, maxCharacters = 8) => {
  const lines = [];
  let current = "";
  names.forEach((name) => {
    const candidate = current ? `${current}・${name}` : name;
    if (current && candidate.length > maxCharacters) {
      lines.push(current);
      current = name;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getCategory = (id) => state.categories.find((category) => category.id === id);
const getArea = (id) => state.areas.find((area) => area.id === id);
const getAreaUrl = (area) => `#test-area-${area?.id || ""}`;

const toTelHref = (phone) => {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
};

const sortStores = (stores, sortKey) => {
  const items = [...stores];
  if (sortKey === "name") {
    return items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const matchesKeyword = (store, keyword) => {
  const query = normalize(keyword);
  if (!query) return true;
  const category = getCategory(store.category);
  const haystack = normalize([
    store.name,
    store.category,
    category?.name,
    category?.description,
    store.prefecture,
    store.city,
    store.area,
    store.address,
    store.description,
    store.comment,
    store.point,
    store.tags?.join(" "),
  ].join(" "));
  if (haystack.includes(query)) return true;
  const canSegment = new Array(query.length + 1).fill(false);
  canSegment[0] = true;
  for (let start = 0; start < query.length; start += 1) {
    if (!canSegment[start]) continue;
    for (let end = start + 2; end <= query.length; end += 1) {
      if (haystack.includes(query.slice(start, end))) canSegment[end] = true;
    }
  }
  return canSegment[query.length];
};

const createTagHtml = (tags = []) =>
  tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

const createActionsHtml = (store) => {
  const telHref = toTelHref(store.phone);
  const mapButton = store.mapUrl
    ? `<a class="button secondary map-button" href="${escapeHtml(store.mapUrl)}" target="_blank" rel="noopener">Googleマップで見る</a>`
    : "";
  const phoneButton = telHref && !store.isSample
    ? `<a class="button secondary" href="${escapeHtml(telHref)}">電話する</a>`
    : "";
  const detailButton = store.hasLp && store.lpUrl
    ? `<a class="button primary" href="${escapeHtml(siteUrl(store.lpUrl))}">専用LPを見る</a>`
    : "";

  return `
    <div class="card-actions">
      ${detailButton}
      ${mapButton}
      ${phoneButton}
    </div>
  `;
};

const createStoreCard = (store, options = {}) => {
  const category = getCategory(store.category);
  const compact = Boolean(options.compact);
  const listingType = store.listingType || (store.hasLp ? "lp" : "free");
  const listingBadge = listingType === "lp"
    ? `<span class="badge badge-lp">専用LPあり</span>`
    : `<span class="badge badge-basic">基本掲載</span>`;
  const statusBadge = store.isSample
    ? `<span class="badge badge-sample">サンプル掲載</span>`
    : `<span class="badge badge-live">実店舗</span>`;
  const point = store.point || store.comment || "";
  const description = store.description || store.comment || "";
  const phone = store.isSample ? "サンプル情報" : store.phone;

  return `
    <article class="store-card ${compact ? "store-card-compact" : ""} ${store.isSample ? "is-sample-store" : ""}" data-store-id="${escapeHtml(store.id)}">
      <div class="store-card-top">
        <span class="category-chip">${escapeHtml(category?.name || store.category)}</span>
        ${listingBadge}
        ${statusBadge}
      </div>
      <h3>${escapeHtml(store.name)}</h3>
      <p class="store-comment">${escapeHtml(description)}</p>
      <div class="store-point">
        <span>このお店のポイント</span>
        <p>${escapeHtml(point)}</p>
      </div>
      <dl class="store-meta">
        <div><dt>市町村</dt><dd>${escapeHtml(store.city || store.area)}</dd></div>
        <div><dt>住所</dt><dd>${escapeHtml(store.address)}</dd></div>
        <div><dt>営業時間</dt><dd>${escapeHtml(store.hours)}</dd></div>
        <div><dt>定休日</dt><dd>${escapeHtml(store.closed)}</dd></div>
        <div><dt>電話番号</dt><dd>${escapeHtml(phone)}</dd></div>
      </dl>
      <div class="tag-list">${createTagHtml(store.tags)}</div>
      ${createActionsHtml(store)}
    </article>
  `;
};

const createHomeStoreCard = (store) => {
  const category = getCategory(store.category);
  const lpButton = store.hasLp && store.lpUrl
    ? `<a class="button primary" href="${escapeHtml(siteUrl(store.lpUrl))}">専用LPを見る</a>`
    : "";
  return `
    <article class="home-store-card" data-store-id="${escapeHtml(store.id)}">
      <div class="home-store-location">${escapeHtml(store.city || store.area)}</div>
      <h3>${escapeHtml(store.name)}</h3>
      <p class="home-store-category">${escapeHtml(category?.name || store.category)}</p>
      <div class="store-point">
        <span>このお店のおすすめポイント</span>
        <p>${escapeHtml(store.point || store.comment || "")}</p>
      </div>
      <div class="tag-list">${createTagHtml(store.tags)}</div>
      ${lpButton ? `<div class="card-actions">${lpButton}</div>` : ""}
    </article>
  `;
};

const renderEmpty = (target, message) => {
  if (!target) return;
  target.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
};

const renderStores = (target, stores, options = {}) => {
  if (!target) return;
  if (!stores.length) {
    renderEmpty(target, options.emptyMessage || "条件に合う店舗はまだありません。");
    return;
  }
  target.innerHTML = stores.map((store) => createStoreCard(store, options)).join("");
};

const loadData = async () => {
  const [storesResponse, categoriesResponse, areasResponse] = await Promise.all([
    fetch(DATA_PATHS.stores, { cache: "no-store" }),
    fetch(DATA_PATHS.categories, { cache: "no-store" }),
    fetch(DATA_PATHS.areas, { cache: "no-store" }),
  ]);
  if (!storesResponse.ok || !categoriesResponse.ok || !areasResponse.ok) {
    throw new Error("data load failed");
  }
  state.stores = await storesResponse.json();
  state.categories = await categoriesResponse.json();
  state.areas = await areasResponse.json();
};

const initHeader = () => {
  const path = window.location.pathname;
  $$(".site-nav a").forEach((link) => {
    const href = new URL(link.getAttribute("href"), window.location.href).pathname;
    const active = href === siteRootUrl.pathname ? path === href : path.startsWith(href);
    link.classList.toggle("is-active", active);
  });
};

const renderCategoryGrid = (target) => {
  if (!target) return;
  const iconByCategory = {
    bike: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 40h30l-5-13H28l-5 7h-7"/><circle cx="16" cy="43" r="8"/><circle cx="48" cy="43" r="8"/><path d="M31 27l-5-8h8"/></svg>`,
    food: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M19 12v17M13 12v13c0 4 2.8 7 6 7s6-3 6-7V12M19 32v20"/><path d="M44 12c-5 5-8 12-8 21h8v19M44 12v40"/></svg>`,
    construction: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 50h40M18 50V24l14-11 14 11v26M26 50V36h12v14"/><path d="M46 18l6-6"/></svg>`,
  };
  const displayName = {
    bike: "バイク・車",
    food: "飲食店",
    construction: "建築・職人",
  };
  target.innerHTML = state.categories
    .map((category) => `
      <a class="category-card category-tile" href="${escapeHtml(siteUrl(category.slug))}">
        <span class="category-tile-icon">${iconByCategory[category.id] || escapeHtml(category.accent)}</span>
        <strong>${escapeHtml(displayName[category.id] || category.name)}</strong>
      </a>
    `)
    .join("");
};

const populateCategorySelect = (target, defaultLabel = "すべて") => {
  if (!target) return;
  target.innerHTML = `<option value="">${escapeHtml(defaultLabel)}</option>${state.categories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
    .join("")}`;
};

const getAreaCounts = () => {
  const counts = new Map();
  state.stores.forEach((store) => {
    if (!store.areaId) return;
    counts.set(store.areaId, (counts.get(store.areaId) || 0) + 1);
  });
  return counts;
};

let chibaMapSvgPromise;

const loadChibaMapSvg = async () => {
  if (!chibaMapSvgPromise) {
    chibaMapSvgPromise = fetch(DATA_PATHS.chibaMap).then(async (response) => {
      if (!response.ok) throw new Error(`千葉県マップを読み込めませんでした: ${response.status}`);
      const documentNode = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
      const svg = documentNode.documentElement;
      if (svg.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
        throw new Error("千葉県マップのSVG形式が不正です。");
      }
      return svg;
    });
  }
  return chibaMapSvgPromise;
};

const createAreaMapNode = async (counts, selectedAreaId = "") => {
  const sourceSvg = await loadChibaMapSvg();
  const svg = document.importNode(sourceSvg, true);
  svg.classList.add("grouped-region-map");
  const regionLayer = svg.querySelector(".area-map-regions");
  const prefectureOutlineLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  prefectureOutlineLayer.classList.add("map-prefecture-outline");
  prefectureOutlineLayer.setAttribute("aria-hidden", "true");
  svg.querySelectorAll("[data-area-id]").forEach((sourcePath) => {
    const outlinePath = sourcePath.cloneNode(false);
    outlinePath.removeAttribute("id");
    outlinePath.removeAttribute("data-area-id");
    outlinePath.setAttribute("class", "map-prefecture-outline-shape");
    prefectureOutlineLayer.append(outlinePath);
  });
  const outlineLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  outlineLayer.classList.add("map-region-outlines");
  outlineLayer.setAttribute("aria-hidden", "true");
  const labelLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelLayer.classList.add("map-region-labels");
  labelLayer.setAttribute("aria-hidden", "true");

  MAP_REGION_GROUPS.forEach((region) => {
    const outlineGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    outlineGroup.classList.add("map-region-outline");
    outlineGroup.dataset.mapRegionOutline = region.id;
    region.areas.forEach((areaId) => {
      const sourcePath = svg.querySelector(`[data-area-id="${CSS.escape(areaId)}"]`);
      if (sourcePath) {
        const outlinePath = sourcePath.cloneNode(false);
        outlinePath.removeAttribute("id");
        outlinePath.removeAttribute("data-area-id");
        outlineGroup.append(outlinePath);
      }
    });
    outlineLayer.append(outlineGroup);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "g");
    label.classList.add("map-region-label");
    label.dataset.mapRegionLabel = region.id;
    label.setAttribute("transform", `translate(${region.labelX} ${region.labelY})`);

    const regionNameLabel = document.createElementNS("http://www.w3.org/2000/svg", "g");
    regionNameLabel.classList.add("map-label-variant", "is-region-name");
    const width = Math.max(52, region.name.length * 17 + 20);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(-width / 2));
    rect.setAttribute("y", "-15");
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", "30");
    rect.setAttribute("rx", "9");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "0");
    text.setAttribute("y", "5");
    text.textContent = region.name;
    regionNameLabel.append(rect, text);

    const municipalityNames = region.areas.map(getArea).filter(Boolean).map((area) => area.name);
    const municipalityLines = splitMunicipalityLabelLines(municipalityNames);
    const municipalityOffsetX = region.municipalityX - region.labelX;
    const municipalityOffsetY = region.municipalityY - region.labelY;
    const municipalityLeader = document.createElementNS("http://www.w3.org/2000/svg", "line");
    municipalityLeader.classList.add("map-municipality-label-leader");
    municipalityLeader.setAttribute("x1", "0");
    municipalityLeader.setAttribute("y1", "0");
    municipalityLeader.setAttribute("x2", String(municipalityOffsetX));
    municipalityLeader.setAttribute("y2", String(municipalityOffsetY));
    const municipalityLabel = document.createElementNS("http://www.w3.org/2000/svg", "g");
    municipalityLabel.classList.add("map-label-variant", "is-municipality-names");
    municipalityLabel.setAttribute(
      "transform",
      `translate(${municipalityOffsetX} ${municipalityOffsetY})`
    );
    const longestLine = Math.max(...municipalityLines.map((line) => line.length));
    const municipalityWidth = Math.max(94, longestLine * 16 + 24);
    const municipalityHeight = municipalityLines.length * 21 + 39;
    const municipalityRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    municipalityRect.setAttribute("x", String(-municipalityWidth / 2));
    municipalityRect.setAttribute("y", String(-municipalityHeight / 2));
    municipalityRect.setAttribute("width", String(municipalityWidth));
    municipalityRect.setAttribute("height", String(municipalityHeight));
    municipalityRect.setAttribute("rx", "8");
    municipalityLabel.append(municipalityRect);
    const municipalityRegionTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    municipalityRegionTitle.classList.add("map-municipality-region-title");
    municipalityRegionTitle.setAttribute("x", "0");
    municipalityRegionTitle.setAttribute("y", String(-municipalityHeight / 2 + 17));
    municipalityRegionTitle.textContent = `${region.name}エリア`;
    municipalityLabel.append(municipalityRegionTitle);
    municipalityLines.forEach((line, lineIndex) => {
      const municipalityText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      municipalityText.classList.add("map-municipality-name-line");
      municipalityText.setAttribute("x", "0");
      municipalityText.setAttribute(
        "y",
        String(-municipalityHeight / 2 + 38 + lineIndex * 21)
      );
      municipalityText.textContent = line;
      municipalityLabel.append(municipalityText);
    });

    label.append(municipalityLeader, regionNameLabel, municipalityLabel);
    labelLayer.append(label);
  });
  regionLayer?.insertBefore(prefectureOutlineLayer, regionLayer.firstChild);
  regionLayer?.insertBefore(outlineLayer, regionLayer.firstChild);
  regionLayer?.append(labelLayer);

  svg.querySelectorAll(".major-city-label").forEach((label) => {
    const text = label.querySelector("text");
    const rect = label.querySelector("rect");
    const characterCount = Array.from(text?.textContent?.trim() || "").length;
    const labelWidth = Math.max(32, characterCount * 15.5 + 10);
    rect?.setAttribute("x", String(-labelWidth / 2));
    rect?.setAttribute("y", "-13.5");
    rect?.setAttribute("width", String(labelWidth));
    rect?.setAttribute("height", "27");
    rect?.setAttribute("rx", "6");
    text?.setAttribute("y", "5");

    const anchor = label.previousElementSibling?.classList.contains("major-city-anchor")
      ? label.previousElementSibling
      : null;
    const leader = anchor?.previousElementSibling?.classList.contains("major-city-leader")
      ? anchor.previousElementSibling
      : null;
    if (anchor) anchor.dataset.labelArea = label.dataset.labelArea;
    if (leader) leader.dataset.labelArea = label.dataset.labelArea;
  });

  const firstAreaByRegion = new Set();
  svg.querySelectorAll("[data-area-link]").forEach((link) => {
    const areaId = link.dataset.areaLink;
    const region = getMapRegionByArea(areaId);
    if (!region) return;
    const area = getArea(areaId);
    const count = counts.get(areaId) || 0;
    link.dataset.mapRegion = region.id;
    link.classList.toggle("has-stores", count > 0);
    link.classList.toggle("no-stores", count === 0);
    link.classList.toggle("is-active", areaId === selectedAreaId);
    link.setAttribute("href", `#region-${region.id}`);
    link.setAttribute("role", "button");
    link.setAttribute("aria-label", `${area?.name || areaId}、${count ? `掲載${count}件` : "掲載募集中"}`);
    if (firstAreaByRegion.has(region.id)) {
      link.setAttribute("tabindex", "-1");
    } else {
      firstAreaByRegion.add(region.id);
      link.setAttribute("tabindex", "0");
    }
    const title = link.querySelector("title");
    if (title) title.textContent = `${region.name}地域`;
  });
  return svg;
};

const initGroupedRegionMap = (counts, mapTargets, statusTargets) => {
  const isTouchMap = () => window.matchMedia("(hover: none), (pointer: coarse), (max-width: 760px)").matches;

  mapTargets.forEach((mapTarget) => {
    const svg = mapTarget.querySelector(".grouped-region-map");
    const tooltip = mapTarget.querySelector(".area-map-tooltip");
    const preview = mapTarget.querySelector("[data-area-selection-preview]");
    tooltip?.classList.add("grouped-region-tooltip");
    let selectedRegionId = "";
    let selectedAreaId = "";

    const isRegionMode = () => mapTarget.dataset.mapViewMode !== "municipalities";
    const focusMapSelection = (elements, mode) => {
      requestAnimationFrame(() => {
        mapTarget.dispatchEvent(new CustomEvent("mapfocusselection", {
          detail: { elements: [...elements], mode },
        }));
      });
    };

    const setActiveRegion = (regionId, persistent = false) => {
      const region = getMapRegion(regionId);
      if (!region) return;
      if (persistent) selectedRegionId = regionId;
      svg.querySelectorAll("[data-map-region]").forEach((item) => {
        item.classList.toggle("is-group-active", item.dataset.mapRegion === regionId);
      });
      svg.querySelectorAll("[data-map-region-outline]").forEach((item) => {
        item.classList.toggle("is-group-active", item.dataset.mapRegionOutline === regionId);
      });
      svg.querySelectorAll("[data-map-region-label]").forEach((item) => {
        item.classList.toggle("is-group-active", item.dataset.mapRegionLabel === regionId);
      });
      statusTargets.forEach((target) => {
        target.textContent = `${region.name}地域・${region.areas.length}市町村`;
      });
    };

    const clearActiveRegion = (force = false) => {
      if (selectedRegionId && !force) {
        setActiveRegion(selectedRegionId);
        return;
      }
      if (force) selectedRegionId = "";
      svg.querySelectorAll(".is-group-active").forEach((item) => item.classList.remove("is-group-active"));
      statusTargets.forEach((target) => {
        target.textContent = "地域に触れると範囲を確認できます";
      });
      if (preview) preview.hidden = true;
      if (tooltip) tooltip.hidden = true;
    };

    const clearActiveArea = () => {
      selectedAreaId = "";
      svg.querySelectorAll(".is-mobile-selected, .is-linked-highlight").forEach((item) => {
        item.classList.remove("is-mobile-selected", "is-linked-highlight");
      });
      if (preview) preview.hidden = true;
      if (tooltip) tooltip.hidden = true;
    };

    const showAreaCard = (areaId) => {
      const area = getArea(areaId);
      if (!area || !preview) return;
      const count = counts.get(areaId) || 0;
      const { categories } = getAreaStoreSummary(areaId);
      selectedAreaId = areaId;
      svg.querySelectorAll("[data-area-link]").forEach((item) => {
        item.classList.toggle("is-mobile-selected", item.dataset.areaLink === areaId);
      });
      preview.innerHTML = `
        <div class="area-preview-heading">
          <div>
            <p class="eyebrow">Selected municipality</p>
            <h3>${escapeHtml(area.name)}</h3>
          </div>
          <button class="area-preview-close" type="button" data-area-preview-close aria-label="閉じる">×</button>
        </div>
        ${count
          ? `
            <p class="area-preview-meta"><strong>掲載店舗：</strong>${count}件</p>
            <p class="area-preview-meta"><strong>カテゴリ：</strong>${escapeHtml(categories.join("・") || "掲載店舗あり")}</p>
            <p>行く前に雰囲気やポイントが分かるお店を掲載中です。</p>
          `
          : "<p>現在、この市町村の掲載店舗を募集中です。</p>"
        }
      `;
      preview.hidden = false;
      preview.querySelector("[data-area-preview-close]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        clearActiveArea();
      });
      focusMapSelection(
        svg.querySelectorAll(`[data-area-link="${CSS.escape(areaId)}"]`),
        "municipality"
      );
    };

    const showRegionCard = (regionId) => {
      const region = getMapRegion(regionId);
      if (!region || !preview) return;
      const municipalityNames = region.areas.map(getArea).filter(Boolean).map((area) => area.name);
      const listedCount = region.areas.reduce((sum, areaId) => sum + (counts.get(areaId) || 0), 0);
      preview.innerHTML = `
        <div class="area-preview-heading">
          <div>
            <p class="eyebrow">${escapeHtml(region.reading)}</p>
            <h3>${escapeHtml(region.name)}地域</h3>
          </div>
          <button class="area-preview-close" type="button" data-area-preview-close aria-label="閉じる">×</button>
        </div>
        <p class="grouped-region-municipalities">${municipalityNames.map(escapeHtml).join("・")}</p>
        <p class="area-preview-count">掲載店舗：${listedCount}件</p>
      `;
      preview.hidden = false;
      preview.querySelector("[data-area-preview-close]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        clearActiveRegion(true);
      });
      focusMapSelection(
        svg.querySelectorAll(`[data-map-region="${CSS.escape(regionId)}"]`),
        "region"
      );
    };

    svg.querySelectorAll("[data-map-region]").forEach((link) => {
      const regionId = link.dataset.mapRegion;
      link.addEventListener("pointerenter", (event) => {
        if (isTouchMap()) return;
        if (isRegionMode()) {
          setActiveRegion(regionId);
          const region = getMapRegion(regionId);
          if (tooltip && region) {
            const municipalityNames = region.areas.map(getArea).filter(Boolean).map((area) => area.name);
            tooltip.innerHTML = `
              <strong>${escapeHtml(region.name)}地域</strong>
              <span>${municipalityNames.map(escapeHtml).join("・")}</span>
            `;
          }
        } else {
          const areaId = link.dataset.areaLink;
          const area = getArea(areaId);
          const count = counts.get(areaId) || 0;
          link.classList.add("is-linked-highlight");
          statusTargets.forEach((target) => {
            target.textContent = `${area?.name || ""}${count ? `・掲載店舗 ${count}件` : "・掲載募集中"}`;
          });
          if (tooltip) {
            tooltip.innerHTML = `
              <strong>${escapeHtml(area?.name || "")}</strong>
              <span>${count ? `掲載店舗：${count}件` : "掲載募集中"}</span>
            `;
          }
        }
        if (tooltip) {
          const rect = mapTarget.getBoundingClientRect();
          tooltip.style.left = `${event.clientX - rect.left + 14}px`;
          tooltip.style.top = `${event.clientY - rect.top + 14}px`;
          tooltip.hidden = false;
        }
      });
      link.addEventListener("pointermove", (event) => {
        if (!tooltip || isTouchMap()) return;
        const rect = mapTarget.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - rect.left + 14}px`;
        tooltip.style.top = `${event.clientY - rect.top + 14}px`;
      });
      link.addEventListener("pointerleave", () => {
        if (isTouchMap()) return;
        if (tooltip) tooltip.hidden = true;
        if (isRegionMode()) {
          clearActiveRegion();
        } else {
          link.classList.remove("is-linked-highlight");
          if (selectedAreaId) {
            const area = getArea(selectedAreaId);
            statusTargets.forEach((target) => {
              target.textContent = area?.name || "";
            });
          } else {
            statusTargets.forEach((target) => {
              target.textContent = "市町村に触れると掲載状況を確認できます";
            });
          }
        }
      });
      link.addEventListener("focus", () => {
        if (isRegionMode()) setActiveRegion(regionId);
        else link.classList.add("is-linked-highlight");
      });
      link.addEventListener("blur", () => {
        if (isRegionMode()) clearActiveRegion();
        else link.classList.remove("is-linked-highlight");
      });
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (isRegionMode()) {
          clearActiveArea();
          setActiveRegion(regionId, true);
          showRegionCard(regionId);
        } else {
          clearActiveRegion(true);
          showAreaCard(link.dataset.areaLink);
        }
      });
    });

    mapTarget.addEventListener("click", (event) => {
      if (event.target.closest("[data-map-region], [data-area-selection-preview], .map-function-controls")) return;
      clearActiveRegion(true);
      clearActiveArea();
    });

    mapTarget.addEventListener("mapviewchange", () => {
      clearActiveRegion(true);
      clearActiveArea();
      statusTargets.forEach((target) => {
        target.textContent = isRegionMode()
          ? "地域に触れると範囲を確認できます"
          : "市町村に触れると掲載状況を確認できます";
      });
    });
  });
};

const initMapLabelSwitcher = (mapTargets) => {
  const mapTarget = mapTargets[0];
  if (!mapTarget) return;
  const controlsPanel = document.createElement("div");
  controlsPanel.className = "map-function-controls";
  controlsPanel.innerHTML = `
    <strong>表示切替</strong>
    <div class="map-view-segmented">
      <label><input type="radio" name="map-view-mode" value="regions" checked><span>地域ごと</span></label>
      <label><input type="radio" name="map-view-mode" value="municipalities"><span>市区町村ごと</span></label>
    </div>
    <label class="map-listed-only">
      <input type="checkbox" data-listed-only-toggle>
      <span>掲載中のみ</span>
      <i aria-hidden="true"></i>
    </label>
    <div class="area-map-zoom-controls" aria-label="地図の拡大縮小">
      <button type="button" data-map-zoom-in aria-label="地図を拡大">＋</button>
      <button type="button" data-map-zoom-out aria-label="地図を縮小">−</button>
      <button type="button" data-map-zoom-reset aria-label="地図を元の大きさに戻す">全体</button>
    </div>
  `;
  mapTarget.prepend(controlsPanel);
  const controls = $$('input[name="map-view-mode"]', controlsPanel);

  const applyMode = (mode) => {
    mapTargets.forEach((mapTarget) => {
      mapTarget.dataset.mapViewMode = mode;
      mapTarget.dispatchEvent(new CustomEvent("mapviewchange"));
    });
  };

  controls.forEach((control) => {
    control.addEventListener("change", () => {
      if (control.checked) applyMode(control.value);
    });
  });
  applyMode(controls.find((control) => control.checked)?.value || "regions");
};

const initListedOnlyFilters = (mapTargets) => {
  const toggles = $$("[data-listed-only-toggle]");
  const apply = (checked) => {
    toggles.forEach((toggle) => { toggle.checked = checked; });
    if (checked) {
      const cityMode = $('input[name="map-view-mode"][value="municipalities"]');
      if (cityMode && !cityMode.checked) {
        cityMode.checked = true;
        cityMode.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    mapTargets.forEach((target) => {
      target.classList.toggle("is-listed-only", checked);
      target.querySelectorAll(".major-city-label, .major-city-leader, .major-city-anchor").forEach((labelPart) => {
        const count = getAreaCounts().get(labelPart.dataset.labelArea) || 0;
        labelPart.classList.toggle("is-filter-hidden", checked && count === 0);
      });
    });
    $$("[data-area-list]").forEach((target) => {
      target.classList.toggle("is-listed-only", checked);
    });
  };
  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => apply(toggle.checked));
  });
};

const initMapZoom = (target) => {
  const svg = target.querySelector(".chiba-area-map");
  if (!svg) return;
  const controls = target.querySelector(".area-map-zoom-controls");
  if (!controls) return;

  const pointers = new Map();
  const minScale = 1;
  const maxScale = 3.5;
  const viewBox = svg.viewBox.baseVal;
  const baseView = {
    x: viewBox.x,
    y: viewBox.y,
    width: viewBox.width,
    height: viewBox.height,
  };
  let view = { ...baseView };
  let scale = 1;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchStartView;
  let pinchStartCenter;
  let panStart;
  let gestureMoved = false;
  let suppressClickUntil = 0;
  let focusAnimationFrame = 0;
  let edgePaddingFactor = 0.08;

  const clampView = (nextView) => {
    const width = Math.min(baseView.width, Math.max(baseView.width / maxScale, nextView.width));
    const height = Math.min(baseView.height, Math.max(baseView.height / maxScale, nextView.height));
    const edgePaddingX = width < baseView.width ? width * edgePaddingFactor : 0;
    const edgePaddingY = height < baseView.height ? height * edgePaddingFactor : 0;
    return {
      x: Math.min(
        baseView.x + baseView.width - width + edgePaddingX,
        Math.max(baseView.x - edgePaddingX, nextView.x)
      ),
      y: Math.min(
        baseView.y + baseView.height - height + edgePaddingY,
        Math.max(baseView.y - edgePaddingY, nextView.y)
      ),
      width,
      height,
    };
  };
  const applyView = () => {
    view = clampView(view);
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
    svg.style.removeProperty("transform");
    target.classList.toggle("is-map-zoomed", scale > 1.01);
    controls.querySelector("[data-map-zoom-out]").disabled = scale <= minScale;
    controls.querySelector("[data-map-zoom-reset]").disabled = scale <= minScale;
  };
  const animateToView = (nextView, nextScale, duration = 340) => {
    cancelAnimationFrame(focusAnimationFrame);
    const startView = { ...view };
    const targetView = clampView(nextView);
    const startScale = scale;
    const startedAt = performance.now();
    const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);
    const draw = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeOut(progress);
      view = {
        x: startView.x + (targetView.x - startView.x) * eased,
        y: startView.y + (targetView.y - startView.y) * eased,
        width: startView.width + (targetView.width - startView.width) * eased,
        height: startView.height + (targetView.height - startView.height) * eased,
      };
      scale = startScale + (nextScale - startScale) * eased;
      applyView();
      if (progress < 1) focusAnimationFrame = requestAnimationFrame(draw);
    };
    focusAnimationFrame = requestAnimationFrame(draw);
  };
  const zoomFromView = (nextScale, centerClientX, centerClientY, sourceView = view) => {
    cancelAnimationFrame(focusAnimationFrame);
    edgePaddingFactor = 0.08;
    const rect = svg.getBoundingClientRect();
    const ratioX = Math.min(1, Math.max(0, (centerClientX - rect.left) / rect.width));
    const ratioY = Math.min(1, Math.max(0, (centerClientY - rect.top) / rect.height));
    const anchorX = sourceView.x + ratioX * sourceView.width;
    const anchorY = sourceView.y + ratioY * sourceView.height;
    scale = Math.min(maxScale, Math.max(minScale, nextScale));
    if (scale === minScale) {
      view = { ...baseView };
    } else {
      const width = baseView.width / scale;
      const height = baseView.height / scale;
      view = {
        x: anchorX - ratioX * width,
        y: anchorY - ratioY * height,
        width,
        height,
      };
    }
    applyView();
  };
  const distance = (first, second) =>
    Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

  target.addEventListener("mapfocusselection", (event) => {
    const elements = (event.detail?.elements || []).filter((element) => element?.isConnected);
    if (!elements.length) return;
    const boxes = elements.map((element) => element.getBBox()).filter((box) => box.width || box.height);
    if (!boxes.length) return;
    const bounds = boxes.reduce((combined, box) => ({
      left: Math.min(combined.left, box.x),
      top: Math.min(combined.top, box.y),
      right: Math.max(combined.right, box.x + box.width),
      bottom: Math.max(combined.bottom, box.y + box.height),
    }), {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    });
    const boundsWidth = bounds.right - bounds.left;
    const boundsHeight = bounds.bottom - bounds.top;
    const preferredScale = event.detail?.mode === "region" ? 1.55 : 2;
    const fitScale = Math.min(
      maxScale,
      baseView.width / Math.max(boundsWidth * 1.35, 1),
      baseView.height / Math.max(boundsHeight * 1.35, 1)
    );
    const nextScale = Math.max(scale, Math.min(preferredScale, fitScale));
    const width = baseView.width / nextScale;
    const height = baseView.height / nextScale;

    const svgRect = svg.getBoundingClientRect();
    const preview = target.querySelector("[data-area-selection-preview]:not([hidden])");
    const previewRect = preview?.getBoundingClientRect();
    let targetRatioX = 0.5;
    let targetRatioY = 0.5;
    if (previewRect) {
      const overlapsSvg =
        previewRect.left < svgRect.right &&
        previewRect.right > svgRect.left &&
        previewRect.top < svgRect.bottom &&
        previewRect.bottom > svgRect.top;
      if (overlapsSvg) {
        const freeHeight = previewRect.top - svgRect.top - 12;
        if (freeHeight > svgRect.height * 0.24) {
          targetRatioY = Math.max(0.2, Math.min(0.5, freeHeight / 2 / svgRect.height));
        }
        const isRightSideCard =
          previewRect.width < svgRect.width * 0.78 &&
          previewRect.left > svgRect.left + svgRect.width * 0.28;
        if (isRightSideCard) {
          const freeWidth = previewRect.left - svgRect.left - 12;
          targetRatioX = Math.max(0.2, Math.min(0.5, freeWidth / 2 / svgRect.width));
        }
      }
    }

    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    edgePaddingFactor = 0.65;
    animateToView({
      x: centerX - width * targetRatioX,
      y: centerY - height * targetRatioY,
      width,
      height,
    }, nextScale);
  });

  target.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".map-function-controls, [data-area-selection-preview]")) return;
    cancelAnimationFrame(focusAnimationFrame);
    pointers.set(event.pointerId, event);
    gestureMoved = false;
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      pointers.forEach((pointer) => target.setPointerCapture?.(pointer.pointerId));
      pinchStartDistance = distance(first, second);
      pinchStartScale = scale;
      pinchStartView = { ...view };
      pinchStartCenter = {
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
      };
    } else if (scale > 1) {
      panStart = { x: event.clientX, y: event.clientY, view: { ...view }, isPanning: false };
    }
  });
  target.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);
    if (pointers.size === 2) {
      event.preventDefault();
      const [first, second] = [...pointers.values()];
      const centerX = (first.clientX + second.clientX) / 2;
      const centerY = (first.clientY + second.clientY) / 2;
      const rect = svg.getBoundingClientRect();
      const sourceRatioX = (pinchStartCenter.x - rect.left) / rect.width;
      const sourceRatioY = (pinchStartCenter.y - rect.top) / rect.height;
      const anchorX = pinchStartView.x + sourceRatioX * pinchStartView.width;
      const anchorY = pinchStartView.y + sourceRatioY * pinchStartView.height;
      scale = Math.min(maxScale, Math.max(
        minScale,
        pinchStartScale * distance(first, second) / pinchStartDistance
      ));
      const width = baseView.width / scale;
      const height = baseView.height / scale;
      view = {
        x: anchorX - ((centerX - rect.left) / rect.width) * width,
        y: anchorY - ((centerY - rect.top) / rect.height) * height,
        width,
        height,
      };
      applyView();
      gestureMoved = true;
      suppressClickUntil = Date.now() + 450;
    } else if (scale > 1 && panStart) {
      const movement = Math.hypot(event.clientX - panStart.x, event.clientY - panStart.y);
      if (!panStart.isPanning && movement <= 5) return;
      if (!panStart.isPanning) {
        panStart.isPanning = true;
        target.setPointerCapture?.(event.pointerId);
      }
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      view = {
        ...panStart.view,
        x: panStart.view.x - (event.clientX - panStart.x) / rect.width * panStart.view.width,
        y: panStart.view.y - (event.clientY - panStart.y) / rect.height * panStart.view.height,
      };
      applyView();
      gestureMoved = true;
      suppressClickUntil = Date.now() + 450;
    }
  });
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture?.(event.pointerId);
    }
    if (pointers.size < 2) {
      pinchStartDistance = 0;
      pinchStartView = undefined;
      pinchStartCenter = undefined;
    }
    if (pointers.size === 1 && scale > 1) {
      const remaining = [...pointers.values()][0];
      panStart = { x: remaining.clientX, y: remaining.clientY, view: { ...view }, isPanning: true };
    } else if (!pointers.size) {
      panStart = undefined;
    }
  };
  target.addEventListener("pointerup", endPointer);
  target.addEventListener("pointercancel", endPointer);
  target.addEventListener("click", (event) => {
    if (!gestureMoved && Date.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
    gestureMoved = false;
  }, true);
  target.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomFromView(scale * (event.deltaY < 0 ? 1.18 : 0.85), event.clientX, event.clientY);
  }, { passive: false });
  controls.querySelector("[data-map-zoom-in]").addEventListener("click", () => {
    const rect = svg.getBoundingClientRect();
    zoomFromView(scale + 0.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  controls.querySelector("[data-map-zoom-out]").addEventListener("click", () => {
    const rect = svg.getBoundingClientRect();
    zoomFromView(scale - 0.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  controls.querySelector("[data-map-zoom-reset]").addEventListener("click", () => {
    cancelAnimationFrame(focusAnimationFrame);
    edgePaddingFactor = 0.08;
    scale = 1;
    view = { ...baseView };
    applyView();
  });
  applyView();
};

const createAreaListHtml = (counts, selectedAreaId = "") => {
  const regions = [...new Set(state.areas.map((area) => area.region))];
  const createLink = (area) => {
    const count = counts.get(area.id) || 0;
    return `
      <a class="area-list-button ${count ? "has-stores" : ""} ${area.id === selectedAreaId ? "is-active" : ""}" href="${escapeHtml(getAreaUrl(area))}" data-area-link="${escapeHtml(area.id)}">
        <span>${escapeHtml(area.name)}</span>
        <small>${count ? `${count}件` : "募集中"}</small>
      </a>
    `;
  };
  const listedAreas = state.areas
    .filter((area) => (counts.get(area.id) || 0) > 0)
    .map(createLink)
    .join("");
  const allAreas = regions.map((region) => {
    const links = state.areas
      .filter((area) => area.region === region)
      .map(createLink)
      .join("");
    return `
      <section class="area-list-region" aria-labelledby="area-region-${escapeHtml(region)}">
        <h4 id="area-region-${escapeHtml(region)}">${escapeHtml(region)}</h4>
        <div class="area-list-buttons">${links}</div>
      </section>
    `;
  }).join("");
  return `
    <section class="listed-area-group" id="listed-areas" aria-labelledby="listed-area-title">
      <div class="area-list-subheading">
        <h4 id="listed-area-title">掲載中のエリア</h4>
        <small>${state.areas.filter((area) => (counts.get(area.id) || 0) > 0).length}市</small>
      </div>
      <div class="area-list-buttons listed-area-buttons">${listedAreas}</div>
    </section>
    <details class="all-area-details" open>
      <summary>すべての市町村から探す</summary>
      <div class="all-area-regions">${allAreas}</div>
    </details>
  `;
};

const getAreaStoreSummary = (areaId) => {
  const stores = state.stores.filter((store) => store.areaId === areaId);
  const categories = [...new Set(stores
    .map((store) => getCategory(store.category)?.name)
    .filter(Boolean))];
  return { stores, categories };
};

const createAreaPreviewHtml = (area, counts) => {
  const count = counts.get(area.id) || 0;
  const { categories } = getAreaStoreSummary(area.id);
  if (count) {
    return `
      <div class="area-preview-heading">
        <div>
          <p class="eyebrow">Selected area</p>
          <h3>${escapeHtml(area.name)}</h3>
        </div>
        <div class="area-preview-heading-actions">
          <span class="area-preview-count">${count}件</span>
          <button class="area-preview-close" type="button" data-area-preview-close aria-label="選択カードを閉じる">×</button>
        </div>
      </div>
      <p class="area-preview-meta"><strong>掲載店舗：</strong>${count}件</p>
      <p class="area-preview-meta"><strong>カテゴリ：</strong>${escapeHtml(categories.join("、") || "掲載店舗あり")}</p>
      <p>行く前に雰囲気やポイントが分かるお店を掲載中です。</p>
      <div class="area-preview-actions">
        <a class="button primary" href="${escapeHtml(getAreaUrl(area))}">${escapeHtml(area.name)}のお店を見る</a>
      </div>
    `;
  }
  return `
    <div class="area-preview-heading">
      <div>
        <p class="eyebrow">Selected area</p>
        <h3>${escapeHtml(area.name)}</h3>
      </div>
      <div class="area-preview-heading-actions">
        <span class="area-preview-count is-empty">募集中</span>
        <button class="area-preview-close" type="button" data-area-preview-close aria-label="選択カードを閉じる">×</button>
      </div>
    </div>
    <p>現在、このエリアの掲載店舗を募集中です。</p>
    <div class="area-preview-actions">
      <a class="button secondary" href="${escapeHtml(siteUrl("chiba/#listed-areas"))}">千葉県の掲載中エリアを見る</a>
      <a class="button primary" href="${escapeHtml(siteUrl("for-shops/"))}">掲載を希望する</a>
    </div>
  `;
};

const initAreaMaps = async () => {
  const counts = getAreaCounts();
  const selectedAreaId = document.body.dataset.areaId || "";
  await Promise.all($$("[data-area-map]").map(async (target) => {
    target.replaceChildren(await createAreaMapNode(
      counts,
      target.dataset.selectedArea || selectedAreaId
    ));
  }));
  $$("[data-area-list]").forEach((target) => {
    target.innerHTML = createAreaListHtml(counts, target.dataset.selectedArea || selectedAreaId);
    const details = target.querySelector(".all-area-details");
    if (details && window.matchMedia("(max-width: 760px)").matches) details.open = false;
  });
  $$("[data-area-summary]").forEach((target) => {
    target.textContent = `千葉県 ${MAP_REGION_GROUPS.length}地域 / ${state.areas.length}市町村`;
  });
  const statusTargets = $$("[data-area-map-status]");
  const isTouchMap = () => window.matchMedia("(hover: none), (pointer: coarse), (max-width: 760px)").matches;
  const mapTargets = $$("[data-area-map]");

  mapTargets.forEach((target) => {
    const tooltip = document.createElement("div");
    tooltip.className = "area-map-tooltip";
    tooltip.hidden = true;
    target.append(tooltip);

    const preview = document.createElement("section");
    preview.className = "area-selection-preview";
    preview.dataset.areaSelectionPreview = "";
    preview.hidden = true;
    preview.setAttribute("aria-live", "polite");
    target.append(preview);
  });
  initMapLabelSwitcher(mapTargets);
  mapTargets.forEach(initMapZoom);
  initListedOnlyFilters(mapTargets);
  initGroupedRegionMap(counts, mapTargets, statusTargets);
  $$("[data-area-list] [data-area-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const cityMode = $('input[name="map-view-mode"][value="municipalities"]');
      if (cityMode && !cityMode.checked) {
        cityMode.checked = true;
        cityMode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const mapLink = $(`[data-area-map] [data-area-link="${CSS.escape(link.dataset.areaLink)}"]`);
      mapLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    link.addEventListener("pointerenter", () => {
      $(`[data-area-map] [data-area-link="${CSS.escape(link.dataset.areaLink)}"]`)?.classList.add("is-linked-highlight");
    });
    link.addEventListener("pointerleave", () => {
      $(`[data-area-map] [data-area-link="${CSS.escape(link.dataset.areaLink)}"]`)?.classList.remove("is-linked-highlight");
    });
  });
};

const initHome = async () => {
  const params = new URLSearchParams(window.location.search);
  const legacyArea = getArea(params.get("area"));
  if (legacyArea) {
    window.location.replace(getAreaUrl(legacyArea));
    return;
  }

  renderCategoryGrid($("[data-categories-grid]"));
  const form = $("[data-top-search]");
  const keywordInput = form?.elements.namedItem("q");
  if (keywordInput instanceof HTMLInputElement) keywordInput.value = params.get("q") || "";
  const newStoresTarget = $("[data-new-stores]");
  if (newStoresTarget) {
    newStoresTarget.innerHTML = sortStores(state.stores, "created")
      .slice(0, 3)
      .map(createHomeStoreCard)
      .join("");
  }
  await initAreaMaps();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const keyword = String(formData.get("q") || "").trim();
    window.location.href = `${siteUrl("search/")}?q=${encodeURIComponent(keyword)}`;
  });
};

const initSearchPage = () => {
  const params = new URLSearchParams(window.location.search);
  const keyword = params.get("q")?.trim() || "";
  const input = $("[data-search-keyword]");
  const title = $("[data-search-title]");
  const count = $("[data-search-count]");
  const target = $("[data-search-results]");
  if (input) input.value = keyword;
  const results = keyword
    ? sortStores(state.stores.filter((store) => matchesKeyword(store, keyword)), "created")
    : [];
  if (title) title.textContent = keyword ? `「${keyword}」の検索結果` : "キーワード検索";
  if (count) count.textContent = `${results.length}件`;
  renderStores(target, results, {
    emptyMessage: keyword
      ? "キーワードに合う店舗はまだありません。別の言葉でもお試しください。"
      : "キーワードを入力してお店を検索してください。",
  });
};

const initPrefecturePage = async () => {
  await initAreaMaps();
  renderCategoryGrid($("[data-prefecture-categories]"));
  const prefectureStores = state.stores.filter((store) => store.prefectureId === "chiba");
  renderStores($("[data-prefecture-new-stores]"), sortStores(prefectureStores, "created").slice(0, 6), { compact: true });
};

const initAreaPage = async () => {
  const areaId = document.body.dataset.areaId;
  const area = getArea(areaId);
  if (!area) return;
  await initAreaMaps();

  const pageStores = state.stores.filter((store) => store.areaId === areaId);
  const controls = {
    keyword: $("[data-area-filter-keyword]"),
    category: $("[data-area-filter-category]"),
    sort: $("[data-area-filter-sort]"),
  };
  populateCategorySelect(controls.category, "すべてのカテゴリ");

  const applyFilters = () => {
    const keyword = controls.keyword?.value || "";
    const category = controls.category?.value || "";
    const sortKey = controls.sort?.value || "created";
    const filtered = pageStores.filter((store) => {
      if (category && store.category !== category) return false;
      return matchesKeyword(store, keyword);
    });
    const sorted = sortStores(filtered, sortKey);
    renderStores($("[data-area-page-stores]"), sorted, {
      emptyMessage: pageStores.length
        ? "選択した条件に合う店舗はありません。検索条件を変えてお試しください。"
        : "現在このエリアの掲載店舗を募集中です。",
    });
    const count = $("[data-area-page-count]");
    if (count) count.textContent = `${sorted.length}件`;
  };

  Object.values(controls).forEach((control) => {
    control?.addEventListener("input", applyFilters);
    control?.addEventListener("change", applyFilters);
  });
  applyFilters();

  const neighborTarget = $("[data-area-neighbors]");
  if (neighborTarget) {
    const neighbors = (area.neighbors || []).map(getArea).filter(Boolean);
    neighborTarget.innerHTML = neighbors.map((neighbor) => `
      <a class="neighbor-link" href="${escapeHtml(getAreaUrl(neighbor))}">
        <span>${escapeHtml(neighbor.name)}</span>
        <small>${neighbor.storeCount ? `${neighbor.storeCount}件掲載` : "掲載募集中"}</small>
      </a>
    `).join("");
  }
};

const buildOptionList = (items, defaultLabel) => {
  const unique = [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
  return [`<option value="">${escapeHtml(defaultLabel)}</option>`]
    .concat(unique.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`))
    .join("");
};

const initCategoryPage = () => {
  const categoryId = document.body.dataset.category;
  if (!categoryId) return;
  const category = getCategory(categoryId);
  const pageStores = state.stores.filter((store) => store.category === categoryId);
  const params = new URLSearchParams(window.location.search);
  const controls = {
    keyword: $("[data-filter-keyword]"),
    area: $("[data-filter-area]"),
    tag: $("[data-filter-tag]"),
    lpOnly: $("[data-filter-lp]"),
    sort: $("[data-filter-sort]"),
  };
  const titleTarget = $("[data-category-name]");
  const descriptionTarget = $("[data-category-description]");
  if (titleTarget && category) titleTarget.textContent = category.name;
  if (descriptionTarget && category) descriptionTarget.textContent = category.description;
  if (controls.area) controls.area.innerHTML = buildOptionList(pageStores.map((store) => store.area), "すべてのエリア");
  if (controls.tag) controls.tag.innerHTML = buildOptionList(pageStores.flatMap((store) => store.tags || []), "すべてのタグ");
  if (controls.keyword) controls.keyword.value = params.get("q") || "";
  if (controls.tag && params.get("tag")) controls.tag.value = params.get("tag");

  const applyFilters = () => {
    const keyword = controls.keyword?.value || "";
    const areaValue = controls.area?.value || "";
    const tag = controls.tag?.value || "";
    const lpOnly = Boolean(controls.lpOnly?.checked);
    const sortKey = controls.sort?.value || "created";
    const filtered = pageStores.filter((store) => {
      if (!matchesKeyword(store, keyword)) return false;
      if (areaValue && store.area !== areaValue) return false;
      if (lpOnly && !store.hasLp) return false;
      if (tag && !(store.tags || []).includes(tag)) return false;
      return true;
    });
    const sorted = sortStores(filtered, sortKey);
    renderStores($("[data-category-stores]"), sorted);
    const count = $("[data-result-count]");
    if (count) count.textContent = `${sorted.length}件`;
  };
  Object.values(controls).forEach((control) => {
    control?.addEventListener("input", applyFilters);
    control?.addEventListener("change", applyFilters);
  });
  applyFilters();
};

const initContact = () => {
  const form = $("[data-contact-form]");
  const message = $("[data-contact-message]");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (message) {
      message.textContent = "入力内容を確認しました。運営者の連絡先設定後に送信できます。";
      message.hidden = false;
    }
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  initHeader();
  initContact();
  if (!document.body.matches("[data-page='home'], [data-page='category'], [data-page='prefecture'], [data-page='area'], [data-page='search']")) return;
  try {
    await loadData();
    if (document.body.dataset.page === "home") await initHome();
    if (document.body.dataset.page === "prefecture") await initPrefecturePage();
    if (document.body.dataset.page === "area") await initAreaPage();
    if (document.body.dataset.page === "category") initCategoryPage();
    if (document.body.dataset.page === "search") initSearchPage();
  } catch (error) {
    const targets = $$(
      "[data-featured-stores], [data-new-stores], [data-category-stores], [data-categories-grid], [data-area-map], [data-area-list], [data-area-page-stores], [data-prefecture-new-stores], [data-prefecture-categories], [data-search-results]"
    );
    targets.forEach((target) => renderEmpty(target, "店舗データを読み込めませんでした。"));
    console.error(error);
  }
});
