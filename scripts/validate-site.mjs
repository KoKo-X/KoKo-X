import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const htmlFiles = [];

const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "tmp", "source-data"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    if (entry.isFile() && entry.name === "index.html") htmlFiles.push(target);
  }
};

await walk(rootDir);

const brokenLinks = [];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const originalUrl = match[1];
    const cleanUrl = originalUrl.split("?")[0].split("#")[0];
    if (!cleanUrl || /^(https?:|tel:|mailto:|data:)/.test(cleanUrl)) continue;

    let target = cleanUrl.startsWith("/")
      ? path.join(rootDir, cleanUrl)
      : path.resolve(path.dirname(file), cleanUrl);

    if (cleanUrl.endsWith("/") || !path.extname(target)) {
      target = path.join(target, "index.html");
    }
    if (!existsSync(target)) {
      brokenLinks.push({
        file: path.relative(rootDir, file),
        url: originalUrl,
        target: path.relative(rootDir, target),
      });
    }
  }
}

const areaDirs = (await readdir(path.join(rootDir, "chiba"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory());
const cityPages = [];

for (const directory of areaDirs) {
  const html = await readFile(path.join(rootDir, "chiba", directory.name, "index.html"), "utf8");
  cityPages.push({
    id: directory.name,
    title: html.match(/<title>(.*?)<\/title>/)?.[1] || "",
    h1: html.match(/<h1>(.*?)<\/h1>/)?.[1] || "",
    canonical: html.match(/rel="canonical" href="(.*?)"/)?.[1] || "",
    noindex: html.includes("noindex,follow"),
  });
}

const report = {
  htmlFiles: htmlFiles.length,
  brokenLinks,
  cityPages: cityPages.length,
  uniqueCityTitles: new Set(cityPages.map((page) => page.title)).size,
  uniqueCityH1s: new Set(cityPages.map((page) => page.h1)).size,
  cityCanonicals: cityPages.filter((page) => page.canonical).length,
  indexableCities: cityPages.filter((page) => !page.noindex).map((page) => page.id),
  noindexCities: cityPages.filter((page) => page.noindex).length,
};

const mapSvgPath = path.join(rootDir, "assets", "maps", "chiba.svg");
const mapSvg = existsSync(mapSvgPath) ? await readFile(mapSvgPath, "utf8") : "";
const mapAreaIds = [...mapSvg.matchAll(/<path id="area-([^"]+)"/g)].map((match) => match[1]);
const mapLinks = [...mapSvg.matchAll(/data-area-link="([^"]+)" href="\/chiba\/([^/]+)\//g)]
  .map((match) => ({ areaId: match[1], hrefAreaId: match[2] }));
const municipalityLabels = [...mapSvg.matchAll(/data-label-area="([^"]+)"/g)]
  .map((match) => match[1]);
report.map = {
  exists: Boolean(mapSvg),
  municipalityPaths: mapAreaIds.length,
  uniqueAreaIds: new Set(mapAreaIds).size,
  municipalityLinks: mapLinks.length,
  invalidLinks: mapLinks.filter((link) => link.areaId !== link.hrefAreaId),
  municipalityLabels,
  missingAreaIds: areaDirs
    .map((entry) => entry.name)
    .filter((areaId) => !mapAreaIds.includes(areaId)),
  hasAttribution: mapSvg.includes("出典：国土交通省 国土数値情報（行政区域データ）を加工して作成"),
};

console.log(JSON.stringify(report, null, 2));
if (
  brokenLinks.length
  || !report.map.exists
  || report.map.municipalityPaths !== 54
  || report.map.uniqueAreaIds !== 54
  || report.map.municipalityLinks !== 54
  || report.map.invalidLinks.length
  || report.map.municipalityLabels.length !== 54
  || new Set(report.map.municipalityLabels).size !== 54
  || report.map.missingAreaIds.length
  || !report.map.hasAttribution
) process.exitCode = 1;
