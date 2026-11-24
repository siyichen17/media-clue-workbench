import type { EChartsCoreOption } from 'echarts'
import { EChart } from '../components/overview/EChart.tsx'
import { MEDIA } from '../data/demo/index.ts'
import type { NewsItem } from '../types/domain.ts'
import type { CanvasWidget } from './protoCatalog.ts'
import { PROTO_WIDGETS } from './protoCatalog.ts'
import { competeTrend, kpiText, newsForMedia, newsOnDay, type ProtoPack } from './protoData.ts'

const AXIS = '#94a3b8'
const SPLIT = 'rgba(42,58,92,0.45)'
const BLUE = '#60a5fa'
const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f87171', '#fbbf24']

function baseAxis(labels: string[]): EChartsCoreOption {
  return {
    grid: { left: 36, right: 12, top: 16, bottom: 28, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels, axisLabel: { color: AXIS, fontSize: 11 }, axisLine: { lineStyle: { color: SPLIT } } },
    yAxis: { type: 'value', name: '篇', nameTextStyle: { color: AXIS, fontSize: 11 }, axisLabel: { color: AXIS, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT } } },
  }
}

export function WidgetBody({
  widget,
  pack,
  mode,
  editing,
  onOpen,
}: {
  widget: CanvasWidget
  pack: ProtoPack
  mode: 'thumb' | 'full'
  editing: boolean
  onOpen: (title: string, items: NewsItem[]) => void
}) {
  const kind = PROTO_WIDGETS[widget.type]?.type
  if (mode === 'thumb') {
    if (kind === 'kpi') {
      return (
        <div className="proto-thumb-kpi">
          <div className="proto-thumb-kpi-value">{kpiText(pack, widget.title)}</div>
          <div className="proto-handle">{widget.title}</div>
        </div>
      )
    }
    return <div className="proto-handle proto-thumb-title">{widget.title}</div>
  }
  if (kind === 'kpi') {
    return (
      <div className="proto-full-kpi">
        <div className="proto-kpi-value">{kpiText(pack, widget.title)}</div>
        <div className="proto-handle">{widget.title}</div>
      </div>
    )
  }
  return (
    <div className="proto-panel">
      <h4 className="proto-handle">{widget.title}</h4>
      <div className={editing ? 'proto-body is-locked' : 'proto-body'}>
        <FullBody widget={widget} pack={pack} onOpen={onOpen} />
      </div>
    </div>
  )
}

