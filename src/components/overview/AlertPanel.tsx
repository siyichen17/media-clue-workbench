import { useMemo, useState } from 'react'
import { ALERT_KIND_LABEL, sortAlerts } from '../../lib/alerts.ts'
import { formatStamp } from '../../lib/dates.ts'
import { WATCH_KEYWORDS } from '../../data/demo/index.ts'
import type { AlertKind, OverviewAlert } from '../../types/domain.ts'

export function AlertPanel({
  alerts,
  readIds,
  onOpen,
  onToggleRead,
}: {
  alerts: OverviewAlert[]
  readIds: Set<string>
  onOpen: (alert: OverviewAlert) => void
  onToggleRead: (alertId: string) => void
}) {
  const [mode, setMode] = useState<'latest' | 'magnitude'>('latest')
  const sorted = useMemo(() => sortAlerts(alerts, mode), [alerts, mode])
  let previousKind: AlertKind | null = null

  return (
    <div className="alert-panel">
      <div className="alert-toolbar">
        <div className="segmented" role="group" aria-label="提醒排序">
          <button type="button" aria-pressed={mode === 'latest'} onClick={() => setMode('latest')}>
            最新
          </button>
          <button type="button" aria-pressed={mode === 'magnitude'} onClick={() => setMode('magnitude')}>
            变化幅度
          </button>
        </div>
      </div>
      <p className="chart-note">预设关注关键词：{WATCH_KEYWORDS.join('、')}。报道增加只在相邻日期的新闻条数至少多 2 条时生成。</p>
      {mode === 'magnitude' && (
        <p className="chart-note">变化幅度按提醒类型分组。排名变化只与排名变化比较，报道条数只与报道条数比较。</p>
      )}
      {sorted.length === 0 ? (
        <div className="empty-state">当前筛选下没有可核查的动态提醒</div>
      ) : (
        <ul className="alert-list" data-testid="alert-list">
          {sorted.map((alert) => {
            const showGroup = mode === 'magnitude' && alert.kind !== previousKind
            previousKind = alert.kind
            const read = readIds.has(alert.id)
            return (
              <li key={alert.id}>
                {showGroup && <p className="alert-group">{ALERT_KIND_LABEL[alert.kind]}</p>}
                <article className={read ? 'alert-item read' : 'alert-item'}>
                  <button type="button" className="alert-main" onClick={() => onOpen(alert)}>
                    <span className="alert-kind">{ALERT_KIND_LABEL[alert.kind]}</span>
                    <strong>{alert.topicName}</strong>
                    <span className="alert-time">{formatStamp(alert.triggerAt)}</span>
                    <span className="alert-summary">{alert.summary}</span>
                    <span className="alert-magnitude">{alert.magnitudeLabel}</span>
                  </button>
                  <button type="button" className="btn tiny" onClick={() => onToggleRead(alert.id)}>
                    {read ? '标为未读' : '标为已读'}
                  </button>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
