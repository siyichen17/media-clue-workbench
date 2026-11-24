import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivityHeatmap } from '../components/overview/ActivityHeatmap.tsx'
import { AlertPanel } from '../components/overview/AlertPanel.tsx'
import { ChartCard } from '../components/overview/ChartCard.tsx'
import { DailyNewsChart } from '../components/overview/DailyNewsChart.tsx'
import { FilterBar } from '../components/overview/FilterBar.tsx'
import { HorizontalBarChart } from '../components/overview/HorizontalBarChart.tsx'
import { MetricCards } from '../components/overview/MetricCards.tsx'
import { TopicBubbleChart } from '../components/overview/TopicBubbleChart.tsx'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { CATEGORY_COLORS, categoryById, topicById } from '../data/demo/index.ts'
import { DATA_AS_OF_LABEL, DATA_END, dateRangeOf, hourOf } from '../lib/dates.ts'
import { mediaColor } from '../lib/mediaColor.ts'
import {
  categoryCounts,
  dailyCounts,
  filterAlerts,
  heatmapModel,
  mediaCounts,
  newsByIds,
  pageMetrics,
  topicBubbles,
} from '../lib/overviewSelectors.ts'
import { loadFollows, loadReadAlerts, saveFollows, saveReadAlerts } from '../lib/storage.ts'
import type { DrawerModel, DrawerTag, OverviewAlert, OverviewFilters } from '../types/domain.ts'

const INITIAL_FILTERS: OverviewFilters = {
  preset: '7d',
  customStart: '2026-11-04',
  customEnd: DATA_END,
  selectedDay: null,
  platform: 'all',
  keyword: '',
}

function TopicEvents({
  topicId,
  items,
  rangeLabel,
  onClose,
  onNews,
  onProgress,
  onCompare,
}: {
  topicId: string
  items: import('../types/domain.ts').NewsItem[]
  rangeLabel: string
  onClose: () => void
  onNews: (name: string, items: import('../types/domain.ts').NewsItem[]) => void
  onProgress: (eventId: string) => void
  onCompare: (eventId: string) => void
}) {
  const topic = topicById[topicId]
  const groups = new Map<string, { id: string; name: string; items: import('../types/domain.ts').NewsItem[] }>()
  for (const item of items) {
    if (item.topicId !== topicId && !item.topicIds?.includes(topicId)) continue
    const group = groups.get(item.eventId) ?? { id: item.eventId, name: item.eventName, items: [] }
    group.items.push(item)
    groups.set(item.eventId, group)
  }
  const rows = [...groups.values()].sort((a, b) => b.items.length - a.items.length)
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{categoryById[topic.categoryId].name} / {topic.name}</h2>
          <p>当前范围 {rangeLabel}。先看这个主题下有哪些事件，再进入某一条。不同事件不会合成一条进展。</p>
        </div>
        <button type="button" className="btn tiny" onClick={onClose}>关闭</button>
      </div>
      <div className="card-body">
        {rows.map((group) => (
          <article key={group.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <h3>{group.name}</h3>
            <p>{group.items.length} 篇报道 · {new Set(group.items.map((item) => item.mediaId)).size} 家媒体</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn tiny" onClick={() => onNews(group.name, group.items)}>查看报道</button>
              <button type="button" className="btn tiny" onClick={() => onProgress(group.id)}>查看进展</button>
              <button type="button" className="btn tiny" onClick={() => onCompare(group.id)}>媒体对比</button>
            </div>
          </article>
        ))}
        {rows.length === 0 && <p>这个范围内没有该主题的报道。</p>}
      </div>
    </section>
  )
}

function toggleId(current: Set<string>, id: string, save: (ids: Set<string>) => void): Set<string> {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  save(next)
  return next
}

