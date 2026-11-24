import { useEffect, useRef, useState } from 'react'
import type { EChartsCoreOption } from 'echarts'
import { EChart } from '../components/overview/EChart.tsx'
import { topicById } from '../data/demo/catalog.ts'
import { EVENT_BRIEFS, NEWS } from '../data/demo/news.ts'
import { dateRangeOf, eachDate, formatStamp, hourOf } from '../lib/dates.ts'
import { rankDelta, resolveEventId } from '../lib/hotSelectors.ts'
import type { NewsItem } from '../types/domain.ts'
import { ensureChinaMap, ensureSichuanMap } from './geoMap.ts'
import { coverageMatrix, eventRanks, hotRows, progressView, widgetModel, type TransientFilters } from './query.ts'
import { placeOfEvent, provinceOfPlace, PROVINCES, regionOfPlace, SICHUAN_CITIES } from './region.ts'
import { alpha } from './theme.ts'
import { useDashMotion, useDashTheme } from './themeContext.tsx'
import { defaultPresentation, type MetricKind, type PresentationSettings, type ScreenScope, type ScreenTemplate, type ScreenWidget } from './types.ts'

export function ScreenWidgetBody({
  template,
  widget,
  transient,
  interactive,
  onNews,
  onHot,
  showHints = false,
  holdPlayback = false,
}: {
  template: ScreenTemplate
  widget: ScreenWidget
  transient: TransientFilters
  interactive: boolean
  onNews: (items: NewsItem[], title: string) => void
  onHot: (eventId: string) => void
  showHints?: boolean
  holdPlayback?: boolean
}) {
  let model: ReturnType<typeof widgetModel>
  try {
    model = widgetModel(template, widget, transient)
  } catch {
    return <p className="screen-empty">加载失败。失败不会显示成 0。</p>
  }
  const primary = widget.role === 'primary'
  const play = { ...defaultPresentation(), ...template.presentation }
  if (widget.type === 'map') return <RegionMap news={model.news} scope={widget.scope} metric={widget.scope.mapMetric ?? 'eventCount'} showHints={showHints} />
  if (widget.type === 'eventRank') return <EventRank news={model.news} sort={widget.display.sort} primary={primary} interactive={interactive} showHints={showHints} onNews={onNews} />
  if (widget.type === 'hotBoard') return <HotBoard widget={widget} play={play} heldOutside={holdPlayback} onHot={onHot} onNews={onNews} news={model.news} />
  if (widget.type === 'bubbles') return <TopicBubbles news={model.news} motion={play.motionEnabled} full={widget.variantId === 'bubble-full'} onNews={onNews} />
  if (widget.type === 'trend') return <TrendChart news={model.news} scope={widget.scope} onNews={onNews} />
  if (widget.type === 'newsList') return <FocusNews news={model.news} pinnedId={widget.scope.focusArticleId ?? ''} play={play} heldOutside={holdPlayback} interactive={interactive} wide={widget.variantId === 'focus-wide'} onNews={onNews} />
  if (widget.type === 'peers') return <PeerChart rows={widget.variantId === 'peer-standard' ? model.peers.slice(0, 4) : model.peers} news={model.news} onNews={onNews} />
  if (widget.type === 'coverage') return <CoverageMatrix news={model.news} mediaIds={widget.scope.mediaIds ?? []} primary={primary} onNews={onNews} />
  if (widget.type === 'progress') return <ProgressLine news={model.news} eventId={widget.scope.eventId} primary={primary} showHints={showHints} vertical={widget.variantId === 'progress-vertical'} onNews={onNews} onHot={onHot} />
  if (widget.type === 'hourly') return <HourHeat news={model.news} scope={widget.scope} columns={widget.variantId === 'hour-wide' ? 12 : widget.variantId === 'hour-standard' ? 8 : undefined} />
  return <SourceChart news={model.news} limit={widget.variantId === 'source-long' ? 10 : 6} onNews={onNews} />
}

export function MetricValue({ template, kind }: { template: ScreenTemplate; kind: MetricKind }) {
  let model: ReturnType<typeof widgetModel> | null = null
  try {
    const probe = template.widgets[0]
    if (probe) model = widgetModel(template, probe, { selectedDay: null, categoryId: null, topicId: null, mediaId: null })
  } catch {
    model = null
  }
  if (!model) return <MetricView label="指标" value="—" unit="" note="统计没有加载成功，不会显示成 0。" />
  const regions = regionSummary(model.news)
  if (kind === 'newsCount') return <MetricView label="已收录报道" value={String(model.news.length)} unit="篇" note="按报道 ID 去重，不是公众热度。" />
  if (kind === 'eventCount') return <MetricView label="关联事件" value={String(new Set(model.news.map((item) => item.eventId)).size)} unit="个" note="按事件 ID 去重。" />
  if (kind === 'regionCount') return <MetricView label="已识别地区" value={regions.known ? String(regions.provinces) : '—'} unit={regions.known ? '个省' : ''} note={regions.note} />
  if (kind === 'mediaCount') return <MetricView label="涉及媒体" value={String(new Set(model.news.map((item) => item.mediaId)).size)} unit="家" note="当前范围内出现过的来源机构。" />
  return <MetricView label="热榜命中事件" value={String(model.hotEventCount)} unit="个" note="热榜条目关联到的事件，按事件去重。" />
}

