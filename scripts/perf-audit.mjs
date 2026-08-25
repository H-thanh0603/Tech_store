// Lighthouse audit at 3 viewports against the local dev server.
// Usage: node scripts/perf-audit.mjs [baseURL]   (default http://127.0.0.1:3000)
// Writes JSON reports to .lighthouse/ and prints a score + LCP summary table.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lighthouse = require('lighthouse/core/index.cjs');
const chromeLauncher = require('chrome-launcher');

const baseURL = process.argv[2] ?? 'http://127.0.0.1:3000';
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 667, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
];

const outDir = new URL('../.lighthouse/', import.meta.url).pathname;
await mkdir(outDir, { recursive: true });

const rows = [];
for (const vp of VIEWPORTS) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  const flags = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance'],
    screenEmulation: {
      mobile: vp.mobile,
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.mobile ? 2 : 1,
      disabled: false,
    },
    formFactor: vp.mobile ? 'mobile' : 'desktop',
    throttling: { rttMs: 40, throughputKbps: 10_240, cpuSlowdownMultiplier: 1 },
  };
  try {
    const result = await lighthouse(baseURL, { port: chrome.port }, flags);
    const report = result.lhr;
    await writeFile(`${outDir}${vp.name}.json`, JSON.stringify(report, null, 2));
    const perf = report.categories.performance.score * 100;
    const lcp = report.audits['largest-contentful-paint'];
    const cls = report.audits['cumulative-layout-shift'];
    const tbt = report.audits['total-blocking-time'];
    rows.push({
      viewport: vp.name,
      perfScore: Math.round(perf),
      LCP_s: +(lcp.numericValue / 1000).toFixed(2),
      LCP_element: (lcp.details?.items?.[0]?.node?.snippet ?? 'n/a').replace(/<[^>]+>/g, '').slice(0, 60),
      CLS: cls.numericValue,
      TBT_ms: Math.round(tbt.numericValue),
      lcpWarning: lcp.score !== null && lcp.score < 0.9 ? 'WARN' : 'ok',
    });
  } finally {
    await chrome.kill();
  }
}

console.table(rows);
console.log(`Reports: ${outDir}`);
