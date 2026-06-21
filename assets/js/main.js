const siteRootUrl = new URL("../../", document.currentScript.src);

const siteUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|tel:|mailto:)/.test(path)) return path;
  return new URL(path.replace(/^\//, ""), siteRootUrl).href;
};

const DATA_PATHS = {
  stores: siteUrl("data/stores.json"),
  categories: siteUrl("data/categories.json"),
  areas: siteUrl("data/areas.json"),
  chibaMap: siteUrl("assets/maps/chiba.svg?v=label-layout-2"),
};

const state = {
  stores: [],
  categories: [],
  areas: [],
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
const getAreaUrl = (area) => siteUrl(area?.url || `chiba/${area?.id || ""}/`);

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
    lounge: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 13h32L35 34v15h10v5H19v-5h10V34z"/><path d="M21 20h22"/></svg>`,
    construction: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 50h40M18 50V24l14-11 14 11v26M26 50V36h12v14"/><path d="M46 18l6-6"/></svg>`,
  };
  const displayName = {
    bike: "バイク・車",
    lounge: "ラウンジ・バー",
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
  svg.querySelectorAll("[data-area-link]").forEach((link) => {
    const areaId = link.dataset.areaLink;
    const area = getArea(areaId);
    const count = counts.get(areaId) || 0;
    const label = `${area?.name || areaId}、${count ? `掲載${count}件` : "掲載準備中"}`;
    link.classList.toggle("has-stores", count > 0);
    link.classList.toggle("no-stores", count === 0);
    link.classList.toggle("is-active", areaId === selectedAreaId);
    link.setAttribute("href", getAreaUrl(area));
    link.setAttribute("aria-label", label);
    const title = link.querySelector("title");
    if (title) title.textContent = label;
  });
  return svg;
};

const initMapZoom = (target) => {
  const svg = target.querySelector(".chiba-area-map");
  if (!svg) return;
  const controls = document.createElement("div");
  controls.className = "area-map-zoom-controls";
  controls.innerHTML = `
    <button type="button" data-map-zoom-in aria-label="地図を拡大">＋</button>
    <button type="button" data-map-zoom-out aria-label="地図を縮小">−</button>
    <button type="button" data-map-zoom-reset aria-label="地図を元の大きさに戻す">全体</button>
  `;
  target.append(controls);

  const pointers = new Map();
  const minScale = 1;
  const maxScale = 3.5;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let panStart;
  let gestureMoved = false;
  let suppressClickUntil = 0;

  const clampTranslation = () => {
    const rect = target.getBoundingClientRect();
    const maxX = rect.width * (scale - 1);
    const maxY = rect.height * (scale - 1);
    translateX = Math.min(0, Math.max(-maxX, translateX));
    translateY = Math.min(0, Math.max(-maxY, translateY));
  };
  const applyTransform = () => {
    clampTranslation();
    svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    target.classList.toggle("is-map-zoomed", scale > 1.01);
    controls.querySelector("[data-map-zoom-out]").disabled = scale <= minScale;
  };
  const zoomAt = (nextScale, centerX, centerY) => {
    const previousScale = scale;
    scale = Math.min(maxScale, Math.max(minScale, nextScale));
    if (scale === minScale) {
      translateX = 0;
      translateY = 0;
    } else {
      const ratio = scale / previousScale;
      translateX = centerX - (centerX - translateX) * ratio;
      translateY = centerY - (centerY - translateY) * ratio;
    }
    applyTransform();
  };
  const distance = (first, second) =>
    Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

  target.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".area-map-zoom-controls, [data-area-selection-preview]")) return;
    pointers.set(event.pointerId, event);
    target.setPointerCapture?.(event.pointerId);
    gestureMoved = false;
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      pinchStartDistance = distance(first, second);
      pinchStartScale = scale;
    } else if (scale > 1) {
      panStart = { x: event.clientX, y: event.clientY, translateX, translateY };
    }
  });
  target.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);
    if (pointers.size === 2) {
      event.preventDefault();
      const [first, second] = [...pointers.values()];
      const rect = target.getBoundingClientRect();
      const centerX = (first.clientX + second.clientX) / 2 - rect.left;
      const centerY = (first.clientY + second.clientY) / 2 - rect.top;
      zoomAt(pinchStartScale * distance(first, second) / pinchStartDistance, centerX, centerY);
      gestureMoved = true;
      suppressClickUntil = Date.now() + 450;
    } else if (scale > 1 && panStart) {
      event.preventDefault();
      translateX = panStart.translateX + event.clientX - panStart.x;
      translateY = panStart.translateY + event.clientY - panStart.y;
      applyTransform();
      if (Math.hypot(event.clientX - panStart.x, event.clientY - panStart.y) > 5) gestureMoved = true;
      if (gestureMoved) suppressClickUntil = Date.now() + 450;
    }
  });
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStartDistance = 0;
    if (!pointers.size) panStart = undefined;
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
    if (!event.ctrlKey && Math.abs(event.deltaY) < 2) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    zoomAt(scale * (event.deltaY < 0 ? 1.18 : 0.85), event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  controls.querySelector("[data-map-zoom-in]").addEventListener("click", () => {
    zoomAt(scale + 0.5, target.clientWidth / 2, target.clientHeight / 2);
  });
  controls.querySelector("[data-map-zoom-out]").addEventListener("click", () => {
    zoomAt(scale - 0.5, target.clientWidth / 2, target.clientHeight / 2);
  });
  controls.querySelector("[data-map-zoom-reset]").addEventListener("click", () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  });
  applyTransform();
};