function MetricView({ label, value, unit, note }: { label: string; value: string; unit: string; note: string }) {
  return (
    <div className="screen-kpi" title={note}>
      <strong>{value}</strong>
      {unit && <span>{unit}</span>}
      <em>{label}</em>
      {value === '—' && <small>{note}</small>}
    </div>
  )
}

function regionSummary(news: NewsItem[]) {
  const events = uniqueEvents(news)
  let unknown = 0
  const provinces = new Set<string>()
  for (const event of events) {
    const province = provinceOfPlace(placeOfEvent(event.id))
    if (province) provinces.add(province)
    else unknown += 1
  }
  return {
    known: provinces.size > 0,
    provinces: provinces.size,
    note: events.length === 0
      ? '当前范围没有事件。'
      : provinces.size === 0
        ? '当前事件没有可识别的省份。'
        : `按事件发生地计入省份。地区未确定 ${unknown} 个，不计入。`,
  }
}

function uniqueEvents(news: NewsItem[]) {
  const map = new Map<string, string>()
  news.forEach((item) => map.set(item.eventId, item.eventName))
  return [...map.entries()].map(([id, name]) => ({ id, name }))
}

function RegionMap({ news, scope, metric, showHints }: { news: NewsItem[]; scope: ScreenScope; metric: 'eventCount' | 'articleCount'; showHints: boolean }) {
  const events = uniqueEvents(news)
  const provinces = new Set<string>()
  let unknownProvince = 0
  for (const event of events) {
    const province = provinceOfPlace(placeOfEvent(event.id))
    if (province) provinces.add(province)
    else unknownProvince += 1
  }
  const onlySichuan = provinces.size === 1 && provinces.has('四川省')
  const requested = scope.mapScope ?? 'auto'
  const level = requested === 'china' ? 'china' : requested === 'sichuan' ? 'sichuan' : onlySichuan || provinces.size === 0 ? 'sichuan' : 'china'
  const names = level === 'sichuan' ? [...SICHUAN_CITIES] : [...PROVINCES]
  const counts = new Map<string, number>()
  const articles = new Map<string, number>()
  const byRegion = new Map<string, string[]>()
  let unplaced = 0
  for (const event of events) {
    const place = placeOfEvent(event.id)
    const name = level === 'sichuan' ? regionOfPlace(place) : provinceOfPlace(place)
    const related = news.filter((item) => item.eventId === event.id)
    if (!name) { unplaced += 1; continue }
    counts.set(name, (counts.get(name) ?? 0) + 1)
    articles.set(name, (articles.get(name) ?? 0) + related.length)
    const ids = byRegion.get(name) ?? []
    ids.push(event.id)
    byRegion.set(name, ids)
  }
  const valueOf = (name: string) => metric === 'articleCount' ? (articles.get(name) ?? 0) : (counts.get(name) ?? 0)
  const ranked = names.filter((name) => valueOf(name) > 0).sort((a, b) => valueOf(b) - valueOf(a) || a.localeCompare(b, 'zh'))
  const [picked, setPicked] = useState(ranked[0] ?? '')
  const active = valueOf(picked) > 0 ? picked : ranked[0] ?? ''
  const max = Math.max(...names.map(valueOf), 1)
  const focusIds = byRegion.get(active) ?? []
  const focusNews = news.filter((item) => focusIds.includes(item.eventId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const lead = focusNews[0]
  const leadCount = lead ? focusNews.filter((item) => item.eventId === lead.eventId).length : 0
  const unit = metric === 'articleCount' ? '篇报道' : '个关联事件'
  const topNames = ranked.slice(0, 3)
  const plot = useBox()
  const [restoreToken, setRestoreToken] = useState(0)
  // ECharts 的原始边界是经纬度。aspectScale 用区域中纬的 cos，使绘制宽高比等于地面距离比。
  const theme = useDashTheme()
  const aspectScale = level === 'sichuan' ? 0.864 : 0.879
  const groundAspect = level === 'sichuan' ? 1.171 : 1.079
  const chartAspect = plot.w > 0 ? plot.w / Math.max(plot.h - 118, 1) : groundAspect
  const showLegend = plot.w > 0 && chartAspect > groundAspect * 1.12
  const option: EChartsCoreOption = {
    animation: false,
    tooltip: { backgroundColor: theme.tooltipBg, borderColor: theme.border, textStyle: { color: theme.tooltipInk }, formatter: (params: unknown) => {
      const row = params as { name?: string; value?: number }
      if (!row.name) return ''
      const value = Number(row.value) || 0
      return `${row.name}<br/>${value ? `${value} ${unit}` : '当前范围未收录'}`
    } },
    visualMap: {
      show: showLegend && ranked.length > 0,
      min: 1,
      max,
      text: [metric === 'articleCount' ? '报道多' : '事件多', metric === 'articleCount' ? '报道少' : '事件少'],
      textStyle: { color: theme.muted, fontSize: 12 },
      inRange: { color: [...theme.mapScale] },
      outOfRange: { color: theme.mapEmpty },
      calculable: false,
      right: 8,
      top: 12,
      itemWidth: 8,
      itemHeight: 64,
    },
    series: [{
      type: 'map',
      map: level === 'sichuan' ? 'sichuan-clue' : 'china-clue',
      roam: true,
      scaleLimit: { min: 1, max: 8 },
      selectedMode: false,
      nameProperty: 'name',
      left: 8,
      right: showLegend ? 52 : 10,
      top: 8,
      bottom: 118,
      aspectScale,
      // left/right/top/bottom 会先铺满容器。不声明 contain 时，经纬度会被横纵分别拉进这个矩形。
      preserveAspect: 'contain',
      data: names.map((name) => {
        const value = valueOf(name)
        const onDarkFill = theme.id === 'light-business' && max > 0 && value / max > 0.62
        return {
          name,
          value,
          label: { color: onDarkFill ? '#FFFFFF' : theme.mapLabel },
          itemStyle: name === active ? { areaColor: theme.highlight, borderColor: theme.highlight, borderWidth: 1.2, shadowBlur: theme.mapGlow, shadowColor: alpha(theme.highlight, 0.45) } : undefined,
        }
      }),
      label: {
        show: true,
        color: theme.mapLabel,
        fontSize: 13,
        formatter: (params: { name?: string }) => topNames.includes(params.name ?? '') ? String(params.name).replace(/(省|市|特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区)$/, '') : '',
      },
      itemStyle: { borderColor: theme.mapBorder, borderWidth: 0.6, areaColor: theme.mapEmpty, shadowBlur: theme.mapGlow, shadowColor: theme.mapShadow },
      emphasis: { label: { show: true, color: theme.bubbleInk }, itemStyle: { areaColor: theme.highlight } },
    }],
  }
  let mapReady = true
  try { if (level === 'sichuan') ensureSichuanMap(); else ensureChinaMap() } catch { mapReady = false }
  if (!mapReady) return <p className="screen-empty">地图地理数据缺失，不能定位。</p>
  return (
    <div className="dash-chart map-panel" ref={plot.ref}>
      <div className="map-plot">
        {events.length === 0 ? <p className="screen-empty">当前范围没有可上图的事件。</p> : <EChart key={level} option={option} restoreToken={restoreToken} onClick={(params) => {
          const name = String(params.name ?? '')
          if (valueOf(name) <= 0) return
          setPicked(name)
        }} />}
      </div>
      <div className="map-focus">
        {lead ? (
          <>
            <strong>{active}</strong>
            <em>{lead.eventName}</em>
            <span>关联报道 {leadCount} 篇 · 最近 {formatStamp(lead.publishedAt)}</span>
          </>
        ) : <span>{level === 'sichuan' ? '没有可定位到市州的事件。' : '还没有选中有事件的地区。'}</span>}
        <small>颜色表示{metric === 'articleCount' ? '报道数' : '关联事件数'}。{level === 'sichuan' ? `市州未确定 ${unplaced} 个，不落点。` : `地区未确定 ${unknownProvince} 个。`}</small>
      </div>
      <button type="button" className="map-reset" onClick={() => setRestoreToken((value) => value + 1)}>恢复完整地图</button>
      {showHints && requested === 'auto' && <p className="screen-note map-scope-note">{onlySichuan ? '当前材料集中在四川，已用四川地图。' : '已按数据范围选择地图。'}</p>}
    </div>
  )
}

function EventRank({ news, sort, primary, interactive, showHints, onNews }: { news: NewsItem[]; sort: 'latest' | 'count'; primary: boolean; interactive: boolean; showHints: boolean; onNews: (items: NewsItem[], title: string) => void }) {
  const rows = eventRanks(news, sort === 'count' ? 'count' : 'latest')
  const [limit, setLimit] = useState(3)
  const ref = useRef<HTMLUListElement>(null)
  useFitRows(ref, 46, setLimit)
  const [lead, ...rest] = rows
  const list = primary ? rest : rows
  const latestTitle = lead ? news.filter((item) => item.eventId === lead.id).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]?.title : ''
  const brief = lead ? EVENT_BRIEFS[lead.id] : ''
  const shown = list.slice(0, limit)
  return (
    <div className="dash-fill">
      <p className="screen-note">{sort === 'count' ? '按当前范围报道数' : '按最近报道时间'}，不是重要性判断。</p>
      {rows.length === 0 && <p className="screen-empty">当前范围没有事件。</p>}
      {primary && lead && (
        <button type="button" className="event-lead" disabled={!interactive} onClick={() => onNews(news.filter((item) => item.eventId === lead.id), lead.name)}>
          <strong>{lead.name}</strong>
          <em>{brief || `最新报道：${latestTitle || '当前范围没有报道标题'}`}</em>
          <span>报道 {lead.count} 篇 · {lead.mediaCount} 家媒体 · {formatStamp(lead.latest)}</span>
        </button>
      )}
      <ul className="screen-list event-rest" ref={ref}>
        {shown.map((item) => (
          <li key={item.id}>
            <button type="button" disabled={!interactive} onClick={() => onNews(news.filter((newsItem) => newsItem.eventId === item.id), item.name)}>
              <strong>{item.name}</strong>
              <span>报道 {item.count} 篇 · {formatStamp(item.latest)}</span>
            </button>
          </li>
        ))}
      </ul>
      <SpaceNote show={showHints && primary && rows.length > 1 && shown.length === 0} />
    </div>
  )
}

function HotBoard({ widget, news, play, heldOutside, onHot, onNews }: { widget: ScreenWidget; news: NewsItem[]; play: PresentationSettings; heldOutside: boolean; onHot: (eventId: string) => void; onNews: (items: NewsItem[], title: string) => void }) {
  const [platform, setPlatform] = useState(widget.scope.hotPlatform)
  const [held, setHeld] = useState(false)
  useEffect(() => setPlatform(widget.scope.hotPlatform), [widget.scope.hotPlatform])
  useEffect(() => {
    if (!play.rotateHotPlatform || held || heldOutside) return
    const step = () => {
      if (document.hidden) return
      setPlatform((current) => current === '微博' ? '百度' : '微博')
    }
    const timer = window.setInterval(step, 36000)
    return () => window.clearInterval(timer)
  }, [play.rotateHotPlatform, held, heldOutside])
  const board = hotRows({ ...widget.scope, hotPlatform: platform }, widget.variantId === 'hot-long' ? 16 : 8)
  const [limit, setLimit] = useState(5)
  const ref = useRef<HTMLUListElement>(null)
  useFitRows(ref, 36, setLimit)
  const variantCap = widget.variantId === 'hot-short' ? 4 : widget.variantId === 'hot-wide' ? 6 : widget.variantId === 'hot-long' ? 16 : Number.POSITIVE_INFINITY
  const shown = board.rows.slice(0, Math.min(Math.max(limit, 0), variantCap))
  return (
    <div className="dash-fill" onMouseEnter={() => play.pauseOnHover && setHeld(true)} onMouseLeave={() => setHeld(false)}>
      <div className="hot-tabs">
        {(['微博', '百度'] as const).map((name) => (
          <button key={name} type="button" aria-pressed={platform === name} onClick={() => setPlatform(name)}>{name}</button>
        ))}
        <span>{board.observedAt ? formatStamp(board.observedAt) : '没有快照'}</span>
      </div>
      <ul className="screen-list hot-rows" ref={ref}>
        {board.rows.length === 0 && <li className="screen-empty">这个平台在当前范围没有热搜快照。</li>}
        {shown.map((item, index) => {
          const delta = rankDelta(item)
          const eventId = resolveEventId(item)
          const change = delta.kind === 'unknown' ? '—' : delta.kind === 'new' ? '新' : delta.kind === 'up' ? `↑${delta.label.replace(/\D/g, '')}` : delta.kind === 'down' ? `↓${delta.label.replace(/\D/g, '')}` : delta.kind === 'flat' ? '平' : delta.label
          return (
            <li key={item.id} className={index < 3 ? 'is-top' : ''}>
              <button type="button" title={`${item.title} · ${delta.kind === 'unknown' ? '—' : delta.label}${item.heat > 0 ? ` · 热度 ${item.heat}` : ''}`} onClick={() => eventId ? onHot(eventId) : onNews(news.filter((newsItem) => newsItem.topicId === item.topicId), item.title)}>
                <i>{item.rank}</i>
                <strong>{item.title}</strong>
                <em className={delta.kind === 'up' || delta.kind === 'new' ? 'is-up' : delta.kind === 'down' ? 'is-down' : ''}>{change}</em>
                <small>{item.heat > 0 ? item.heat : ''}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TopicBubbles({ news, motion, full, onNews }: { news: NewsItem[]; motion: boolean; full: boolean; onNews: (items: NewsItem[], title: string) => void }) {
  const theme = useDashTheme()
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const item of news) {
    const row = counts.get(item.topicId) ?? { id: item.topicId, name: item.topicId, count: 0 }
    row.count += 1
    counts.set(item.topicId, row)
  }
  const all = [...counts.values()].map((item) => ({ ...item, name: topicById[item.id]?.name ?? item.id })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  const frame = useBox()
  const aspect = frame.w > 0 && frame.h > 0 ? frame.w / frame.h : 1
  const room = frame.w > 0 && frame.h > 0 ? frame.w * frame.h : 0
  const cap = full || room > 280000 ? Math.min(8, all.length) : Math.min(6, all.length)
  const shown = all.slice(0, Math.max(4, cap) > all.length ? all.length : Math.min(all.length, cap))
  const packed = packBubbles(shown, aspect, theme.bubble)
  const [active, setActive] = useState(shown[0]?.id ?? '')
  return (
    <div className="dash-chart bubble-panel" ref={frame.ref}>
      {shown.length === 0 ? <p className="screen-empty">当前范围没有主题。</p> : (
        <>
          <p className="screen-note">展示前 {shown.length} 个主题{all.length > shown.length ? `，其余 ${all.length - shown.length} 个未画出` : ''}。</p>
          <svg viewBox={`0 0 ${packed.width} ${packed.height}`} preserveAspectRatio="xMidYMid meet" className={motion ? 'bubble-svg is-enter' : 'bubble-svg'} role="img" aria-label="主题报道分布，气泡面积对应当前范围报道数">
            {packed.items.map((item) => (
              <g key={item.id} onClick={() => { setActive(item.id); onNews(news.filter((newsItem) => newsItem.topicId === item.id), item.name) }}>
                <title>{item.name} · {item.count} 篇</title>
                <circle cx={item.x} cy={item.y} r={item.r} fill={active === item.id ? theme.highlight : item.color} fillOpacity="0.92" />
                <text x={item.x} y={item.y - item.r * 0.08} textAnchor="middle" fill={theme.bubbleInk} fontSize={Math.max(item.r * 0.28, packed.height * 0.045)}>
                  {wrapName(item.name, item.r).map((line, index) => (
                    <tspan key={line} x={item.x} dy={index === 0 ? 0 : Math.max(item.r * 0.32, packed.height * 0.05)}>{line}</tspan>
                  ))}
                </text>
              </g>
            ))}
          </svg>
        </>
      )}
    </div>
  )
}

function TrendChart({ news, scope, onNews }: { news: NewsItem[]; scope: ScreenScope; onNews: (items: NewsItem[], title: string) => void }) {
  const theme = useDashTheme()
  const motion = useDashMotion()
  const frame = useBox()
  const range = dateRangeOf(scope)
  const days = new Map(eachDate(range.start, range.end).map((day) => [day, 0]))
  for (const item of news) {
    const day = item.publishedAt.slice(0, 10)
    if (!days.has(day)) continue
    days.set(day, (days.get(day) ?? 0) + 1)
  }
  const rows = [...days.entries()]
  const peak = rows.reduce<{ day: string; count: number } | null>((best, item) => item[1] > 0 && (!best || item[1] > best.count) ? { day: item[0], count: item[1] } : best, null)
  const peakEvents = peak
    ? [...news.filter((item) => item.publishedAt.slice(0, 10) === peak.day).reduce((map, item) => {
      const row = map.get(item.eventId) ?? { name: item.eventName, count: 0 }
      row.count += 1
      map.set(item.eventId, row)
      return map
    }, new Map<string, { name: string; count: number }>()).values()].sort((a, b) => b.count - a.count).slice(0, 2)
    : []
  const option: EChartsCoreOption = {
    animationDuration: motion ? 600 : 0,
    animationDurationUpdate: motion ? 400 : 0,
    grid: { left: 36, right: 12, top: 16, bottom: frame.h > 0 && frame.h < 200 ? 16 : 26 },
    tooltip: { trigger: 'axis', backgroundColor: theme.tooltipBg, borderColor: theme.border, textStyle: { color: theme.tooltipInk } },
    xAxis: { type: 'category', data: rows.map((item) => item[0].slice(5)), axisLabel: { color: theme.muted, fontSize: 11, interval: frame.w > 0 && frame.w < 280 ? 1 : 0 }, axisLine: { lineStyle: { color: theme.split } }, axisTick: { show: false } },
    yAxis: { type: 'value', minInterval: 1, name: '篇', nameTextStyle: { color: theme.muted, fontSize: 11 }, axisLabel: { color: theme.muted, fontSize: 11 }, splitLine: { lineStyle: { color: theme.split } } },
    series: [{
      id: 'reports',
      type: 'line',
      data: rows.map((item) => item[1]),
      symbol: 'circle',
      symbolSize: 6,
      smooth: false,
      lineStyle: { color: theme.accent, width: 2, shadowBlur: theme.mapGlow ? 6 : 0, shadowColor: alpha(theme.accent, 0.45) },
      itemStyle: { color: theme.accent },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: alpha(theme.accent, theme.id === 'light-business' ? 0.22 : 0.28) }, { offset: 1, color: alpha(theme.accent, 0.02) }] } },
      markPoint: peak ? { symbol: 'circle', symbolSize: 10, itemStyle: { color: theme.highlight }, data: [{ coord: [peak.day.slice(5), peak.count] }] } : undefined,
    }],
  }
  return (
    <div className="dash-chart" ref={frame.ref}>
      {rows.length === 0 ? <p className="screen-empty">当前范围没有可按日统计的日期。</p> : (
        <EChart option={option} onClick={(params) => {
          const row = rows[params.dataIndex ?? -1]
          if (!row) return
          onNews(news.filter((item) => item.publishedAt.slice(0, 10) === row[0]), `${row[0]}的报道`)
        }} />
      )}
      <p className="screen-note">{range.start.slice(5)} 至 {range.end.slice(5)} · 篇。{peak ? `峰值 ${peak.day.slice(5)}，${peak.count} 篇。${peakEvents.map((item) => item.name).join('、')}` : rows.length ? '各日报道数为 0。' : ''}</p>
    </div>
  )
}

function FocusNews({ news, pinnedId, play, heldOutside, interactive, wide, onNews }: { news: NewsItem[]; pinnedId: string; play: PresentationSettings; heldOutside: boolean; interactive: boolean; wide: boolean; onNews: (items: NewsItem[], title: string) => void }) {
  const rows = [...news].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
  const pinned = rows.find((item) => item.id === pinnedId)
  const deck = pinned ? [pinned] : rows.slice(0, 6)
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  const spot = deck.length ? index % deck.length : 0
  const item = deck[spot]
  useEffect(() => {
    if (!play.autoplay || pinned || held || heldOutside || deck.length < 2) return
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setIndex((current) => current + 1)
    }, Math.max(8, play.intervalSeconds) * 1000)
    return () => window.clearInterval(timer)
  }, [play.autoplay, play.intervalSeconds, pinned, held, heldOutside, deck.length])
  if (!item) return <p className="screen-empty">当前范围没有报道。</p>
  const excerpt = item.summary.trim() || item.body.trim().replace(/\s+/g, ' ').slice(0, wide ? 120 : 72)
  return (
    <div className={wide ? 'focus-news is-wide' : 'focus-news'} onMouseEnter={() => play.pauseOnHover && setHeld(true)} onMouseLeave={() => setHeld(false)}>
      <button type="button" className="focus-card" disabled={!interactive} onClick={() => onNews([item], item.title)}>
        <strong>{item.title}</strong>
        {excerpt && <em>{excerpt}</em>}
        <span className="focus-meta">{item.mediaName} · {formatStamp(item.publishedAt)}{item.nature === 'real' ? '' : <> · <i className="sim-mark">模拟</i></>}</span>
      </button>
      {deck.length > 1 && (
        <div className="focus-dots">
          {deck.map((row, dot) => (
            <button key={row.id} type="button" aria-label={`第 ${dot + 1} 条`} aria-pressed={dot === spot} onClick={() => setIndex(dot)} />
          ))}
        </div>
      )}
    </div>
  )
}

function HourHeat({ news, scope, columns }: { news: NewsItem[]; scope: ScreenScope; columns?: 8 | 12 }) {
  const range = dateRangeOf(scope)
  const days = eachDate(range.start, range.end)
  const day = days[days.length - 1] ?? ''
  const counts = Array.from({ length: 24 }, () => 0)
  for (const item of news) {
    if (item.publishedAt.slice(0, 10) !== day) continue
    counts[hourOf(item.publishedAt)] += 1
  }
  const total = counts.reduce((sum, value) => sum + value, 0)
  const max = Math.max(...counts, 1)
  if (!day) return <p className="screen-empty">当前范围没有可选择的自然日。</p>
  return (
    <div className="dash-fill hour-heat">
      <p className="screen-note">{day} · 北京时间 · 只统计这一天，不把多日按小时相加。颜色表示该小时报道数。</p>
      {total === 0 ? <p className="screen-empty">这一天没有收录报道，不能画成 24 个零。</p> : (
        <HourGrid day={day} counts={counts} max={max} columns={columns} />
      )}
    </div>
  )
}

function PeerChart({ rows, news, onNews }: { rows: { id: string; name: string; count: number }[]; news: NewsItem[]; onNews: (items: NewsItem[], title: string) => void }) {
  const theme = useDashTheme()
  if (rows.length === 0) return <p className="screen-empty">当前没有可对比的同行媒体。</p>
  const option: EChartsCoreOption = {
    animation: false,
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: theme.tooltipBg, borderColor: theme.border, textStyle: { color: theme.tooltipInk } },
    xAxis: { type: 'value', minInterval: 1, name: '篇', axisLabel: { color: theme.muted }, splitLine: { lineStyle: { color: theme.split } } },
    yAxis: { type: 'category', inverse: true, data: rows.map((item) => item.name), axisLabel: { color: theme.ink, fontSize: 13 } },
    series: [{ type: 'bar', data: rows.map((item) => item.count), barWidth: 12, showBackground: true, backgroundStyle: { color: theme.split }, itemStyle: { color: theme.accent2 } }],
  }
  return (
    <div className="dash-chart">
      <EChart option={option} onClick={(params) => {
        const row = rows[params.dataIndex ?? -1]
        if (!row) return
        onNews(news.filter((item) => item.mediaId === row.id), row.name)
      }} />
      <p className="screen-note">已收录篇数，不是该媒体的全部发稿。</p>
    </div>
  )
}

