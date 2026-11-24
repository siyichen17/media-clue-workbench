import assert from 'node:assert/strict'
import { exchangeWidgets, generateLayoutCandidates, validateLayout } from '../src/screen/compose.ts'
import { bodyPixels, dragDivider, dividerHits, leafRects, previewSwap } from '../src/screen/partition.ts'
import { previewDrop, previewVariant, spanBox, variantsFor } from '../src/screen/slots.ts'
import { pixelAspect } from '../src/screen/shape.ts'
import { normalizeTemplate, SYSTEM_TEMPLATES } from '../src/screen/store.ts'
import { defaultDisplay, defaultScope, type ScreenWidget, type WidgetKind } from '../src/screen/types.ts'

function widget(id: string, type: WidgetKind, order: number, role: 'primary' | 'secondary' = 'secondary'): ScreenWidget {
  return {
    id, type, role, order, x: 0, y: 0, w: 30, h: 30, title: id,
    followGlobal: true, scope: defaultScope(), display: defaultDisplay(),
  }
}

const national = SYSTEM_TEMPLATES[0]
assert.ok(national)
const map = national.widgets.find((item) => item.type === 'map')
assert.equal(map?.x, 25.5)
assert.equal(map?.w, 49)
assert.equal(national.name, '新闻线索态势')
assert.deepEqual(national.selectedMetrics, ['newsCount', 'eventCount', 'mediaCount'])

const focusMap = national.widgets.find((item) => item.type === 'map')
assert.ok(focusMap)
const once = generateLayoutCandidates(national.widgets, focusMap.id)
const twice = generateLayoutCandidates(national.widgets, focusMap.id)
assert.deepEqual(once, twice)
assert.ok(once.candidates.length >= 1 && once.candidates.length <= 3, once.reason)
once.candidates.forEach((candidate) => {
  const mapBox = candidate.widgets.find((item) => item.type === 'map')
  assert.ok(mapBox)
  assert.ok(pixelAspect(mapBox.w, mapBox.h) < 2, `${candidate.name} 地图宽高比 ${pixelAspect(mapBox.w, mapBox.h).toFixed(2)}`)
  const verdict = validateLayout(candidate.widgets, candidate.focusId)
  assert.equal(verdict.ok, true, verdict.reason)
  assert.deepEqual(candidate.widgets.map((item) => item.id).sort(), national.widgets.map((item) => item.id).sort())
  assert.equal(candidate.widgets.filter((item) => item.role === 'primary').length, 1)
  const area = candidate.widgets.reduce((sum, item) => sum + item.w * item.h, 0)
  assert.ok(area > 85, `${candidate.name} area ${area}`)
})
assert.equal(national.widgets.find((item) => item.type === 'newsList')?.role, 'secondary')

const hotFocus = national.widgets.find((item) => item.type === 'hotBoard')
assert.ok(hotFocus)
const hotPlans = generateLayoutCandidates(national.widgets, hotFocus.id)
assert.notDeepEqual(
  hotPlans.candidates.map((item) => item.widgets.map((entry) => [entry.id, entry.x, entry.y, entry.w, entry.h])),
  once.candidates.map((item) => item.widgets.map((entry) => [entry.id, entry.x, entry.y, entry.w, entry.h])),
)

const reduced = generateLayoutCandidates(national.widgets.filter((item) => item.type !== 'trend'), focusMap.id)
assert.ok(reduced.candidates.length > 0, reduced.reason)
reduced.candidates.forEach((candidate) => {
  assert.equal(candidate.widgets.some((item) => item.type === 'trend'), false)
  assert.equal(candidate.widgets.length, 4)
})

const solo = generateLayoutCandidates([widget('only', 'trend', 0, 'primary')], 'only')
assert.equal(solo.candidates.length, 1)
assert.equal(solo.candidates[0]?.widgets[0]?.w, 100)

const empty = generateLayoutCandidates([], null)
assert.equal(empty.candidates.length, 0)
assert.match(empty.reason, /还没有组件/)

const crowded = ['map', 'coverage', 'trend', 'newsList', 'progress', 'eventRank', 'hotBoard', 'bubbles', 'sources'] as const
const over = generateLayoutCandidates(crowded.map((type, order) => widget(type, type, order, order === 0 ? 'primary' : 'secondary')), 'map')
assert.equal(over.candidates.length, 0)
assert.match(over.reason, /超过一屏|放不下|6 个/)

