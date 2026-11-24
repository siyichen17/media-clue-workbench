const METRICS = [
  {
    id: 'news',
    label: '新闻数',
    tip: '按发布时间计入。只统计当前日期、发布平台和关键词下的新闻条数。',
  },
  {
    id: 'topics',
    label: '话题数',
    tip: '上述新闻关联的话题数量。同一个话题只计一次。',
  },
  {
    id: 'media',
    label: '覆盖媒体数',
    tip: '上述新闻涉及的媒体机构数量。栏目不单独计数。',
  },
  {
    id: 'hot',
    label: '热榜条目数',
    tip: '当前日期内，微博与百度热榜按“平台 + 稳定条目”去重，多次上榜只计 1 条。关键词匹配条目标题或话题名。发布平台选“微博”时只计微博热榜；选其他平台时，只保留能关联到该平台新闻的条目。热度不跨平台比较。',
  },
] as const

export function MetricCards({ values }: { values: Record<(typeof METRICS)[number]['id'], number> }) {
  return (
    <section className="metric-grid" aria-label="指标">
      {METRICS.map((metric) => (
        <article key={metric.id} className="metric-card" data-testid={`metric-${metric.id}`}>
          <div className="metric-label">
            <h2>{metric.label}</h2>
            <button type="button" className="info-tip" aria-label={metric.tip} title={metric.tip}>
              口径
            </button>
          </div>
          <p className="metric-value">{values[metric.id].toLocaleString('zh-CN')}</p>
        </article>
      ))}
    </section>
  )
}