function SourceChart({ news, limit = 6, onNews }: { news: NewsItem[]; limit?: number; onNews: (items: NewsItem[], title: string) => void }) {
  const theme = useDashTheme()
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const item of news) {
    const row = counts.get(item.mediaId) ?? { id: item.mediaId, name: item.mediaName, count: 0 }
    row.count += 1
    counts.set(item.mediaId, row)
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  const rows = ranked.slice(0, limit)
  const rest = ranked.slice(rows.length)
  if (ranked.length === 0) return <p className="screen-empty">当前范围没有来源机构。</p>
  const option: EChartsCoreOption = {
    animation: false,
    grid: { left: 8, right: 36, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: theme.tooltipBg, borderColor: theme.border, textStyle: { color: theme.tooltipInk } },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { color: theme.muted }, splitLine: { lineStyle: { color: theme.split } } },
    yAxis: { type: 'category', inverse: true, data: rows.map((item) => item.name), axisLabel: { color: theme.ink, fontSize: 13 }, axisTick: { show: false } },
    series: [{
      type: 'bar',
      data: rows.map((item, index) => ({
        value: item.count,
        itemStyle: {
          color: index === 0
            ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: alpha(theme.highlight, 0.55) }, { offset: 1, color: theme.highlight }] }
            : { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: alpha(theme.accent, 0.45) }, { offset: 1, color: theme.accent }] },
        },
      })),
      barWidth: 12,
      label: { show: true, position: 'right', color: theme.ink, formatter: '{c}' },
    }],
  }
  return (
    <div className="dash-chart">
      <EChart option={option} onClick={(params) => {
        const row = rows[params.dataIndex ?? -1]
        if (!row) return
        onNews(news.filter((item) => item.mediaId === row.id), row.name)
      }} />
      <p className="screen-note">当前范围已收录篇数，不是影响力或质量评分。{rest.length ? `另有 ${rest.length} 家。` : ''}</p>
    </div>
  )
}