const kept = normalizeTemplate({
  ...national,
  schemaVersion: 2,
  layoutMode: 'manual',
  widgets: national.widgets.map((item) => item.id === 'map' ? { ...item, x: 12.5, y: 3, w: 40, h: 70 } : item),
})
assert.equal(kept?.widgets.find((item) => item.id === 'map')?.x, 12.5)
assert.equal(kept?.layoutMode, 'manual')

const generated = normalizeTemplate({
  ...national,
  schemaVersion: 2,
  layoutMode: 'generated',
  layoutRecipeId: 'left',
  widgets: national.widgets.map((item) => item.id === 'hot' ? { ...item, x: 4, scope: { ...item.scope, hotPlatform: '百度' } } : item),
})
assert.equal(generated?.widgets.find((item) => item.id === 'hot')?.x, 4)
assert.equal(generated?.widgets.find((item) => item.id === 'hot')?.scope.hotPlatform, '百度')

const sample = once.candidates[0]
assert.ok(sample)
const hot = sample.widgets.find((item) => item.type === 'hotBoard')
const bubbles = sample.widgets.find((item) => item.type === 'bubbles')
assert.ok(hot && bubbles)
const swapped = exchangeWidgets(sample.widgets, hot.id, bubbles.id)
if (swapped.ok) {
  assert.equal(swapped.widgets.find((item) => item.id === hot.id)?.scope.hotPlatform, hot.scope.hotPlatform)
  assert.equal(swapped.widgets.find((item) => item.id === hot.id)?.role, hot.role)
} else {
  assert.match(swapped.reason, /低于它需要的|位置保持不变/)
}

const tight = exchangeWidgets(
  [
    { ...widget('wide', 'coverage', 0, 'primary'), x: 0, y: 0, w: 70, h: 100 },
    { ...widget('slim', 'hotBoard', 1), x: 80, y: 0, w: 18, h: 20 },
  ],
  'wide',
  'slim',
)
assert.equal(tight.ok, false)
if (!tight.ok) assert.match(tight.reason, /位置保持不变/)

function assertUsable(label: string, types: WidgetKind[], focusType: WidgetKind, expectMoreThanOne = false) {
  const widgets = types.map((type, order) => widget(`${type}-${order}`, type, order, type === focusType ? 'primary' : 'secondary'))
  const focus = widgets.find((item) => item.type === focusType)
  assert.ok(focus, label)
  const plan = generateLayoutCandidates(widgets, focus.id)
  assert.ok(plan.candidates.length >= 1, `${label}: ${plan.reason}`)
  if (expectMoreThanOne) assert.ok(plan.candidates.length >= 2, `${label} only ${plan.candidates.map((item) => item.name).join(',')}`)
  const families = new Set(plan.candidates.map((item) => item.family))
  assert.equal(families.size, plan.candidates.length, `${label} repeated family`)
  for (const candidate of [...plan.candidates, ...plan.more]) {
    const verdict = validateLayout(candidate.widgets, candidate.focusId)
    assert.equal(verdict.ok, true, `${label} ${candidate.name} ${verdict.reason}`)
    assert.equal(candidate.widgets.some((item) => item.type === 'map'), types.includes('map'))
  }
  return plan
}

const mapOnly = assertUsable('仅地图', ['map'], 'map')
const soloMap = mapOnly.candidates[0]?.widgets[0]
assert.ok(soloMap)
assert.ok(soloMap.w > 90 && soloMap.h > 90, `单张地图应铺满主体 ${soloMap.w.toFixed(1)}×${soloMap.h.toFixed(1)}`)
assert.equal(mapOnly.more.length, 0)

assertUsable('地图＋热搜', ['map', 'hotBoard'], 'map')
const withTrend = assertUsable('地图＋热搜＋趋势', ['map', 'hotBoard', 'trend'], 'map', true)
assert.ok(
  [...withTrend.candidates, ...withTrend.more].some((item) => item.widgets.find((entry) => entry.type === 'trend')!.w >= 50),
  '趋势没有得到横向空间',
)
const five = assertUsable('五组件', ['map', 'hotBoard', 'bubbles', 'newsList', 'trend'], 'map', true)
assert.ok(five.candidates.length + five.more.length >= 3, '五组件有效构图不足')
assertUsable('无地图', ['hotBoard', 'newsList', 'sources'], 'newsList', true)
assertUsable('宽组件', ['coverage', 'trend', 'newsList'], 'coverage', true)

