import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const canonicalBase = "https://koko-x.github.io/KoKo-X";

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
const siteVersion = "v2-11";

const mapRegionGroups = [
  { id: "chiba", name: "千葉", reading: "ちば", areas: ["chiba", "ichihara"], labelX: 228, labelY: 447 },
  { id: "katsunan", name: "葛南", reading: "かつなん", areas: ["ichikawa", "funabashi", "narashino", "yachiyo", "urayasu"], labelX: 156, labelY: 319 },
  { id: "higashikatsushika", name: "東葛飾", reading: "ひがしかつしか", areas: ["matsudo", "noda", "kashiwa", "nagareyama", "abiko", "kamagaya"], labelX: 169, labelY: 210 },
  { id: "inba", name: "印旛", reading: "いんば", areas: ["narita", "sakura", "yotsukaido", "yachimata", "inzai", "shiroi", "tomisato", "shisui", "sakae"], labelX: 333, labelY: 276 },
  { id: "katori", name: "香取", reading: "かとり", areas: ["katori", "kozaki", "tako", "tounosho"], labelX: 485, labelY: 205 },
  { id: "kaiso", name: "海匝", reading: "かいそう", areas: ["choshi", "asahi", "sosa"], labelX: 596, labelY: 300 },
  { id: "sanbu", name: "山武", reading: "さんぶ", areas: ["togane", "sanmu", "oamishirasato", "kujukuri", "shibayama", "yokoshibahikari"], labelX: 458, labelY: 397 },
  { id: "chosei", name: "長生", reading: "ちょうせい", areas: ["mobara", "ichinomiya", "mutsuzawa", "chosei", "shirako", "nagara", "chonan"], labelX: 365, labelY: 525 },
  { id: "isumi", name: "夷隅", reading: "いすみ", areas: ["katsuura", "isumi", "otaki", "onjuku"], labelX: 371, labelY: 644 },
  { id: "awa", name: "安房", reading: "あわ", areas: ["tateyama", "kamogawa", "minamiboso", "kyonan"], labelX: 172, labelY: 790 },
  { id: "kimitsu", name: "君津", reading: "きみつ", areas: ["kisarazu", "kimitsu", "futtsu", "sodegaura"], labelX: 170, labelY: 550 },
];

const prefectures = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府",
  "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県",
  "大分県", "宮崎県", "鹿児島県", "沖縄県",
].map((name, index) => ({
  id: index === 11 ? "chiba" : `pref-${index + 1}`,
  name,
  enabled: index === 11,
  url: index === 11 ? "/chiba/" : "",
}));

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
    metaTitle: `${area.name}のお店案内 | KoKo X（ココクロス）`,
    metaDescription: `KoKo X（ココクロス）で${area.name}のお店を探せる案内ページ。行く前に雰囲気や人柄、KoKoポイントまで確認できます。`,
  };
});

const getRegionAreas = (region) => region.areas.map((areaId) => areas.find((area) => area.id === areaId)).filter(Boolean);
const getRegionStoreCount = (region) => stores.filter((store) => region.areas.includes(store.areaId)).length;

await writeFile(
  path.join(rootDir, "data/areas.json"),
  `${JSON.stringify(areas, null, 2)}\n`,
  "utf8"
);

const header = (prefix) => `
  <header class="site-header">
    <a class="brand" href="${prefix}" aria-label="KoKo X トップ">
      <span class="brand-mark" aria-hidden="true">K</span>
      <span class="brand-lockup"><strong class="brand-name">KoKo <span class="brand-x">X</span></strong><small>ココクロス</small></span>
    </a>
    <nav class="site-nav" aria-label="主要メニュー">
      <a href="${prefix}">トップ</a>
      <a href="${prefix}prefectures/" data-nav-prefectures>都道府県で探す</a>
      <a href="${prefix}bike/">バイク・車</a>
      <a href="${prefix}food/">飲食店</a>
      <a href="${prefix}construction/">建築・職人</a>
      <a href="${prefix}for-shops/">掲載希望の方</a>
      <a href="${prefix}contact/">問い合わせ</a>
    </nav>
  </header>`;

