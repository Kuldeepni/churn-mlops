/**
 * Captures the review set at desktop and mobile, dark and light.
 * Requires a running preview server (npm run preview) on port 4173.
 *
 *   npm run shots
 */
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'screenshots')
const base = process.env.PREVIEW_URL ?? 'http://localhost:4173/'
const systemChrome =
  process.env.CHROME_PATH ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe')

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {})

async function newPage({ width, height, theme, online = true }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: 'no-preference',
  })
  await context.addInitScript((value) => {
    try {
      localStorage.setItem('theme', value)
    } catch {
      /* ignore */
    }
  }, theme)
  const page = await context.newPage()
  if (online) {
    await page.route('**/health', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
    )
  }
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#predict')
  await page.waitForTimeout(1200)
  return { page, context }
}

/** Walk the page so every in-view reveal and count-up has fired before a full-page shot. */
async function walkPage(page) {
  await page.evaluate(async () => {
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    await new Promise((resolve) => {
      let y = 0
      const step = Math.max(240, window.innerHeight / 2)
      const timer = setInterval(() => {
        y += step
        window.scrollTo({ top: y, behavior: 'instant' })
        if (y >= root.scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 24)
    })
    window.scrollTo({ top: 0, behavior: 'instant' })
    root.style.scrollBehavior = previous
  })
  await page.waitForTimeout(1300)
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(outDir, name), fullPage })
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

for (const viewport of viewports) {
  for (const theme of ['dark', 'light']) {
    const { page, context } = await newPage({ ...viewport, theme })
    // QA-only: force every scroll reveal on so a stitched full-page shot shows the whole design.
    await page.addStyleTag({ content: '[data-reveal]{opacity:1 !important;transform:none !important}' })
    await shot(page, `${viewport.name}-${theme}-hero.png`)
    await walkPage(page)
    await shot(page, `${viewport.name}-${theme}-full.png`, true)

    {
      // Hide the sticky header while photographing individual sections.
      const style = await page.addStyleTag({ content: 'header.sticky{visibility:hidden !important}' })
      const ids =
        viewport.name === 'desktop'
          ? ['predict', 'impact', 'performance', 'pipeline', 'monitoring', 'engineering']
          : ['predict', 'impact', 'performance', 'pipeline', 'monitoring']
      for (const id of ids) {
        const section = page.locator(`#${id}`)
        if (!(await section.count())) continue
        await page.evaluate((sectionId) => {
          const element = document.getElementById(sectionId)
          if (!element) return
          const top = element.getBoundingClientRect().top + window.scrollY - 8
          window.scrollTo({ top, behavior: 'instant' })
        }, id)
        await page.waitForTimeout(1100)
        await section.screenshot({
          path: path.join(outDir, `${viewport.name}-${theme}-${id}.png`),
        })
      }

      if (viewport.name === 'desktop') {
        // Verified-state screenshots for both drift samples.
        await page.evaluate((sectionId) => {
          const element = document.getElementById(sectionId)
          if (!element) return
          window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 8, behavior: 'instant' })
        }, 'monitoring')
        await page.getByRole('radio', { name: 'Shifted' }).click()
        await page.waitForTimeout(700)
        await page.locator('#monitoring').screenshot({
          path: path.join(outDir, `desktop-${theme}-monitoring-shifted.png`),
        })
        await page.getByRole('radio', { name: 'Normal' }).click()

        // Exercise every chart tab, not just the default ROC view.
        for (const [label, name] of [
          ['Precision–recall', 'pr'],
          ['Calibration', 'calibration'],
          ['Feature importance', 'importance'],
        ]) {
          await page.getByRole('tab', { name: label }).click()
          await page.waitForTimeout(1000)
          await page.locator('#performance').screenshot({
            path: path.join(outDir, `desktop-${theme}-performance-${name}.png`),
          })
        }
      }
      await style.evaluate((node) => node.remove())
    }

    await context.close()
    console.log(`captured ${viewport.name} ${theme}`)
  }
}

// Demo mode: fail every health check, then advance the retry clock past the 90s give-up.
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark')
    } catch {
      /* ignore */
    }
  })
  const page = await context.newPage()
  await page.clock.install()
  await page.route('**/health', (route) => route.fulfill({ status: 503, body: '{}' }))
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#predict')
  await page.clock.runFor(95_000)
  await page.waitForTimeout(600)
  await shot(page, 'desktop-dark-demo.png')
  await context.close()
  console.log('captured demo mode')
} catch (error) {
  console.warn('demo-mode capture skipped:', error instanceof Error ? error.message : error)
}

await browser.close()
console.log(`Wrote screenshots to ${outDir}`)