function placed(id: string, type: WidgetKind, variantId: string, col: number, row: number, order = 0): ScreenWidget {
  const variant = variantsFor(type, 'auto').find((item) => item.id === variantId)
  assert.ok(variant)
  return { ...widget(id, type, order, order === 0 ? 'primary' : 'secondary'), ...spanBox(col, row, variant.cols, variant.rows), variantId, col, row }
}

const pair = [placed('left', 'hotBoard', 'hot-short', 0, 0), placed('right', 'bubbles', 'bubble-compact', 3, 0)]
const swappedSlots = previewDrop(pair, 'left', 4, 1, 1, 1)
assert.equal(swappedSlots.kind, 'swap')
assert.equal(swappedSlots.widgets.find((item) => item.id === 'left')?.col, 3)
assert.equal(swappedSlots.widgets.find((item) => item.id === 'right')?.col, 0)

const roomy = [placed('map', 'map', 'map-standard', 0, 0), placed('hot', 'hotBoard', 'hot-short', 4, 0, 1)]
const shifted = previewDrop(roomy, 'hot', 1, 1, 5, 1)
assert.equal(shifted.kind, 'shift', shifted.reason)
assert.equal(shifted.widgets.find((item) => item.id === 'hot')?.variantId, 'hot-short')
assert.ok(shifted.widgets.every((item) => (item.col ?? 0) >= 0 && (item.row ?? 0) >= 0))

const blocked = previewDrop(
  [placed('map', 'map', 'map-large', 0, 0), placed('trend', 'trend', 'trend-full', 0, 6, 1), placed('hot', 'hotBoard', 'hot-long', 5, 0, 2), placed('news', 'newsList', 'focus-standard', 8, 0, 3)],
  'map',
  6,
  2,
  2,
  2,
)
assert.equal(blocked.ok, false)
assert.equal(blocked.widgets.find((item) => item.id === 'map')?.col, 0)
assert.equal(blocked.widgets.length, 4)

const grown = previewVariant(roomy, 'hot', 'hot-long')
assert.equal(grown.ok, true, grown.reason)
assert.equal(grown.widgets.find((item) => item.id === 'hot')?.variantId, 'hot-long')

const pairPlan = generateLayoutCandidates([widget('map', 'map', 0, 'primary'), widget('hot', 'hotBoard', 1)], 'map')
assert.ok(pairPlan.candidates.length >= 1, pairPlan.reason)
assert.ok([...pairPlan.candidates, ...pairPlan.more].every((item) => item.place !== 'center'))
assert.ok(pairPlan.candidates.every((item) => item.widgets.every((entry) => entry.w > 15 && entry.h > 20)))

const trendPlan = generateLayoutCandidates([
  widget('trend', 'trend', 0, 'primary'),
  widget('hot', 'hotBoard', 1),
  widget('news', 'newsList', 2),
], 'trend')
assert.ok([...trendPlan.candidates, ...trendPlan.more].some((item) => item.place === 'top'), trendPlan.candidates.map((item) => item.name).join(','))

const tree = once.candidates.find((item) => item.tree)?.tree
const host = once.candidates.find((item) => item.tree)
assert.ok(tree && host)
const body = bodyPixels(true)
const hits = dividerHits(tree, body.width, body.height)
assert.ok(hits.length > 0)
const hit = hits[0]
assert.ok(hit)
const moved = dragDivider(tree, host.widgets, body.width, body.height, hit.path, hit.index, 48)
const beforeRects = leafRects(tree, body.width, body.height)
const afterRects = leafRects(moved, body.width, body.height)
assert.ok([...afterRects.values()].every((rect) => rect.w > 20 && rect.h > 20 && rect.x >= -1 && rect.y >= -1 && rect.x + rect.w <= body.width + 1 && rect.y + rect.h <= body.height + 1))
assert.notDeepEqual([...beforeRects.values()], [...afterRects.values()])

const swapIds = host.widgets.map((item) => item.id)
const swappedTree = previewSwap(tree, host.widgets, swapIds[1] ?? '', swapIds[2] ?? '', body.width, body.height)
if (swappedTree.ok) {
  assert.equal(swappedTree.widgets.find((item) => item.id === swapIds[1])?.scope.hotPlatform, host.widgets.find((item) => item.id === swapIds[1])?.scope.hotPlatform)
} else {
  assert.match(swappedTree.reason, /放不下|位置保持不变/)
}

console.log(`layout checks passed: ${once.candidates.map((item) => item.name).join('、')}；更多 ${once.more.length}`)
