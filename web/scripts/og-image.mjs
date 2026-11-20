/**
 * Renders web/public/og-image.png (1200 × 630) from the real evaluation numbers.
 * Fonts are embedded from node_modules so the render is offline and deterministic.
 *
 *   npm run og
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const systemChrome =
  process.env.CHROME_PATH ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe')
const fonts = {
  serif: path.join(root, 'node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2'),
  serifItalic: path.join(
    root,
    'node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2',
  ),
  sans: path.join(root, 'node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2'),
  mono: path.join(
    root,
    'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  ),
}

const embed = async (file) => (await readFile(file)).toString('base64')

const [serif, serifItalic, sans, mono] = await Promise.all(Object.values(fonts).map(embed))

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face { font-family: 'Instrument Serif'; src: url(data:font/woff2;base64,${serif}) format('woff2'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'Instrument Serif'; src: url(data:font/woff2;base64,${serifItalic}) format('woff2'); font-weight: 400; font-style: italic; }
  @font-face { font-family: 'Instrument Sans'; src: url(data:font/woff2;base64,${sans}) format('woff2'); font-weight: 100 900; }
  @font-face { font-family: 'JetBrains Mono'; src: url(data:font/woff2;base64,${mono}) format('woff2'); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #0b0b0c; color: #f2efe8;
    font-family: 'Instrument Sans', sans-serif;
    position: relative;
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(242,239,232,.07) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(242,239,232,.07) 1px, transparent 1px);
    background-size: 88px 44px;
    mask-image: radial-gradient(ellipse 90% 75% at 45% 0%, #000 25%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse 90% 75% at 45% 0%, #000 25%, transparent 80%);
  }
  .glow {
    position: absolute; left: 12%; top: -280px; width: 780px; height: 620px;
    background: radial-gradient(50% 50% at 50% 50%, rgba(255,90,54,.22), transparent 70%);
  }
  .frame { position: relative; height: 100%; padding: 48px 56px 40px; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 600; letter-spacing: -.02em; }
  .brand .tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #8a847b; letter-spacing: .02em; }
  .kicker { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #8a847b; }
  main { display: grid; grid-template-columns: minmax(0,1fr) 372px; gap: 48px; align-items: center; flex: 1; padding-top: 10px; }
  h1 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 92px; line-height: .92; letter-spacing: -.045em; }
  h1 em { font-style: italic; color: #ff5a36; }
  .lede { margin-top: 18px; max-width: 560px; font-size: 17px; line-height: 1.55; color: #a9a39a; }
  .stats { display: flex; margin-top: 34px; border-top: 1px solid #26262a; padding-top: 18px; }
  .stat { padding-right: 28px; margin-right: 28px; border-right: 1px solid #26262a; }
  .stat:last-child { border-right: 0; margin-right: 0; padding-right: 0; }
  .stat dt { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a847b; font-weight: 600; }
  .stat dd { margin-top: 6px; font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 500; letter-spacing: -.02em; }
  .stat small { display: block; margin-top: 2px; font-family: 'Instrument Sans', sans-serif; font-size: 10px; color: #8a847b; letter-spacing: 0; font-weight: 400; }
  .card { border: 1px solid #26262a; border-radius: 16px; background: #121214; box-shadow: 0 30px 80px rgba(0,0,0,.35); overflow: hidden; }
  .card .top { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #26262a; }
  .card .top span:first-child { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a847b; font-weight: 600; }
  .card .top span:last-child { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8a847b; }
  .card .body { padding: 22px 20px 20px; }
  .prob { font-family: 'JetBrains Mono', monospace; font-size: 58px; line-height: 1; letter-spacing: -.05em; font-weight: 500; }
  .prob small { display: block; margin-top: 8px; font-family: 'Instrument Sans', sans-serif; font-size: 11px; letter-spacing: .02em; color: #8a847b; font-weight: 400; }
  .bar { position: relative; height: 10px; margin-top: 22px; border-radius: 3px; background: #202024; overflow: hidden; }
  .bar .fill { position: absolute; inset: 0 auto 0 0; width: 88.6%; background: linear-gradient(90deg, #ff5a36, #ff7a5c); }
  .bar .cut { position: absolute; top: -3px; bottom: -3px; left: 18%; width: 2px; background: #f2efe8; }
  .scale { display: flex; justify-content: space-between; margin-top: 7px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #8a847b; }
  .decision { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding-top: 16px; border-top: 1px solid #26262a; }
  .decision .label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a847b; font-weight: 600; }
  .decision .value { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #ff5470; }
  .decision .value i { width: 6px; height: 6px; border-radius: 50%; background: #ff5470; }
  .rows { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rows div { border-top: 1px solid #26262a; padding-top: 8px; }
  .rows dt { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #8a847b; }
  .rows dd { margin-top: 3px; font-size: 12px; color: #f2efe8; }
  footer { display: flex; align-items: center; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8a847b; }
  footer .accent { color: #ff5a36; }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="glow"></div>
  <div class="frame">
    <header>
      <div class="brand">
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#0B0B0C"/>
          <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="7.4" fill="none" stroke="#F2EFE8" stroke-opacity=".18"/>
          <path d="M6.5 23.2 11.4 16.6l4.6 2.5L25 8.8" stroke="#FF5A36" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="24.4" cy="9.4" r="2.1" fill="#FF5A36"/>
        </svg>
        churn <span class="tag">/ mlops</span>
      </div>
      <div class="kicker">Open-source MLOps case study</div>
    </header>

    <main>
      <div>
        <h1>Predict churn.<br />Decide by <em>profit.</em></h1>
        <p class="lede">
          Calibrated probabilities, a profit-optimised cutoff and a monitored serving path —
          measured once on 1,409 held-out customers.
        </p>
        <dl class="stats">
          <div class="stat"><dt>PR-AUC</dt><dd>0.636<small>95% CI 0.586–0.683</small></dd></div>
          <div class="stat"><dt>Recall</dt><dd>88.8%<small>at cutoff 0.18</small></dd></div>
          <div class="stat"><dt>Extra profit</dt><dd>$67.8k<small>per 1,000 customers</small></dd></div>
        </dl>
      </div>

      <div class="card">
        <div class="top"><span>Customer record</span><span>TEST SET</span></div>
        <div class="body">
          <div class="prob">0.886<small>calibrated churn probability</small></div>
          <div class="bar"><div class="fill"></div><div class="cut"></div></div>
          <div class="scale"><span>0.00</span><span>cutoff 0.18</span><span>1.00</span></div>
          <div class="decision">
            <span class="label">Decision</span>
            <span class="value"><i></i>Target</span>
          </div>
          <dl class="rows">
            <div><dt>Contract</dt><dd>Month-to-month</dd></div>
            <div><dt>Tenure</dt><dd>1 month</dd></div>
            <div><dt>Monthly</dt><dd>$74.50</dd></div>
            <div><dt>Internet</dt><dd>Fiber optic</dd></div>
          </dl>
        </div>
      </div>
    </main>

    <footer>
      <span>github.com/Kuldeepni/churn-mlops</span>
      <span><span class="accent">●</span> FastAPI · DVC · MLflow · drift monitoring</span>
    </footer>
  </div>
</body>
</html>`

const browser = await chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: path.join(root, 'public/og-image.png'), type: 'png' })
await browser.close()
console.log('Wrote public/og-image.png')