const footer = (prefix) => `
  <footer class="site-footer">
    <p>KoKo X <span aria-hidden="true">─</span> ココクロス</p>
    <nav aria-label="フッターメニュー">
      <a href="${prefix}prefectures/">都道府県で探す</a>
      <a href="${prefix}chiba/">千葉県のお店案内</a>
      <a href="${prefix}for-shops/">掲載希望の方</a>
      <a href="${prefix}contact/">問い合わせ</a>
      <a href="${prefix}privacy/">プライバシーポリシー</a>
      <a href="${prefix}terms/">利用規約</a>
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
  <meta name="description" content="KoKo X（ココクロス）の都道府県別お店案内。現在は千葉県の市町村・地域・カテゴリから掲載店舗を探せます。">
  <meta property="og:title" content="千葉県のお店案内 | 都道府県で探す | KoKo X">
  <meta property="og:description" content="都道府県別のお店案内テンプレート。現在は千葉県の地域から探せます。">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${canonicalBase}/chiba/">
  <title>千葉県のお店案内 | 都道府県で探す | KoKo X（ココクロス）</title>
  <link rel="stylesheet" href="./style.css?v=${siteVersion}">
  <script src="../assets/js/main.js?v=${siteVersion}" defer></script>
</head>
<body data-page="prefecture" data-prefecture-id="chiba">
${header("../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../">トップ</a><span aria-hidden="true">/</span>
      <a href="../prefectures/">都道府県で探す</a><span aria-hidden="true">/</span><span>千葉県</span>
    </nav>

    <section class="area-directory-hero">
      <div>
        <p class="eyebrow">Prefecture / Chiba</p>
        <h1>都道府県で探す。まずは千葉県から。</h1>
        <p>現在は千葉県の市町村・地域・カテゴリから探せます。他の都道府県は選択できるひな型だけ用意しています。</p>
      </div>
      <a class="button secondary" href="../prefectures/">都道府県一覧へ戻る</a>
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

    <section class="section home-panel-section">
      <div class="home-section-panel">
        <div class="section-heading">
          <p class="eyebrow">Categories</p>
          <h2>カテゴリから探す</h2>
        </div>
        <div class="category-grid category-tile-grid" data-prefecture-categories>${categoryCards}</div>
      </div>
    </section>

    <section class="section band-section home-panel-section">
      <div class="home-section-panel">
        <div class="section-heading">
          <p class="eyebrow">New shops</p>
          <h2>千葉県の新着掲載店舗</h2>
        </div>
        <div class="store-grid compact-grid" data-prefecture-new-stores></div>
      </div>
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
  const lead = `KoKo Xで${area.name}のお店を地域やカテゴリから探せます。行く前に雰囲気や人柄、KoKoポイントが少し見える案内ページです。`;
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
  <link rel="stylesheet" href="../style.css?v=${siteVersion}">
  <script src="../../assets/js/main.js?v=${siteVersion}" defer></script>
</head>
<body data-page="area" data-prefecture-id="chiba" data-area-id="${escapeHtml(area.id)}">
${header("../../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../../">トップ</a><span aria-hidden="true">/</span>
      <a href="../../prefectures/">都道府県で探す</a><span aria-hidden="true">/</span>
      <a href="../">千葉県</a><span aria-hidden="true">/</span>
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

const regionRoot = path.join(rootDir, "chiba", "regions");
await mkdir(regionRoot, { recursive: true });
for (const region of mapRegionGroups) {
  const regionAreas = getRegionAreas(region);
  const storeCount = getRegionStoreCount(region);
  const robots = storeCount ? "" : '  <meta name="robots" content="noindex,follow">\n';
  const regionHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="KoKo X（ココクロス）で千葉県${escapeHtml(region.name)}地域の掲載店舗を探せます。地域内の市区町村や近隣地域も確認できます。">
${robots}  <meta property="og:title" content="千葉県${escapeHtml(region.name)}地域のお店案内 | KoKo X（ココクロス）">
  <meta property="og:description" content="千葉県${escapeHtml(region.name)}地域の掲載店舗、市区町村、近隣地域を確認できる案内ページ。">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${canonicalBase}/chiba/regions/${region.id}/">
  <title>千葉県${escapeHtml(region.name)}地域のお店案内 | KoKo X（ココクロス）</title>
  <link rel="stylesheet" href="../../style.css?v=${siteVersion}">
  <script src="../../../assets/js/main.js?v=${siteVersion}" defer></script>
</head>
<body data-page="region" data-prefecture-id="chiba" data-region-id="${escapeHtml(region.id)}">
${header("../../../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../../../">トップ</a><span aria-hidden="true">/</span>
      <a href="../../../prefectures/">都道府県で探す</a><span aria-hidden="true">/</span>
      <a href="../../">千葉県</a><span aria-hidden="true">/</span>
      <span>${escapeHtml(region.name)}地域</span>
    </nav>

    <section class="area-directory-hero area-city-hero">
      <div>
        <p class="eyebrow">Chiba region / ${escapeHtml(region.id)}</p>
        <h1>${escapeHtml(region.name)}地域のお店案内</h1>
        <p>${escapeHtml(regionAreas.map((area) => area.name).join("・"))}を含む地域ページです。掲載店舗、地域内の市区町村、近隣地域をまとめて確認できます。</p>
      </div>
      <div class="area-hero-actions">
        <span class="result-count" data-region-page-count>${storeCount}件</span>
        <a class="button secondary" href="../../">千葉県全体へ戻る</a>
      </div>
    </section>

    <section class="section area-page-layout">
      <div class="area-page-content">
        <div class="section-heading">
          <p class="eyebrow">Shops</p>
          <h2>${escapeHtml(region.name)}地域の掲載店舗</h2>
        </div>
        <div class="area-filter-panel">
          <label class="field">
            <span>キーワード</span>
            <input type="search" data-region-filter-keyword placeholder="店名、サービス、タグ">
          </label>
          <label class="field">
            <span>カテゴリ</span>
            <select data-region-filter-category></select>
          </label>
          <label class="field">
            <span>並び替え</span>
            <select data-region-filter-sort>
              <option value="created">新着順</option>
              <option value="name">店名順</option>
            </select>
          </label>
        </div>
        <div class="store-grid area-store-grid" data-region-page-stores></div>
      </div>
    </section>

    <section class="section neighbor-section">
      <div class="section-heading">
        <p class="eyebrow">Municipalities</p>
        <h2>この地域の市区町村</h2>
      </div>
      <div class="neighbor-grid" data-region-areas></div>
    </section>

    <section class="section neighbor-section">
      <div class="section-heading">
        <p class="eyebrow">Nearby regions</p>
        <h2>近隣の地域</h2>
      </div>
      <div class="neighbor-grid" data-region-neighbors></div>
    </section>

    <section class="section cta-strip">
      <div>
        <p class="eyebrow">For shops</p>
        <h2>${escapeHtml(region.name)}地域で掲載を希望するお店・事業者の方へ</h2>
        <p>基本掲載や店舗専用LPについて相談できます。</p>
      </div>
      <a class="button primary" href="../../../for-shops/">掲載メニューを見る</a>
    </section>
  </main>
${footer("../../../")}
</body>
</html>
`;
  const regionDir = path.join(regionRoot, region.id);
  await mkdir(regionDir, { recursive: true });
  await writeFile(path.join(regionDir, "index.html"), regionHtml, "utf8");
}

