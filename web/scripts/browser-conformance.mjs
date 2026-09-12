import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {chromium, firefox, webkit} from "playwright";
import {
  compareLayoutDifferentialFixture,
  createLayoutDifferentialCorpus,
} from "../lib/layout-differential-corpus.ts";
import {
  generateLayoutDifferentialCases,
  materializeGeneratedLayoutFixture,
  minimizeGeneratedLayoutMismatchAsync,
} from "../lib/layout-differential-generated.ts";
import {
  corpusReplay,
  createBrowserConformanceEvidence,
  generatedReplay,
} from "../lib/layout-differential-evidence.ts";

const browserName = process.env.BROWSER ?? "chromium";
const browserTypes = {chromium, firefox, webkit};
if (!(browserName in browserTypes)) {
  throw new Error(`unsupported browser conformance engine: ${browserName}`);
}

const generatedSeed = Number(process.env.LAYOUT_CONFORMANCE_SEED ?? "12648430");
const generatedCount = Number(process.env.LAYOUT_CONFORMANCE_CASES ?? "16");
if (!Number.isInteger(generatedCount) || generatedCount < 0 || generatedCount > 128) {
  throw new Error("LAYOUT_CONFORMANCE_CASES must be an integer between 0 and 128");
}
const evidenceDirectory = process.env.LAYOUT_CONFORMANCE_EVIDENCE_DIR
  ?? path.join("browser-evidence", browserName);

const unitlessProperties = new Set([
  "gridColumn",
  "gridRow",
  "zIndex",
  "order",
  "flexGrow",
  "flexShrink",
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function cssPropertyName(property) {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function cssValue(property, value) {
  if (typeof value !== "number") return String(value);
  if (value === 0 || unitlessProperties.has(property)) return String(value);
  return `${value}px`;
}

function styleText(style) {
  return Object.entries(style)
    .map(([property, value]) => `${cssPropertyName(property)}:${cssValue(property, value)}`)
    .join(";");
}

function renderNode(node) {
  return `<div data-layout-engine-node="${escapeHtml(node.id)}" style="${escapeHtml(styleText(node.style))}">${node.children.map(renderNode).join("")}</div>`;
}

function fixtureHtml(fixture) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}body{display:flow-root;}</style></head><body>${renderNode(fixture.browserTree)}</body></html>`;
}

async function measureFixture(page, fixture) {
  await page.setContent(fixtureHtml(fixture), {waitUntil: "load"});
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
  return page.evaluate((rootId) => {
    const root = [...document.querySelectorAll("[data-layout-engine-node]")]
      .find((element) => element.getAttribute("data-layout-engine-node") === rootId);
    if (!(root instanceof HTMLElement)) throw new Error(`missing browser fixture root: ${rootId}`);
    const origin = root.getBoundingClientRect();
    return [...document.querySelectorAll("[data-layout-engine-node]")].map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error("layout fixture contains a non-HTMLElement node");
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.layoutEngineNode ?? "",
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      };
    });
  }, fixture.browserTree.id);
}

function summarizeComparisons(comparisons) {
  return {
    matches: comparisons.every((comparison) => comparison.matches),
    maximumDelta: comparisons.reduce((maximum, comparison) => Math.max(maximum, comparison.maximumDelta), 0),
    mismatchingIds: comparisons.filter((comparison) => !comparison.matches).map((comparison) => comparison.id),
  };
}

async function writeJson(fileName, value) {
  await mkdir(evidenceDirectory, {recursive: true});
  await writeFile(path.join(evidenceDirectory, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const browserType = browserTypes[browserName];
const browser = await browserType.launch({headless: true});
const browserVersion = browser.version();
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
const browserIdentity = {engine: browserName, version: browserVersion};
const results = [];
let mismatchCount = 0;

try {
  for (const fixture of createLayoutDifferentialCorpus()) {
    const browserGeometry = await measureFixture(page, fixture);
    const comparisons = compareLayoutDifferentialFixture(fixture, browserGeometry);
    const summary = summarizeComparisons(comparisons);
    results.push({type: "corpus", id: fixture.id, input: fixture.input, ...summary});
    if (!summary.matches) {
      mismatchCount += 1;
      const evidence = createBrowserConformanceEvidence({
        fixture,
        replay: corpusReplay(fixture),
        browser: browserIdentity,
        browserGeometry,
      });
      await writeJson(`mismatch-${fixture.id}-${evidence.fingerprint}.json`, evidence);
    }
  }

  const generatedCases = generateLayoutDifferentialCases(generatedSeed, generatedCount);
  for (const layoutCase of generatedCases) {
    const fixture = materializeGeneratedLayoutFixture(layoutCase);
    const browserGeometry = await measureFixture(page, fixture);
    const comparisons = compareLayoutDifferentialFixture(fixture, browserGeometry);
    const summary = summarizeComparisons(comparisons);
    results.push({
      type: "generated",
      id: layoutCase.id,
      replayKey: layoutCase.replayKey,
      input: {innerSize: layoutCase.innerSize, gapSize: layoutCase.gapSize},
      ...summary,
    });
    if (summary.matches) continue;

    mismatchCount += 1;
    const minimized = await minimizeGeneratedLayoutMismatchAsync(layoutCase, async (candidate) => {
      const candidateFixture = materializeGeneratedLayoutFixture(candidate);
      const candidateGeometry = await measureFixture(page, candidateFixture);
      return !compareLayoutDifferentialFixture(candidateFixture, candidateGeometry)
        .every((comparison) => comparison.matches);
    });
    const minimizedFixture = materializeGeneratedLayoutFixture(minimized.minimized);
    const minimizedGeometry = await measureFixture(page, minimizedFixture);
    const evidence = createBrowserConformanceEvidence({
      fixture: minimizedFixture,
      replay: generatedReplay(minimized.minimized, {
        originalReplayKey: layoutCase.replayKey,
        minimizationAttempts: minimized.attemptedCases,
      }),
      browser: browserIdentity,
      browserGeometry: minimizedGeometry,
    });
    await writeJson(`mismatch-${minimized.minimized.id}-${evidence.fingerprint}.json`, evidence);
  }
} finally {
  await browser.close();
}

const runSummary = {
  schemaVersion: "layout-browser-run-v1",
  browser: browserIdentity,
  generator: {
    seed: generatedSeed >>> 0,
    count: generatedCount,
  },
  resultCount: results.length,
  mismatchCount,
  results,
};
await writeJson(`summary-${browserName}.json`, runSummary);

console.log(JSON.stringify(runSummary, null, 2));
if (mismatchCount > 0) {
  console.error(`${browserName}: ${mismatchCount} layout conformance mismatch(es); replay evidence written to ${evidenceDirectory}`);
  process.exitCode = 1;
}