function FullBody({ widget, pack, onOpen }: { widget: CanvasWidget; pack: ProtoPack; onOpen: (title: string, items: NewsItem[]) => void }) {
  const kind = PROTO_WIDGETS[widget.type]?.type
  if (kind === 'line') {
    const trend = widget.title === '趋势图' ? null : pack.daily
    if (widget.title === '趋势图') {
      const series = competeTrend()
      if (!series.series.length) return <p className="proto-empty">暂无数据</p>
      const option: EChartsCoreOption = {
        ...baseAxis(series.dates),
        legend: { textStyle: { color: AXIS, fontSize: 11 }, top: 0 },
        grid: { left: 36, right: 12, top: 28, bottom: 28, containLabel: true },
        series: series.series.map((item, index) => ({
          type: 'line',
          name: item.name,
          data: item.data,
          showSymbol: false,
          lineStyle: { width: 2, color: COLORS[index % COLORS.length] },
        })),
      }
      return <EChart option={option} />
    }
    const option: EChartsCoreOption = {
      ...baseAxis(trend!.map((item) => item.date.slice(5))),
      series: [{ type: 'line', data: trend!.map((item) => item.count), showSymbol: false, lineStyle: { width: 2.5, color: BLUE } }],
    }
    return <EChart option={option} onClick={(params) => {
      const point = trend![params.dataIndex ?? -1]
      if (point) onOpen(widget.title, newsOnDay(pack, point.date))
    }} />
  }
  if (kind === 'bar') {
    const rows = widget.title === '声量对比' ? pack.peerBars : pack.mediaBars
    if (!rows.length) return <p className="proto-empty">暂无数据</p>
    const option: EChartsCoreOption = {
      ...baseAxis(rows.map((item) => item.name)),
      series: [{ type: 'bar', data: rows.map((item) => item.count), itemStyle: { color: BLUE, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 22 }],
    }
    return <EChart option={option} onClick={(params) => {
      const row = rows[params.dataIndex ?? -1]
      if (row) onOpen(row.name, newsForMedia(pack, row.id))
    }} />
  }
  if (kind === 'pie') return <p className="proto-empty">暂无情感分类</p>
  if (kind === 'map') return <p className="proto-empty">暂无地理数据</p>
  if (kind === 'progress') return <p className="proto-empty">暂无进度数据</p>
  if (kind === 'heatmap') {
    const model = pack.heatmap
    if (!model.topics.length) return <p className="proto-empty">暂无数据</p>
    const data: [number, number, number][] = []
    model.matrix.forEach((row, y) => row.forEach((value, x) => data.push([x, y, value])))
    const option: EChartsCoreOption = {
      grid: { left: 8, right: 12, top: 8, bottom: 8, containLabel: true },
      tooltip: { formatter: (params: { value?: [number, number, number] }) => {
        const value = params.value
        if (!value) return ''
        return `${model.topics[value[1]]?.name ?? ''} ${value[0]}时 ${value[2]}篇`
      } },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, hour) => String(hour)), axisLabel: { color: AXIS, fontSize: 10, interval: 2 } },
      yAxis: { type: 'category', data: model.topics.map((item) => item.name), axisLabel: { color: AXIS, fontSize: 11 } },
      visualMap: { show: false, min: 0, max: Math.max(model.max, 1), inRange: { color: ['#13233b', '#60a5fa'] } },
      series: [{ type: 'heatmap', data }],
    }
    return <EChart option={option} />
  }
  if (kind === 'wordcloud') {
    if (!pack.topics.length) return <p className="proto-empty">暂无数据</p>
    const max = pack.topics[0]?.count || 1
    return (
      <div className="proto-cloud">
        {pack.topics.map((item, index) => (
          <button key={item.id} type="button" style={{ fontSize: 12 + Math.round((item.count / max) * 10), color: COLORS[index % COLORS.length] }} onClick={() => onOpen(item.name, pack.news.filter((news) => news.topicId === item.id))}>
            {item.name}
          </button>
        ))}
      </div>
    )
  }
  if (kind === 'alert') {
    if (!pack.alerts.length) return <p className="proto-empty">暂无告警</p>
    return (
      <ul className="proto-list">
        {pack.alerts.slice(0, 12).map((alert) => (
          <li key={alert.id}>
            <button type="button" onClick={() => onOpen(alert.topicName, pack.news.filter((item) => alert.newsIds.includes(item.id)))}>
              <i className={alert.kind === 'rank_rise' ? 'dot blue' : 'dot amber'} />
              <span>{alert.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  if (kind === 'timeline') {
    if (!pack.timeline.length) return <p className="proto-empty">暂无时间线</p>
    return (
      <ul className="proto-list">
        {pack.timeline.map((item) => (
          <li key={item.time + item.text}>
            <button type="button" onClick={() => onOpen(item.time, item.news)}>
              <i className="dot blue" />
              <span><b>{item.time}</b> {item.text}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  if (kind === 'table' && widget.title === '热搜榜单') {
    if (!pack.hotRows.length) return <p className="proto-empty">暂无热榜</p>
    return (
      <ol className="proto-list proto-rank">
        {pack.hotRows.map((item) => <li key={`${item.rank}-${item.title}`}><b>{item.rank}</b><span>{item.title}</span></li>)}
      </ol>
    )
  }
  if (kind === 'table' || kind === 'scrolllist') {
    const rows = kind === 'table'
      ? pack.news.filter((item) => item.mediaId !== 'cover').slice(0, 12)
      : pack.news.slice(0, 12)
    if (!rows.length) return <p className="proto-empty">暂无数据</p>
    return (
      <ul className="proto-list">
        {rows.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onOpen(item.title, [item])}>
              <span>{item.title}</span>
              <small>{MEDIA.find((media) => media.id === item.mediaId)?.name} {item.publishedAt.slice(5, 16).replace('T', ' ')}</small>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  return <p className="proto-empty">暂无数据</p>
}