export function OverviewPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<OverviewFilters>(INITIAL_FILTERS)
  const [focusTopic, setFocusTopic] = useState<string | null>(null)
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => loadFollows())
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadAlerts())
  const [drawer, setDrawer] = useState<DrawerModel | null>(null)

  const metrics = useMemo(() => pageMetrics(filters), [filters])
  const trend = useMemo(() => dailyCounts(filters), [filters])
  const bubbles = useMemo(() => topicBubbles(metrics.news), [metrics.news])
  const categories = useMemo(() => categoryCounts(metrics.news), [metrics.news])
  const outlets = useMemo(() => mediaCounts(metrics.news), [metrics.news])
  const heat = useMemo(() => heatmapModel(metrics.news), [metrics.news])
  const alerts = useMemo(() => filterAlerts(filters), [filters])
  const range = dateRangeOf(filters)
  const heatCaption = filters.selectedDay
    ? `展示 ${filters.selectedDay} 当天 0–23 时发布的新闻数量。零值是浅灰，表示该小时没有新闻。`
    : `未选择单日：将 ${range.start} 至 ${range.end} 内每个话题在同一小时的新闻累加。零值是浅灰。`

  function contextTags(): DrawerTag[] {
    return [
      {
        id: 'date',
        label: filters.selectedDay ? `日期 ${filters.selectedDay}` : `日期 ${range.start} 至 ${range.end}`,
      },
      { id: 'platform', label: filters.platform === 'all' ? '全部发布平台' : `平台 ${filters.platform}` },
      ...(filters.keyword.trim() ? [{ id: 'keyword', label: `关键词 ${filters.keyword.trim()}` }] : []),
    ]
  }

  function selectDay(day: string) {
    setFilters((current) => ({ ...current, selectedDay: current.selectedDay === day ? null : day }))
  }

  function rememberRead(alertId: string) {
    setReadIds((current) => {
      if (current.has(alertId)) return current
      const next = new Set(current)
      next.add(alertId)
      saveReadAlerts(next)
      return next
    })
  }

  function openAlert(alert: OverviewAlert) {
    rememberRead(alert.id)
    const related = newsByIds(alert.newsIds)
    if (related.length === 0 && alert.snapshot) {
      setDrawer({
        kind: 'snapshot',
        summary: alert.summary,
        snapshot: alert.snapshot,
        tags: [
          { id: 'kind', label: '热榜快照' },
          { id: 'platform', label: alert.snapshot.platform },
          { id: 'item', label: alert.snapshot.title },
        ],
      })
      return
    }
    setDrawer({
      kind: 'news',
      note: `${alert.summary}列表是这条提醒引用的报道。`,
      items: related,
      tags: [
        { id: 'topic', label: `话题 ${alert.topicName}` },
        { id: 'day', label: alert.triggerAt.slice(0, 10) },
        ...(alert.snapshot ? [{ id: 'board', label: `${alert.snapshot.platform}第 ${alert.snapshot.rank} 位` }] : []),
      ],
    })
  }

  return (
    <div className="page" data-testid="overview-page">
      <header className="page-head">
        <div>
          <div className="title-row">
            <h1>线索总览</h1>
            <span className="demo-pill">模拟演示数据</span>
          </div>
          <p>从热点变化中发现值得跟进的新闻</p>
        </div>
        <p className="cutoff">
          演示数据截止时间
          <strong>{DATA_AS_OF_LABEL}</strong>
        </p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} />
      <MetricCards
        values={{
          news: metrics.newsCount,
          topics: metrics.topicCount,
          media: metrics.mediaCount,
          hot: metrics.hotCount,
        }}
      />

      {focusTopic && topicById[focusTopic] && (
        <TopicEvents
          topicId={focusTopic}
          items={metrics.news}
          rangeLabel={filters.selectedDay ?? `${range.start} 至 ${range.end}`}
          onClose={() => setFocusTopic(null)}
          onNews={(name, items) => setDrawer({ kind: 'news', tags: [...contextTags(), { id: 'event', label: name }], items })}
          onProgress={(eventId) => navigate(`/hot?event=${eventId}&topic=${focusTopic}&start=${range.start}&end=${range.end}&from=overview`)}
          onCompare={(eventId) => navigate(`/compete?event=${eventId}&start=${range.start}&end=${range.end}&from=overview`)}
        />
      )}

      <div className="overview-grid">
        <ChartCard
          title="每日新闻数量"
          caption="按发布时间统计当天全部新闻。点击某日只看这一天，折线仍保留当前日期范围；再点一次或关闭日期标签可取消。"
          testId="chart-daily"
          empty={trend.every((point) => point.count === 0)}
        >
          <DailyNewsChart points={trend} selectedDay={filters.selectedDay} onSelectDay={selectDay} />
        </ChartCard>
        <ChartCard
          title="关注话题"
          caption="一个气泡是一个话题。面积表示关联新闻数，颜色表示分类，位置只用于排布，不代表时间或其他数值。"
          testId="chart-bubble"
          empty={bubbles.length === 0}
        >
          <TopicBubbleChart
            items={bubbles}
            totalTopics={metrics.topicCount}
            onSelect={(topicId) => setFocusTopic(topicId)}
          />
        </ChartCard>
      </div>

      <div className="overview-grid">
        <ChartCard
          title="话题分类分布"
          caption="按新闻的主要分类计数，一篇新闻只计入一个分类。点击打开新闻，不改变全页统计条件。"
          testId="chart-category"
          empty={categories.length === 0}
        >
          <HorizontalBarChart
            items={categories}
            color={(item) => CATEGORY_COLORS[item.id] ?? '#2563eb'}
            onSelect={(categoryId) =>
              setDrawer({
                kind: 'news',
                tags: [...contextTags(), { id: 'category', label: `分类 ${categoryById[categoryId].name}` }],
                items: metrics.news.filter((item) => item.categoryId === categoryId),
              })
            }
          />
        </ChartCard>
        <ChartCard
          title="来源机构分布"
          caption="按媒体机构计数，栏目不单独成柱。点击打开该机构的新闻，不改变全页统计条件。"
          testId="chart-media"
          empty={outlets.length === 0}
        >
          <HorizontalBarChart
            items={outlets}
            color={(item) => mediaColor(item.id)}
            onSelect={(mediaId) => {
              const outlet = outlets.find((item) => item.id === mediaId)
              setDrawer({
                kind: 'news',
                tags: [...contextTags(), { id: 'media', label: `机构 ${outlet?.name ?? mediaId}` }],
                items: metrics.news.filter((item) => item.mediaId === mediaId),
              })
            }}
          />
        </ChartCard>
      </div>

      <div className="overview-grid overview-band">
        <ChartCard title="24小时新闻活跃度" caption={heatCaption} testId="chart-heat" empty={heat.topics.length === 0}>
          <ActivityHeatmap
            model={heat}
            onSelect={(topicId, hour) =>
              setDrawer({
                kind: 'news',
                tags: [
                  ...contextTags(),
                  { id: 'topic', label: `话题 ${topicById[topicId].name}` },
                  { id: 'hour', label: `${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59` },
                ],
                items: metrics.news.filter(
                  (item) => item.topicId === topicId && hourOf(item.publishedAt) === hour,
                ),
              })
            }
          />
        </ChartCard>
        <ChartCard
          title="动态提醒"
          caption="根据固定热榜快照、预设关注关键词和报道记录生成。点击可核对新闻或快照，不调用自动排序。"
          testId="chart-alerts"
          className="panel-scroll"
        >
          <AlertPanel
            alerts={alerts}
            readIds={readIds}
            onOpen={openAlert}
            onToggleRead={(alertId) => setReadIds((current) => toggleId(current, alertId, saveReadAlerts))}
          />
        </ChartCard>
      </div>

      <NewsDrawer
        model={drawer}
        followedIds={followedIds}
        onClose={() => setDrawer(null)}
        onToggleFollow={(newsId) => setFollowedIds((current) => toggleId(current, newsId, saveFollows))}
      />
    </div>
  )
}
