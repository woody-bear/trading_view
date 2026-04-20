// Playwright screenshot capture script
// Usage: npx playwright@1.59.1 node capture.js
const { chromium, devices } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:8000'
const OUT_PC = path.join(__dirname, 'pc')
const OUT_MOBILE = path.join(__dirname, 'mobile')

// 캡쳐 대상 페이지 목록 (사용자 동작 순서)
const PAGES = [
  {
    slug: '01_dashboard_market_scan',
    path: '/',
    desc: '대시보드 — 시장스캔 (추천종목·눌림목·대형주)',
    wait: 3000,
    scrolls: [],
  },
  {
    slug: '02_dashboard_market_scan_scrolled',
    path: '/',
    desc: '대시보드 — 추천종목 섹션 스크롤',
    wait: 3000,
    scrollY: 600,
  },
  {
    slug: '03_buy_list',
    path: '/buy-list',
    desc: 'BUY 조회종목 리스트',
    wait: 3000,
  },
  {
    slug: '04_buy_list_scrolled',
    path: '/buy-list',
    desc: 'BUY 조회종목 리스트 — 스크롤',
    wait: 3000,
    scrollY: 700,
  },
  {
    slug: '05_scrap',
    path: '/scrap',
    desc: 'BUY 사례 스크랩',
    wait: 2000,
  },
  {
    slug: '06_conditions',
    path: '/conditions',
    desc: '조회조건 — 매수 파이프라인',
    wait: 2000,
  },
  {
    slug: '07_conditions_scrolled',
    path: '/conditions',
    desc: '조회조건 — 선정 조건표',
    wait: 2000,
    scrollY: 800,
  },
  {
    slug: '08_signal_detail_kr',
    path: '/005930?market=KR',
    desc: '종목 상세 차트 — 삼성전자',
    wait: 4000,
  },
  {
    slug: '09_signal_detail_us',
    path: '/AAPL?market=US',
    desc: '종목 상세 차트 — Apple',
    wait: 4000,
  },
  {
    slug: '10_alerts',
    path: '/alerts',
    desc: '알림 내역',
    wait: 2000,
  },
  {
    slug: '11_settings',
    path: '/settings',
    desc: '설정',
    wait: 2000,
  },
]

async function capture(page, slug, dir, scrollY) {
  if (scrollY) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY)
    await page.waitForTimeout(500)
  }
  const file = path.join(dir, `${slug}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`  ✓ ${file}`)
}

;(async () => {
  const browser = await chromium.launch({ headless: true })

  // ── PC (1440×900) ──────────────────────────────────────────
  console.log('\n📺 PC 캡쳐 (1440×900)\n')
  const pcCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const pcPage = await pcCtx.newPage()

  for (const p of PAGES) {
    console.log(`→ ${p.slug}: ${p.desc}`)
    await pcPage.goto(BASE_URL + p.path, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await pcPage.waitForTimeout(p.wait || 2000)
    await capture(pcPage, p.slug, OUT_PC, p.scrollY)
  }
  await pcCtx.close()

  // ── Mobile (iPhone 14, 390×844) ───────────────────────────
  console.log('\n📱 모바일 캡쳐 (iPhone 14, 390×844)\n')
  const iphone = devices['iPhone 14']
  const mCtx = await browser.newContext({ ...iphone })
  const mPage = await mCtx.newPage()

  // 모바일 전용 페이지 목록 (스냅 섹션별로 추가)
  const MOBILE_PAGES = [
    { slug: '01_home_market_indicators', path: '/', desc: '홈 — 시장 지표 섹션', wait: 3000 },
    { slug: '02_home_watchlist', path: '/', desc: '홈 — 관심종목 섹션', wait: 3000, scrollY: 844 },
    { slug: '03_home_recommended', path: '/', desc: '홈 — 추천종목 섹션', wait: 3000, scrollY: 844*2 },
    { slug: '04_home_pullback', path: '/', desc: '홈 — 눌림목 섹션', wait: 3000, scrollY: 844*3 },
    { slug: '05_home_largecap', path: '/', desc: '홈 — 대형주 섹션', wait: 3000, scrollY: 844*4 },
    { slug: '06_buy_list', path: '/buy-list', desc: 'BUY 조회종목 리스트', wait: 3000 },
    { slug: '07_buy_list_scrolled', path: '/buy-list', desc: 'BUY 조회종목 리스트 — 스크롤', wait: 3000, scrollY: 700 },
    { slug: '08_scrap', path: '/scrap', desc: 'BUY 사례 스크랩', wait: 2000 },
    { slug: '09_conditions', path: '/conditions', desc: '조회조건', wait: 2000 },
    { slug: '10_signal_detail', path: '/005930?market=KR', desc: '종목 상세 차트', wait: 4000 },
    { slug: '11_alerts', path: '/alerts', desc: '알림 내역', wait: 2000 },
    { slug: '12_settings', path: '/settings', desc: '설정', wait: 2000 },
  ]

  for (const p of MOBILE_PAGES) {
    console.log(`→ ${p.slug}: ${p.desc}`)
    await mPage.goto(BASE_URL + p.path, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await mPage.waitForTimeout(p.wait || 2000)
    await capture(mPage, p.slug, OUT_MOBILE, p.scrollY)
  }
  await mCtx.close()

  await browser.close()
  console.log('\n✅ 모든 캡쳐 완료\n')
})()
