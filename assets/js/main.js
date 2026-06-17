const siteRootUrl = new URL("../../", document.currentScript.src);

const siteUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|tel:|mailto:)/.test(path)) return path;
  return new URL(path.replace(/^\//, ""), siteRootUrl).href;
};

const DATA_PATHS = {
  stores: siteUrl("data/stores.json"),
  categories: siteUrl("data/categories.json"),
};

const state = {
  stores: [],
  categories: [],
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
  const haystack = normalize([
    store.name,
    store.category,
    store.area,
    store.address,
    store.comment,
    store.tags?.join(" "),
  ].join(" "));
  return haystack.includes(query);
};

const createTagHtml = (tags = []) =>
  tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

const createActionsHtml = (store, compact = false) => {
  const telHref = toTelHref(store.phone);
  const mapButton = `<a class="button secondary" href="${escapeHtml(store.mapUrl)}" target="_blank" rel="noopener">Googleマップを見る</a>`;
  const phoneButton = telHref
    ? `<a class="button secondary" href="${escapeHtml(telHref)}">電話する</a>`
    : "";

  if (store.hasLp) {
    return `
      <div class="card-actions">
        <a class="button primary" href="${escapeHtml(siteUrl(store.lpUrl))}">詳しく見る</a>
        ${compact ? "" : mapButton}
        ${compact ? "" : phoneButton}
      </div>
    `;
  }

  return `
    <div class="card-actions">
      ${mapButton}
      ${phoneButton}
    </div>
  `;
};

const createStoreCard = (store, options = {}) => {
  const category = getCategory(store.category);
  const compact = Boolean(options.compact);
  const badges = store.hasLp
    ? `<span class="badge badge-lp">LPあり</span>`
    : `<span class="badge badge-basic">基本掲載</span>`;

  return `
    <article class="store-card ${compact ? "store-card-compact" : ""}">
      <div class="store-card-top">
        <span class="category-chip">${escapeHtml(category?.name || store.category)}</span>
        ${badges}
      </div>
      <h3>${escapeHtml(store.name)}</h3>
      <p class="store-comment">${escapeHtml(store.comment)}</p>
      <dl class="store-meta">
        <div><dt>エリア</dt><dd>${escapeHtml(store.area)}</dd></div>
        <div><dt>住所</dt><dd>${escapeHtml(store.address)}</dd></div>
        <div><dt>営業時間</dt><dd>${escapeHtml(store.hours)}</dd></div>
        <div><dt>定休日</dt><dd>${escapeHtml(store.closed)}</dd></div>
        <div><dt>電話番号</dt><dd>${escapeHtml(store.phone)}</dd></div>
      </dl>
      <div class="tag-list">${createTagHtml(store.tags)}</div>
      ${createActionsHtml(store, compact)}
    </article>
  `;
};

const renderEmpty = (target, message) => {
  target.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
};

const renderStores = (target, stores, options = {}) => {
  if (!target) return;
  if (!stores.length) {
    renderEmpty(target, "条件に合う店舗はまだありません。");
    return;
  }
  target.innerHTML = stores.map((store) => createStoreCard(store, options)).join("");
};

const loadData = async () => {
  const [storesResponse, categoriesResponse] = await Promise.all([
    fetch(DATA_PATHS.stores, { cache: "no-store" }),
    fetch(DATA_PATHS.categories, { cache: "no-store" }),
  ]);
  if (!storesResponse.ok || !categoriesResponse.ok) {
    throw new Error("data load failed");
  }
  state.stores = await storesResponse.json();
  state.categories = await categoriesResponse.json();
};

const initHeader = () => {
  const path = window.location.pathname;
  $$(".site-nav a").forEach((link) => {
    const href = new URL(link.getAttribute("href"), window.location.href).pathname;
    const active = href === siteRootUrl.pathname ? path === href : path.startsWith(href);
    link.classList.toggle("is-active", active);
  });
};

const initHome = () => {
  const categoryGrid = $("[data-categories-grid]");
  if (categoryGrid) {
    categoryGrid.innerHTML = state.categories
      .map((category) => `
        <a class="category-card" href="${escapeHtml(siteUrl(category.slug))}">
          <span>${escapeHtml(category.accent)}</span>
          <strong>${escapeHtml(category.name)}</strong>
          <small>${escapeHtml(category.summary)}</small>
        </a>
      `)
      .join("");
  }

  const categorySelect = $("[data-top-category-select]");
  if (categorySelect) {
    categorySelect.insertAdjacentHTML(
      "beforeend",
      state.categories
        .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
        .join("")
    );
  }

  renderStores(
    $("[data-featured-stores]"),
    state.stores.filter((store) => store.isFeatured),
    { compact: false }
  );
  renderStores($("[data-new-stores]"), sortStores(state.stores, "created").slice(0, 3), { compact: true });

  const form = $("[data-top-search]");
  const resultsWrap = $("[data-top-results-wrap]");
  const results = $("[data-top-results]");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const keyword = formData.get("q");
    const category = formData.get("category");

    if (category) {
      const categoryInfo = getCategory(category);
      const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
      window.location.href = `${siteUrl(categoryInfo.slug)}${query}`;
      return;
    }

    const filtered = state.stores.filter((store) => matchesKeyword(store, keyword));
    renderStores(results, filtered, { compact: true });
    resultsWrap.hidden = false;
    resultsWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("[data-clear-top-results]")?.addEventListener("click", () => {
    resultsWrap.hidden = true;
  });
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

  if (controls.area) {
    controls.area.innerHTML = buildOptionList(pageStores.map((store) => store.area), "すべてのエリア");
  }
  if (controls.tag) {
    controls.tag.innerHTML = buildOptionList(pageStores.flatMap((store) => store.tags || []), "すべてのタグ");
  }
  if (controls.keyword) controls.keyword.value = params.get("q") || "";
  if (controls.tag && params.get("tag")) controls.tag.value = params.get("tag");

  const applyFilters = () => {
    const keyword = controls.keyword?.value || "";
    const area = controls.area?.value || "";
    const tag = controls.tag?.value || "";
    const lpOnly = Boolean(controls.lpOnly?.checked);
    const sortKey = controls.sort?.value || "created";

    const filtered = pageStores.filter((store) => {
      if (!matchesKeyword(store, keyword)) return false;
      if (area && store.area !== area) return false;
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

  if (!document.body.matches("[data-page='home'], [data-page='category']")) return;

  try {
    await loadData();
    initHome();
    initCategoryPage();
  } catch (error) {
    const targets = $$("[data-featured-stores], [data-new-stores], [data-category-stores], [data-categories-grid]");
    targets.forEach((target) => renderEmpty(target, "店舗データを読み込めませんでした。"));
    console.error(error);
  }
});
