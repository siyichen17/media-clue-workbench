import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from '../../data/demo/catalog.ts'
import { MONITOR_NEWS } from '../../data/demo/monitor.ts'
import { AiRequestError } from '../../lib/aiClient.ts'
import { filterMonitorNews, sharedEvents } from '../../lib/competeSelectors.ts'
import type { CompeteFilters, MediaProfile } from '../../lib/competeStorage.ts'
import { profileName } from '../../lib/competeStorage.ts'
import { dateRangeOf, formatStamp, presetLabel } from '../../lib/dates.ts'
import { generateReportDocument, IncompleteMaterialsError } from '../../lib/generateReport.ts'
import { levelLabel, materialLevel, natureLabel } from '../../lib/material.ts'
import { buildReportStats, snapshotMaterial } from '../../lib/reportStats.ts'
import type { NewsItem } from '../../types/domain.ts'
import type { ReportScope } from '../../types/report.ts'

export function ReportWizard({
  filters,
  profiles,
  initialType,
  initialEventId,
  initialRange,
  onClose,
  onCreated,
}: {
  filters: CompeteFilters
  profiles: MediaProfile[]
  initialType: 'date' | 'event'
  initialEventId?: string
  initialRange?: { start: string; end: string }
  onClose: () => void
  onCreated: (id: string, materialCount: number) => void
}) {
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState(initialType)
  const [scopeFilters, setScopeFilters] = useState<CompeteFilters>(() =>
    initialRange ? { ...filters, preset: 'custom', customStart: initialRange.start, customEnd: initialRange.end } : filters,
  )
  const [eventId, setEventId] = useState(initialEventId ?? '')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [samplingNote, setSamplingNote] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [incomplete, setIncomplete] = useState(false)
  const [running, setRunning] = useState(false)
  const range = dateRangeOf(scopeFilters)
  const scopeKey = `${kind}|${eventId}|${range.start}|${range.end}|${scopeFilters.categoryId}|${scopeFilters.ownMediaId}|${scopeFilters.peerIds.join(',')}|${scopeFilters.nature}`

  useEffect(() => {
    setPicked(null)
    setSamplingNote(null)
  }, [scopeKey])
  const scoped = useMemo(() => filterMonitorNews(scopeFilters).news, [scopeFilters])
  const events = useMemo(() => {
    const grouped = new Map<string, NewsItem[]>()
    for (const item of scoped) {
      const list = grouped.get(item.eventId) ?? []
      list.push(item)
      grouped.set(item.eventId, list)
    }
    return [...grouped.entries()].map(([id, rows]) => ({
      id,
      name: rows[0].eventName,
      mediaCount: new Set(rows.map((item) => item.mediaId)).size,
    }))
  }, [scoped])
  const eventNews = kind === 'event' ? scoped.filter((item) => item.eventId === eventId) : scoped
  const materials = useMemo(
    () => eventNews.map((item) => snapshotMaterial(item, profiles)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [eventNews, profiles],
  )
  const selectedIds = picked ?? new Set(materials.map((item) => item.articleId))
  const selected = materials.filter((item) => selectedIds.has(item.articleId))
  const mediaIds = [scopeFilters.ownMediaId, ...scopeFilters.peerIds.filter((id) => id !== scopeFilters.ownMediaId)]
  const covered = new Set(selected.map((item) => item.mediaId))
  const readyMedia = mediaIds.filter((id) => covered.has(id))
  const eventCount = new Set(selected.map((item) => item.eventId).filter(Boolean)).size
  const canGenerate = readyMedia.length >= 2 && !running && (kind === 'date' || Boolean(eventId))

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
    setSamplingNote(null)
  }

  async function generate(allowPartial = false) {
    if (!canGenerate || running) return
    setRunning(true)
    setError('')
    setIncomplete(false)
    const event = events.find((item) => item.id === eventId) ?? null
    const reportFilters: CompeteFilters = { ...scopeFilters, preset: 'custom', customStart: range.start, customEnd: range.end }
    const reportScope: ReportScope = {
      kind,
      filters: reportFilters,
      eventId: kind === 'event' ? eventId : null,
      eventName: kind === 'event' ? event?.name ?? null : null,
      mediaIds,
      samplingNote,
    }
    const stats = buildReportStats(
      kind === 'event' ? eventNews : filterMonitorNews(reportFilters, MONITOR_NEWS).news,
      selected,
      reportScope,
      profiles,
    )
    const title = kind === 'event' ? `${event?.name ?? '事件'}内容对比` : `${range.start} 至 ${range.end} 报道结构对比`
    try {
      const report = await generateReportDocument({
        title,
        scope: reportScope,
        stats,
        materials: selected,
        onStage: setStage,
        allowPartial,
      })
      onCreated(report.id, selected.length)
    } catch (caught) {
      if (caught instanceof IncompleteMaterialsError) {
        setIncomplete(true)
        setError(caught.message)
      } else {
        const message = caught instanceof AiRequestError ? caught.message : caught instanceof Error ? caught.message : '报告生成失败'
        setError(message)
      }
      setStage(null)
      setRunning(false)
    }
  }

  return (
    <div className="modal-root">
      <button type="button" className="drawer-mask" aria-label="关闭报告配置" onClick={running ? undefined : onClose} />
      <section className="modal-panel wide" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <header className="drawer-head">
          <div>
            <h2 id="wizard-title">生成对比报告</h2>
            <p className="chart-note">第 {step} 步 / 3 · {['确定范围', '确认材料', '生成'][step - 1]}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={running} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="drawer-scroll">
          {step === 1 && (
            <div className="stack">
              <div className="segmented" role="group" aria-label="报告类型">
                <button type="button" aria-pressed={kind === 'date'} onClick={() => setKind('date')}>
                  日期对比报告
                </button>
                <button type="button" aria-pressed={kind === 'event'} onClick={() => setKind('event')}>
                  同一事件对比报告
                </button>
              </div>
              <p className="chart-note">
                {kind === 'date'
                  ? '比较这段时间各家关注什么、报道结构有什么差异。不同事件不做事实覆盖比较。'
                  : '只比较同一个事件里各家写了什么。未收录不等于没有报道。'}
              </p>
              <div className="filter-controls">
                <div className="segmented">
                  {(['7d', '14d', 'custom'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={scopeFilters.preset === preset}
                      onClick={() => setScopeFilters((current) => ({ ...current, preset }))}
                    >
                      {presetLabel(preset)}
                    </button>
                  ))}
                </div>
                <label className="field">
                  开始
                  <input
                    type="date"
                    value={range.start}
                    onChange={(event) =>
                      setScopeFilters((current) => ({ ...current, preset: 'custom', customStart: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  结束
                  <input
                    type="date"
                    value={range.end}
                    onChange={(event) =>
                      setScopeFilters((current) => ({ ...current, preset: 'custom', customEnd: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                本媒体
                <select
                  value={scopeFilters.ownMediaId}
                  onChange={(event) =>
                    setScopeFilters((current) => ({
                      ...current,
                      ownMediaId: event.target.value,
                      peerIds: current.peerIds.filter((id) => id !== event.target.value),
                    }))
                  }
                >
                  {profiles.filter((item) => item.enabled).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="check-grid">
                <legend>对照媒体</legend>
                {profiles
                  .filter((item) => item.enabled && item.id !== scopeFilters.ownMediaId)
                  .map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={scopeFilters.peerIds.includes(item.id)}
                        onChange={(event) =>
                          setScopeFilters((current) => ({
                            ...current,
                            peerIds: event.target.checked
                              ? [...current.peerIds, item.id]
                              : current.peerIds.filter((id) => id !== item.id),
                          }))
                        }
                      />
                      {item.name}
                    </label>
                  ))}
              </fieldset>
              <label className="field">
                分类
                <select
                  value={scopeFilters.categoryId}
                  onChange={(event) => setScopeFilters((current) => ({ ...current, categoryId: event.target.value }))}
                >
                  <option value="all">全部分类</option>
                  {CATEGORIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {kind === 'event' && (
                <label className="field">
                  事件
                  <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                    <option value="">选择事件</option>
                    {events.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.mediaCount} 家媒体
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="chart-note">当前范围内有共同事件 {sharedEvents(scoped, scopeFilters.ownMediaId).length} 个。事件按 eventId 区分，不按关键词合并。</p>
            </div>
          )}
          {step === 2 && (
            <div className="stack">
              <div className="title-row">
                <strong>已选 {selected.length} 篇 / 范围内 {materials.length} 篇</strong>
                <button type="button" className="btn tiny" onClick={() => setPicked(new Set(materials.map((item) => item.articleId)))}>
                  全选当前筛选结果
                </button>
                <button type="button" className="btn tiny" onClick={() => setPicked(new Set())}>
                  全部取消
                </button>
              </div>
              <p className="chart-note">
                统计范围是当前条件下的已收录报道 {eventNews.length} 篇。模型只阅读勾选的 {selected.length} 篇，其中全文 {selected.filter((item) => item.completeness === 'full').length}、摘要 {selected.filter((item) => item.completeness === 'summary').length}、仅标题 {selected.filter((item) => item.completeness === 'title').length}。
              </p>
              {selected.some((item) => item.completeness === 'title') && (
                <p className="sim-banner">存在仅标题材料。这类材料只能做主题对照，不能比较正文内容。</p>
              )}
              {mediaIds.filter((id) => !covered.has(id)).length > 0 && (
                <p className="chart-note">
                  以下媒体在所选材料中为空，报告会保留空列：
                  {mediaIds.filter((id) => !covered.has(id)).map((id) => profileName(profiles, id)).join('、')}
                </p>
              )}
              {mediaIds.map((mediaId) => {
                const rows = materials.filter((item) => item.mediaId === mediaId)
                return (
                  <section key={mediaId}>
                    <h3>
                      {profileName(profiles, mediaId)} · 已选 {rows.filter((item) => selectedIds.has(item.articleId)).length} / {rows.length}
                    </h3>
                    {rows.length === 0 ? (
                      <p className="chart-note">所选条件下没有该媒体的材料。</p>
                    ) : (
                      rows.map((item) => (
                        <article key={item.articleId} className="pick-row">
                          <label>
                            <input type="checkbox" checked={selectedIds.has(item.articleId)} onChange={() => toggle(item.articleId)} />
                            <span>{item.title}</span>
                          </label>
                          <span className="news-meta">
                            <span>{formatStamp(item.publishedAt)}</span>
                            <span>{levelLabel(item.completeness)}</span>
                            <span>{natureLabel(item.nature)}</span>
                          </span>
                          <button type="button" className="btn tiny" onClick={() => setOpenId(openId === item.articleId ? null : item.articleId)}>
                            {openId === item.articleId ? '收起正文' : '查看正文'}
                          </button>
                          {openId === item.articleId && (
                            <div className="editor-block">
                              <p className="sim-banner">
                                {item.nature === 'simulated' ? '模拟报道，非该媒体实际发布。此处只展示站内全文。' : '站内保存的原文。'}
                              </p>
                              <p>{item.summary || '没有摘要。'}</p>
                              {(item.body || item.title).split('\n\n').map((paragraph) => (
                                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                              ))}
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </section>
                )
              })}
            </div>
          )}
          {step === 3 && (
            <div className="stack">
              <p>
                已选 {selected.length} 篇报道，涉及 {readyMedia.length} 家已选媒体、{eventCount} 个事件。
                {selected.length > 12 ? ' 将分批分析，生成时间可能较长。' : ''}
              </p>
              {samplingNote && <p className="chart-note">{samplingNote}</p>}
              {readyMedia.length < 2 && <p className="sim-banner">至少需要两家媒体各有一条已选材料。</p>}
              {selected.some((item) => materialLevel(item) === 'title') && (
                <p className="chart-note">仅标题材料不会被用来判断正文深度。</p>
              )}
              {stage && <p className="chart-note">当前阶段：{stage}</p>}
              {error && (
                <div className="sim-banner">
                  <p>{error}</p>
                  <p>已完成的提取会保留。重试只处理未完成材料，不会把失败材料悄悄排除后当成全部完成。</p>
                  {incomplete && (
                    <button type="button" className="btn" onClick={() => void generate(true)}>先生成已完成部分</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="modal-foot">
          {step > 1 && (
            <button type="button" className="btn ghost" disabled={running} onClick={() => setStep((value) => value - 1)}>
              上一步
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="btn active"
              disabled={kind === 'event' && !eventId}
              onClick={() => setStep((value) => value + 1)}
            >
              下一步
            </button>
          )}
          {step === 3 && (
            <button type="button" className="btn active" disabled={!canGenerate} onClick={() => void generate(false)}>
              {running ? '正在生成' : error ? '重试' : '开始生成'}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