const prefectureButtons = prefectures.map((prefecture) => `
          <button class="prefecture-option${prefecture.enabled ? " is-active" : ""}" type="button" data-prefecture-option="${escapeHtml(prefecture.id)}" aria-pressed="${prefecture.enabled ? "true" : "false"}">
            <span>${escapeHtml(prefecture.name)}</span>
            <small>${prefecture.enabled ? "公開中" : "準備中"}</small>
          </button>`).join("");
const prefecturePanels = prefectures.map((prefecture) => `
        <article class="prefecture-panel${prefecture.enabled ? " is-active" : ""}" data-prefecture-panel="${escapeHtml(prefecture.id)}"${prefecture.enabled ? "" : " hidden"}>
          <p class="eyebrow">${prefecture.enabled ? "Available" : "Coming soon"}</p>
          <h2>${escapeHtml(prefecture.name)}</h2>
          <p>${prefecture.enabled ? `${prefecture.name}は市町村マップと地域別ページを公開中です。` : `${prefecture.name}の掲載店舗ページは準備中です。公開時は同じ構造で市区町村や地域から探せるようにします。`}</p>
          ${prefecture.enabled ? `<a class="button primary" href="../chiba/">${escapeHtml(prefecture.name)}のお店を探す</a>` : `<span class="button secondary is-disabled" aria-disabled="true">準備中</span>`}
        </article>`).join("");

const prefecturesHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="KoKo X（ココクロス）の都道府県別お店案内。現在は千葉県を公開中です。">
  <meta property="og:title" content="都道府県で探す | KoKo X">
  <meta property="og:description" content="都道府県別に地域のお店を探す入口ページです。">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${canonicalBase}/prefectures/">
  <title>都道府県で探す | KoKo X（ココクロス）</title>
  <link rel="stylesheet" href="./style.css?v=${siteVersion}">
  <script src="../assets/js/main.js?v=${siteVersion}" defer></script>