const createAreaListHtml = (counts, selectedAreaId = "") => {
  const regions = [...new Set(state.areas.map((area) => area.region))];
  const createLink = (area) => {
    const count = counts.get(area.id) || 0;
    return `
      <a class="area-list-button ${count ? "has-stores" : ""} ${area.id === selectedAreaId ? "is-active" : ""}" href="${escapeHtml(getAreaUrl(area))}" data-area-link="${escapeHtml(area.id)}">
        <span>${escapeHtml(area.name)}</span>
        <small>${count ? `${count}件` : "準備中"}</small>
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
        <span class="area-preview-count is-empty">準備中</span>
        <button class="area-preview-close" type="button" data-area-preview-close aria-label="選択カードを閉じる">×</button>
      </div>
    </div>
    <p>現在、このエリアの掲載店舗は準備中です。</p>
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
    const listedAreaCount = [...counts.values()].filter((count) => count > 0).length;
    target.textContent = `千葉県 ${state.areas.length}市町村 / 掲載エリア ${listedAreaCount}市`;
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
    initMapZoom(target);
  });

  const setLinkedHighlight = (areaId, active) => {
    $$(`[data-area-link="${CSS.escape(areaId)}"]`).forEach((item) => {
      item.classList.toggle("is-linked-highlight", active);
    });
  };

  const showStatus = (areaId) => {
    const area = getArea(areaId);
    const count = counts.get(areaId) || 0;
    statusTargets.forEach((target) => {
      target.textContent = `${area?.name || ""}${count ? `・掲載店舗 ${count}件` : "・掲載準備中"}`;
    });
  };

  const clearMobileAreaSelection = (mapTarget) => {
    const preview = mapTarget.querySelector("[data-area-selection-preview]");
    if (preview) preview.hidden = true;
    $$(".is-mobile-selected").forEach((item) => item.classList.remove("is-mobile-selected"));
    statusTargets.forEach((target) => {
      target.textContent = "市町村に触れると掲載状況を確認できます";
    });
  };

  const selectMobileArea = (areaId, mapTarget) => {
    const area = getArea(areaId);
    if (!area) return;
    $$(".is-mobile-selected").forEach((item) => {
      item.classList.remove("is-mobile-selected");
    });
    $$(`[data-area-link="${CSS.escape(areaId)}"]`).forEach((item) => {
      item.classList.add("is-mobile-selected");
    });
    const preview = mapTarget.querySelector("[data-area-selection-preview]");
    if (preview) {
      preview.innerHTML = createAreaPreviewHtml(area, counts);
      preview.hidden = false;
      preview.querySelector("[data-area-preview-close]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        clearMobileAreaSelection(mapTarget);
      });
    }
    showStatus(areaId);
  };

  mapTargets.forEach((mapTarget) => {
    mapTarget.addEventListener("click", (event) => {
      if (!isTouchMap()) return;
      if (event.target.closest("[data-area-link], [data-area-selection-preview]")) return;
      clearMobileAreaSelection(mapTarget);
    });
  });

  $$("[data-area-link]").forEach((link) => {
    const areaId = link.dataset.areaLink;
    const mapTarget = link.closest("[data-area-map]");
    const tooltip = mapTarget?.querySelector(".area-map-tooltip");
    const showLinkedState = () => {
      setLinkedHighlight(areaId, true);
      showStatus(areaId);
      if (tooltip && !isTouchMap()) {
        const area = getArea(areaId);
        const count = counts.get(areaId) || 0;
        tooltip.innerHTML = `<strong>${escapeHtml(area?.name || "")}</strong><span>${count ? `掲載店舗：${count}件` : "掲載準備中"}</span>`;
        const linkRect = link.getBoundingClientRect();
        const mapRect = mapTarget.getBoundingClientRect();
        tooltip.style.left = `${linkRect.left - mapRect.left + mapTarget.scrollLeft + linkRect.width / 2}px`;
        tooltip.style.top = `${linkRect.top - mapRect.top + linkRect.height / 2}px`;
        tooltip.hidden = false;
      }
    };
    const hideLinkedState = () => {
      setLinkedHighlight(areaId, false);
      if (tooltip) tooltip.hidden = true;
    };
    link.addEventListener("pointerenter", showLinkedState);
    link.addEventListener("pointerleave", hideLinkedState);
    link.addEventListener("focus", showLinkedState);
    link.addEventListener("blur", hideLinkedState);
    link.addEventListener("pointermove", (event) => {
      if (!tooltip || isTouchMap()) return;
      const rect = mapTarget.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - rect.left + mapTarget.scrollLeft + 14}px`;
      tooltip.style.top = `${event.clientY - rect.top + 14}px`;
    });
    if (mapTarget) {
      link.addEventListener("click", (event) => {
        if (!isTouchMap()) return;
        event.preventDefault();
        selectMobileArea(areaId, mapTarget);
      });
    }
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
        : "現在このエリアの掲載店舗は準備中です。",
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
        <small>${neighbor.storeCount ? `${neighbor.storeCount}件掲載` : "掲載準備中"}</small>
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