function CoverageMatrix({ news, mediaIds, primary, onNews }: { news: NewsItem[]; mediaIds: string[]; primary: boolean; onNews: (items: NewsItem[], title: string) => void }) {
  const theme = useDashTheme()
  const model = coverageMatrix(news, mediaIds)
  const box = useBox()
  const maxEvents = primary ? 6 : 4
  const maxMedia = primary ? 5 : 3
  const colRoom = Math.max(1, Math.floor((box.w - 132) / 72))
  const rowRoom = Math.max(1, Math.floor((box.h - 72) / 36))
  const media = model.media.slice(0, Math.min(maxMedia, box.w ? colRoom : maxMedia))
  const events = model.events.slice(0, Math.min(maxEvents, box.h ? rowRoom : maxEvents))
  const max = Math.max(1, ...events.flatMap((event) => media.map((item) => model.cells.get(`${event.id}\t${item.id}`)?.length ?? 0)))
  return (
    <div className="dash-fill matrix-wrap" ref={box.ref}>
      <p className="screen-note">当前展示 {events.length} 个事件 / {media.length} 家媒体。{model.usingMonitor ? '媒体沿用当前监控范围。' : ''}单元格是已收录篇数。</p>
      {events.length === 0 || media.length === 0 ? <p className="screen-empty">当前范围没有可列入矩阵的事件或媒体。</p> : (
        <table className="coverage-matrix">
          <thead>
            <tr>
              <th>事件</th>
              {media.map((item) => <th key={item.id}>{item.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <th>{event.name}</th>
                {media.map((item) => {
                  const articles = model.cells.get(`${event.id}\t${item.id}`) ?? []
                  const count = articles.length
                  return (
                    <td key={item.id} style={{ background: count ? alpha(theme.accent, 0.16 + 0.7 * count / max) : 'transparent' }}>
                      {count ? (
                        <button type="button" onClick={() => onNews(articles, `${event.name} · ${item.name}`)}>{count}</button>
                      ) : <span title="本次范围未收录">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="screen-note">“—”表示本次范围未收录，不是该媒体未报道。</p>
      <SpaceNote show={primary && (events.length < Math.min(maxEvents, model.events.length) || media.length < Math.min(maxMedia, model.media.length))} />
    </div>
  )
}

function HourGrid({ day, counts, max, columns }: { day: string; counts: number[]; max: number; columns?: 8 | 12 }) {
  const theme = useDashTheme()
  const frame = useBox()
  const wide = columns ? columns === 12 : frame.w <= 0 || frame.h <= 0 || frame.w / frame.h >= 1.7
  return (
    <div className={wide ? 'hour-grid' : 'hour-grid is-compact'} ref={frame.ref} role="img" aria-label={`${day} 各小时报道数`}>
      {counts.map((count, hour) => (
        <span key={hour} className={count === 0 ? 'is-zero' : ''} title={`${hour}时 ${count} 篇`} style={{ background: count === 0 ? 'transparent' : alpha(theme.accent, 0.2 + 0.75 * count / max), color: count / max > 0.72 && theme.id === 'light-business' ? '#FFFFFF' : undefined }}>
          <i>{hour}</i>
          <b>{count}</b>
        </span>
      ))}
    </div>
  )
}

function ProgressLine({ news, eventId, primary, showHints, vertical, onNews, onHot }: { news: NewsItem[]; eventId: string; primary: boolean; showHints: boolean; vertical?: boolean; onNews: (items: NewsItem[], title: string) => void; onHot: (eventId: string) => void }) {
  const events = eventRanks(news, 'latest')
  const current = eventId && events.some((item) => item.id === eventId) ? eventId : events[0]?.id ?? ''
  const name = events.find((item) => item.id === current)?.name ?? ''
  const view = progressView(current, news)
  const frame = useBox()
  const known = frame.w > 0 && frame.h > 0
  const aspect = known ? frame.w / frame.h : 1.6
  const direction = useRef<'horizontal' | 'vertical' | null>(null)
  if (known && direction.current == null) direction.current = aspect < 1.2 ? 'vertical' : 'horizontal'
  else if (aspect < 1.15) direction.current = 'vertical'
  else if (aspect > 1.45) direction.current = 'horizontal'
  const cap = vertical ? 6 : 4
  const ordered = [...view.nodes].sort((a, b) => a.timeLabel.localeCompare(b.timeLabel) || a.id.localeCompare(b.id))
  const nodes = ordered.slice(0, cap)
  if (!current) return <p className="screen-empty">当前范围没有事件。</p>
  return (
    <div className="dash-fill" ref={frame.ref}>
      <p className="screen-note">{name}</p>
      {view.freshCount > 0 && <p className="screen-note">新增 {view.freshCount} 篇，进展待更新。</p>}
      {!view.hasAnalysis || nodes.length === 0 ? (
        <div className="screen-empty">
          <p>暂无可展示进展</p>
          <button type="button" className="text-link" onClick={() => onHot(current)}>查看事件详情</button>
        </div>
      ) : (
        <ol className={direction.current === 'vertical' ? 'progress-line is-vertical' : 'progress-line progress-rail'}>
          {nodes.map((node) => (
            <li key={node.id}>
              <button type="button" onClick={() => onNews(NEWS.filter((item) => node.articleIds.includes(item.id)), node.title)}>
                <time>{node.timeLabel || '时间未记录'}</time>
                <strong>{node.title}</strong>
                {primary && <em>{node.summary}</em>}
                <span>{primary ? `${node.kind === 'commentary' ? '相关解读' : '事实进展'} · ` : ''}{node.articleIds.length} 条来源{primary && node.reportedTime ? ' · 时间取自报道' : ''}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {view.nodes.length > nodes.length && <button type="button" className="text-link" onClick={() => onHot(current)}>查看完整进展</button>}
      <SpaceNote show={showHints && primary && view.nodes.length > nodes.length} />
    </div>
  )
}

function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, w: box.w, h: box.h }
}

function SpaceNote({ show }: { show: boolean }) {
  if (!show) return null
  return <p className="screen-note">当前空间不足以展示完整主位内容。</p>
}

function useFitRows(ref: { current: HTMLElement | null }, rowHeight: number, setLimit: (value: number) => void) {
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => {
      const row = node.querySelector('li:has(button)')
      const used = row instanceof HTMLElement ? row.offsetHeight : rowHeight
      setLimit(Math.max(0, Math.floor(node.clientHeight / Math.max(used, 1))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, rowHeight, setLimit])
}

function packBubbles(items: { id: string; name: string; count: number }[], aspect: number, colors: readonly string[]) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? Math.min(2.4, Math.max(0.55, aspect)) : 1
  const width = safeAspect >= 1 ? roundBox(100 * safeAspect) : 100
  const height = safeAspect >= 1 ? 100 : roundBox(100 / safeAspect)
  const max = Math.max(...items.map((item) => item.count), 1)
  const weights = items.map((item) => 0.65 + Math.sqrt(item.count / max))
  const weightSum = weights.reduce((sum, value) => sum + value, 0)
  let scale = 1
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const placed: { id: string; name: string; count: number; x: number; y: number; r: number; color: string }[] = []
    let failed = false
    for (const [index, item] of items.entries()) {
      const share = width * height * 0.74 * ((weights[index] ?? 1) / weightSum) * scale
      const radius = Math.sqrt(share / Math.PI)
      let spot: { x: number; y: number } | null = null
      for (let step = 0; step < 720; step += 1) {
        const angle = step * 0.62
        const dist = step * Math.min(width, height) * 0.0034
        const x = width / 2 + Math.cos(angle) * dist
        const y = height / 2 + Math.sin(angle) * dist
        const clear = x - radius > 1 && x + radius < width - 1 && y - radius > 1 && y + radius < height - 1
        const free = placed.every((other) => Math.hypot(other.x - x, other.y - y) >= other.r + radius + Math.min(width, height) * 0.01)
        if (clear && free) { spot = { x, y }; break }
      }
      if (!spot) { failed = true; break }
      placed.push({ ...item, ...spot, r: radius, color: colors[index % colors.length] ?? colors[0] ?? '#35C5EF' })
    }
    if (!failed) return { width, height, items: placed }
    scale *= 0.86
  }
  return {
    width,
    height,
    items: items.map((item, index) => ({
      ...item,
      x: width * (0.22 + (index % 3) * 0.28),
      y: height * (index < 3 ? 0.32 : 0.7),
      r: Math.min(width, height) * 0.12,
      color: colors[index % colors.length] ?? colors[0] ?? '#35C5EF',
    })),
  }
}

function wrapName(name: string, radius: number) {
  const size = radius > 18 ? 6 : 4
  if (name.length <= size) return [name]
  const mid = Math.ceil(name.length / 2)
  return [name.slice(0, mid), name.slice(mid)].filter(Boolean)
}

function roundBox(value: number) {
  return Math.round(value * 10) / 10
}
