import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const canonicalBase = "https://andynova821.github.io/Portal";

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(rootDir, relativePath), "utf8"));

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const stores = await readJson("data/stores.json");
const categories = await readJson("data/categories.json");
const sourceAreas = await readJson("data/areas.json");

const areas = sourceAreas.map((area) => {
  const storeCount = stores.filter((store) => store.areaId === area.id).length;
  const neighbors = sourceAreas
    .filter((candidate) => candidate.id !== area.id)
    .map((candidate) => ({
      id: candidate.id,
      distance: Math.hypot(candidate.mapX - area.mapX, candidate.mapY - area.mapY),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4)
    .map((candidate) => candidate.id);

  return {
    ...area,
    prefectureId: "chiba",
    url: `/chiba/${area.id}/`,
    description: `${area.name}のお店案内`,
    neighbors,
    storeCount,
    hasStores: storeCount > 0,
    isIndexable: storeCount > 0,
    metaTitle: `${area.name}のお店案内 | まちの手ざわりポータル`,
    metaDescription: `${area.name}のお店を探せる案内ページ。行く前に雰囲気や人柄、このお店のポイントまで確認できます。`,
  };
});

await writeFile(
  path.join(rootDir, "data/areas.json"),
  `${JSON.stringify(areas, null, 2)}\n`,
  "utf8"
);

const header = (prefix) => `
  <header class="site-header">
    <a class="brand" href="${prefix}" aria-label="まちの手ざわりポータルトップ">
      <span class="brand-mark" aria-hidden="true">ま</span>
      <span>まちの手ざわりポータル</span>
    </a>
    <nav class="site-nav" aria-label="主要メニュー">
      <a href="${prefix}">トップ</a>
      <a href="${prefix}chiba/">千葉県から探す</a>
      <a href="${prefix}bike/">バイク・車</a>
      <a href="${prefix}lounge/">バー・ラウンジ</a>
      <a href="${prefix}construction/">建築・職人</a>
      <a href="${prefix}for-shops/">掲載希望の方</a>
      <a href="${prefix}contact/">問い合わせ</a>
    </nav>
  </header>`;

const footer = (prefix) => `
  <footer class="site-footer">
    <p>まちの手ざわりポータル</p>
    <nav aria-label="フッターメニュー">
      <a href="${prefix}chiba/">千葉県のお店案内</a>
      <a href="${prefix}for-shops/">掲載希望の方</a>
      <a href="${prefix}contact/">問い合わせ</a>
    </nav>
  </footer>`;

const categoryCards = categories.map((category) => `
        <a class="category-card" href="../${category.slug}">
          <span>${escapeHtml(category.accent)}</span>
          <strong>${escapeHtml(category.name)}</strong>
          <small>${escapeHtml(category.summary)}</small>
        </a>`).join("");

const chibaHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="千葉県のお店を市町村やカテゴリから探せる案内ページ。行く前に雰囲気や人柄、このお店のポイントまで確認できます。">
  <meta property="og:title" content="千葉県のお店案内 | まちの手ざわりポータル">
  <meta property="og:description" content="千葉県のお店を市町村やカテゴリから探せる案内ページ。">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${canonicalBase}/chiba/">
  <title>千葉県のお店案内 | まちの手ざわりポータル</title>
  <link rel="stylesheet" href="../assets/css/style.css?v=map-ui-6">
  <script src="../assets/js/main.js?v=map-ui-6" defer></script>
</head>
<body data-page="prefecture" data-prefecture-id="chiba">
${header("../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../">トップ</a><span aria-hidden="true">/</span><span>千葉県のお店案内</span>
    </nav>

    <section class="area-directory-hero">
      <div>
        <p class="eyebrow">Chiba shop guide</p>
        <h1>千葉県のお店案内</h1>
        <p>市町村やカテゴリから、気になるお店を探せます。行く前に雰囲気や人柄、このお店のポイントまで確認できます。</p>
      </div>
      <a class="button secondary" href="../">トップページへ戻る</a>
    </section>

    <section class="section area-discovery-section" aria-labelledby="chiba-map-heading">
      <div class="section-heading with-action">
        <div>
          <p class="eyebrow">Municipalities</p>
          <h2 id="chiba-map-heading">市町村から探す</h2>
          <p class="section-lead">地図の市町村エリア、または一覧から選んでください。</p>
        </div>
        <span class="area-summary" data-area-summary>市町村情報を読み込み中</span>
      </div>
      <div class="area-discovery-layout">
        <div class="area-map-panel">
          <div class="area-map-toolbar">
            <strong>千葉県エリアマップ</strong>
            <output data-area-map-status aria-live="polite">市町村に触れると掲載状況を確認できます</output>
          </div>
          <div class="area-map-viewport" data-area-map></div>
          <p class="area-map-note">出典：国土交通省 国土数値情報（行政区域データ）を加工して作成</p>
        </div>
        <aside class="area-list-panel" aria-labelledby="area-list-title">
          <div class="area-list-heading">
            <p class="eyebrow">Area list</p>
            <h3 id="area-list-title">市町村名から探す</h3>
            <p>掲載中のエリアを先に表示し、全市町村は折りたたんで確認できます。</p>
          </div>
          <div class="area-list" data-area-list></div>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">Categories</p>
        <h2>カテゴリから探す</h2>
      </div>
      <div class="category-grid" data-prefecture-categories>${categoryCards}</div>
    </section>

    <section class="section band-section">
      <div class="section-heading">
        <p class="eyebrow">New shops</p>
        <h2>千葉県の新着掲載店舗</h2>
      </div>
      <div class="store-grid compact-grid" data-prefecture-new-stores></div>
    </section>

    <section class="section cta-strip">
      <div>
        <p class="eyebrow">For shops</p>
        <h2>千葉県で掲載を希望するお店・事業者の方へ</h2>
        <p>基本掲載や店舗専用LPについて相談できます。</p>
      </div>
      <a class="button primary" href="../for-shops/">掲載メニューを見る</a>
    </section>
  </main>
${footer("../")}
</body>
</html>
`;

await mkdir(path.join(rootDir, "chiba"), { recursive: true });
await writeFile(path.join(rootDir, "chiba/index.html"), chibaHtml, "utf8");

for (const area of areas) {
  const robots = area.isIndexable ? "" : '  <meta name="robots" content="noindex,follow">\n';
  const lead = `${area.name}のお店を地域やカテゴリから探せます。初めてのお店選びに、少しの安心を届ける案内ページです。`;
  const cityHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(area.metaDescription)}">
${robots}  <meta property="og:title" content="${escapeHtml(area.metaTitle)}">
  <meta property="og:description" content="${escapeHtml(area.metaDescription)}">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${canonicalBase}${area.url}">
  <title>${escapeHtml(area.metaTitle)}</title>
  <link rel="stylesheet" href="../../assets/css/style.css?v=map-ui-6">
  <script src="../../assets/js/main.js?v=map-ui-6" defer></script>
</head>
<body data-page="area" data-prefecture-id="chiba" data-area-id="${escapeHtml(area.id)}">
${header("../../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../../">トップ</a><span aria-hidden="true">/</span>
      <a href="../">千葉県のお店案内</a><span aria-hidden="true">/</span>
      <span>${escapeHtml(area.name)}</span>
    </nav>

    <section class="area-directory-hero area-city-hero">
      <div>
        <p class="eyebrow">Chiba / ${escapeHtml(area.id)}</p>
        <h1>${escapeHtml(area.name)}のお店案内</h1>
        <p>${escapeHtml(lead)}</p>
      </div>
      <div class="area-hero-actions">
        <span class="result-count" data-area-page-count>${area.storeCount}件</span>
        <a class="button secondary" href="../">千葉県全体へ戻る</a>
      </div>
    </section>

    <section class="section area-page-layout">
      <div class="area-page-content">
        <div class="section-heading">
          <p class="eyebrow">Shops</p>
          <h2>${escapeHtml(area.name)}の掲載店舗</h2>
        </div>
        <div class="area-filter-panel">
          <label class="field">
            <span>キーワード</span>
            <input type="search" data-area-filter-keyword placeholder="店名、サービス、タグ">
          </label>
          <label class="field">
            <span>カテゴリ</span>
            <select data-area-filter-category></select>
          </label>
          <label class="field">
            <span>並び替え</span>
            <select data-area-filter-sort>
              <option value="created">新着順</option>
              <option value="name">店名順</option>
            </select>
          </label>
        </div>
        <div class="store-grid area-store-grid" data-area-page-stores></div>
      </div>

      <aside class="area-mini-map-panel">
        <div class="area-mini-map-heading">
          <p class="eyebrow">Location</p>
          <h2>千葉県内の${escapeHtml(area.name)}</h2>
          <p>選択中の市町村を緑色で表示しています。</p>
        </div>
        <div class="area-map-viewport area-mini-map" data-area-map data-selected-area="${escapeHtml(area.id)}"></div>
        <p class="area-map-note">出典：国土交通省 国土数値情報（行政区域データ）を加工して作成</p>
        <a class="text-link" href="../">千葉県全体のマップを見る</a>
      </aside>
    </section>

    <section class="section neighbor-section">
      <div class="section-heading">
        <p class="eyebrow">Nearby areas</p>
        <h2>近隣の市町村</h2>
      </div>
      <div class="neighbor-grid" data-area-neighbors></div>
    </section>

    <section class="section cta-strip">
      <div>
        <p class="eyebrow">For shops</p>
        <h2>${escapeHtml(area.name)}で掲載を希望するお店・事業者の方へ</h2>
        <p>基本掲載や店舗専用LPについて相談できます。</p>
      </div>
      <a class="button primary" href="../../for-shops/">掲載メニューを見る</a>
    </section>
  </main>
${footer("../../")}
</body>
</html>
`;
  const areaDir = path.join(rootDir, "chiba", area.id);
  await mkdir(areaDir, { recursive: true });
  await writeFile(path.join(areaDir, "index.html"), cityHtml, "utf8");
}

const sitemapPaths = [
  "/",
  "/chiba/",
  ...areas.filter((area) => area.isIndexable).map((area) => area.url),
  "/bike/",
  "/lounge/",
  "/construction/",
  "/bike/yamagenmotors/",
  "/for-shops/",
  "/contact/",
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPaths.map((urlPath) => `  <url>
    <loc>${canonicalBase}${urlPath}</loc>
  </url>`).join("\n")}
</urlset>
`;

await writeFile(path.join(rootDir, "sitemap.xml"), sitemapXml, "utf8");
await writeFile(
  path.join(rootDir, "robots.txt"),
  `User-agent: *
Allow: /
Disallow: /design-samples/
Disallow: /engine-scroll-test/
Disallow: /engine-optimization-test/
Disallow: /engine-webgl-test/

Sitemap: ${canonicalBase}/sitemap.xml
`,
  "utf8"
);

console.log(`Generated ${areas.length} city pages, chiba/index.html, sitemap.xml and robots.txt.`);