</head>
<body data-page="prefectures">
${header("../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../">トップ</a><span aria-hidden="true">/</span><span>都道府県で探す</span>
    </nav>

    <section class="prefecture-hero">
      <div>
        <p class="eyebrow">Prefectures</p>
        <h1>都道府県で探す</h1>
        <p>今は千葉県だけ公開中です。他の都道府県も同じ入口から選択できるように、ひな型として置いています。</p>
      </div>
      <a class="button primary" href="../chiba/">千葉県のお店を探す</a>
    </section>

    <section class="section prefecture-directory" aria-labelledby="prefecture-directory-title">
      <div class="section-heading">
        <p class="eyebrow">Select</p>
        <h2 id="prefecture-directory-title">都道府県を選択</h2>
        <p class="section-lead">公開中の都道府県は詳細ページへ進めます。準備中の都道府県も選択状態の確認だけできます。</p>
      </div>
      <div class="prefecture-directory-layout">
        <div class="prefecture-options" data-prefecture-selector>${prefectureButtons}</div>
        <div class="prefecture-panels">${prefecturePanels}</div>
      </div>
    </section>
  </main>
${footer("../")}
</body>
</html>
`;

await mkdir(path.join(rootDir, "prefectures"), { recursive: true });
await writeFile(path.join(rootDir, "prefectures", "index.html"), prefecturesHtml, "utf8");

const legalPages = [
  {
    dir: "privacy",
    title: "プライバシーポリシー",
    description: "KoKo X（ココクロス）のプライバシーポリシーひな形です。",
    body: `
      <p>このページは、KoKo X（ココクロス）の運営に必要となるプライバシーポリシーのひな形です。正式公開前に、運営者情報、問い合わせ先、利用する外部サービス、取得する情報の範囲に合わせて編集してください。</p>
      <h2>取得する情報</h2>
      <p>お問い合わせや掲載相談の際に、氏名、店舗名、メールアドレス、電話番号、相談内容などを取得する場合があります。</p>
      <h2>利用目的</h2>
      <p>取得した情報は、お問い合わせへの返信、掲載相談、サイト運営上必要な連絡、サービス改善のために利用します。</p>
      <h2>第三者提供</h2>
      <p>法令に基づく場合を除き、本人の同意なく個人情報を第三者へ提供しません。</p>
      <h2>アクセス解析等</h2>
      <p>アクセス解析ツールや外部サービスを導入する場合は、利用するサービス名、取得情報、オプトアウト方法を追記してください。</p>
      <h2>お問い合わせ</h2>
      <p>個人情報の開示、訂正、削除、利用停止に関する問い合わせ先は、正式な運営者情報に合わせて追記してください。</p>
    `,
  },
  {
    dir: "terms",
    title: "利用規約",
    description: "KoKo X（ココクロス）の利用規約ひな形です。",
    body: `
      <p>このページは、KoKo X（ココクロス）の利用規約ひな形です。正式公開前に、掲載審査、免責事項、禁止事項、運営者情報に合わせて編集してください。</p>
      <h2>サイトの目的</h2>
      <p>本サイトは、地域のお店や事業者の情報を紹介し、利用者がお店を探しやすくすることを目的とします。</p>
      <h2>掲載情報について</h2>
      <p>掲載情報は確認時点の内容です。営業時間、定休日、料金、サービス内容などは変更される場合があります。来店前に店舗へ確認してください。</p>
      <h2>禁止事項</h2>
      <p>本サイトの情報を不正に利用する行為、第三者の権利を侵害する行為、サイト運営を妨げる行為を禁止します。</p>
      <h2>免責事項</h2>
      <p>本サイトの利用により発生した損害について、運営者は法令で認められる範囲で責任を負いません。</p>
      <h2>規約の変更</h2>
      <p>本規約は必要に応じて変更することがあります。変更後の内容は本ページに掲載した時点で効力を持つものとします。</p>
    `,
  },
];

for (const page of legalPages) {
  const legalHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(page.description)}">
  <link rel="canonical" href="${canonicalBase}/${page.dir}/">
  <title>${escapeHtml(page.title)} | KoKo X（ココクロス）</title>
  <link rel="stylesheet" href="../static.css?v=${siteVersion}">
  <script src="../assets/js/main.js?v=${siteVersion}" defer></script>
</head>
<body data-page="static">
${header("../")}
  <main>
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <a href="../">トップ</a><span aria-hidden="true">/</span><span>${escapeHtml(page.title)}</span>
    </nav>
    <section class="section legal-page">
      <div class="section-heading">
        <p class="eyebrow">Template</p>
        <h1>${escapeHtml(page.title)}</h1>
      </div>
      <div class="legal-content">${page.body}</div>
    </section>
  </main>
${footer("../")}
</body>
</html>
`;
  await mkdir(path.join(rootDir, page.dir), { recursive: true });
  await writeFile(path.join(rootDir, page.dir, "index.html"), legalHtml, "utf8");
}

const sitemapPaths = [
  "/",
  "/prefectures/",
  "/chiba/",
  ...mapRegionGroups
    .filter((region) => getRegionStoreCount(region) > 0)
    .map((region) => `/chiba/regions/${region.id}/`),
  ...areas.filter((area) => area.isIndexable).map((area) => area.url),
  "/bike/",
  "/food/",
  "/construction/",
  "/bike/yamagenmotors/",
  "/for-shops/",
  "/contact/",
  "/privacy/",
  "/terms/",
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

console.log(`Generated ${areas.length} city pages, ${mapRegionGroups.length} region pages, prefectures, legal pages, chiba/index.html, sitemap.xml and robots.txt.`);
