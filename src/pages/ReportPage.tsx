import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { CompareResult, SectionKey } from '../../shared/aiTypes.ts'
import { AiRequestError, requestSection } from '../lib/aiClient.ts'
import { toAiMaterial } from '../lib/generateReport.ts'
import { profileName, loadMediaState } from '../lib/competeStorage.ts'
import { formatStamp } from '../lib/dates.ts'
import { levelLabel, natureLabel } from '../lib/material.ts'
import { attachReport, visibleLeads } from '../lib/leads.ts'
import { MONITOR_NEWS } from '../data/demo/monitor.ts'
import { buildReportStats, snapshotMaterial } from '../lib/reportStats.ts'
import { ensureRevision, finalizeReport, isFinal, materialChanges, normalizeReport, statusLabel } from '../lib/reportMeta.ts'
import { listReports, loadReport, saveReport } from '../lib/reportStore.ts'
import type { MaterialSnapshot, ReportDocument, ReportSections } from '../types/report.ts'

const TOC = [
  ['scope', '比较范围与材料说明'],
  ['stats', '数据概览'],
  ['compare', '核心对比'],
  ['diff', '主要差异'],
  ['summary', '对比总结'],
  ['actions', '下一步建议'],
  ['refs', '参考材料'],
] as const

export function ReportPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const leadFromState = (location.state as { leadId?: string } | null)?.leadId
  const linkedLeadId = leadFromState || visibleLeads().find((lead) => lead.reportRefs.some((ref) => ref.reportId === id))?.id
  const [report, setReport] = useState<ReportDocument | null>(null)
  const [missing, setMissing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<SectionKey | 'title' | 'notes' | null>(null)
  const [evidenceId, setEvidenceId] = useState<string | null>(null)
  const [activeToc, setActiveToc] = useState('scope')
  const [preview, setPreview] = useState<{ section: SectionKey; result: Partial<CompareResult> } | null>(null)
  const [instruction, setInstruction] = useState('')
  const [sectionError, setSectionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [versions, setVersions] = useState<ReportDocument[]>([])
  const [finalAsk, setFinalAsk] = useState(false)
  const profiles = loadMediaState().profiles
  const printOnOpen = Boolean((location.state as { print?: boolean } | null)?.print)

  useEffect(() => {
    let cancelled = false
    void loadReport(id).then((loaded) => {
      if (cancelled) return
      if (!loaded) setMissing(true)
      else {
        setReport(normalizeReport(loaded))
        if (printOnOpen) window.setTimeout(() => window.print(), 300)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, printOnOpen])

  useEffect(() => {
    if (!report?.groupId) return
    void listReports().then((rows) => {
      setVersions(rows.map(normalizeReport).filter((item) => item.groupId === report.groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    }).catch(() => setSaveError('版本列表读取失败。'))
  }, [report?.groupId, report?.id])

  useEffect(() => {
    if (!dirty) return
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  useEffect(() => {
    const nodes = TOC.map(([key]) => document.getElementById(`sec-${key}`)).filter((node): node is HTMLElement => Boolean(node))
    if (!nodes.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActiveToc(visible.target.id.replace('sec-', ''))
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [report])

  const evidence = report?.materials.find((item) => item.articleId === evidenceId) ?? null
  const extract = report?.extraction.find((item) => item.articleId === evidenceId) ?? null
  const numberOf = useMemo(() => {
    const map = new Map<string, number>()
    report?.materials.forEach((item, index) => map.set(item.articleId, index + 1))
    return map
  }, [report])

  function patch(mutator: (current: ReportDocument) => ReportDocument) {
    if (report && isFinal(report)) return
    setReport((current) => (current ? mutator(current) : current))
    setDirty(true)
  }

  async function persist(next: ReportDocument) {
    if (isFinal(next) && dirty) {
      setSaveError('已定稿版本不能直接改写。请先创建修订草稿。')
      return
    }
    const now = new Date().toISOString()
    const saved = normalizeReport({ ...next, status: isFinal(next) ? 'final' : 'draft', updatedAt: now, editedAt: now })
    try {
      await saveReport(saved)
    } catch {
      setSaveError('保存失败，这次修改没有写入。')
      return
    }
    if (leadFromState) attachReport(leadFromState, saved.id, saved.materials.length)
    saved.leadIds?.forEach((leadId) => attachReport(leadId, saved.id, saved.materials.length))
    setReport(saved)
    setDirty(false)
    setSaveError('')
  }

  function tryLeave() {
    if (dirty) setLeaveOpen(true)
    else navigate('/reports')
  }

  async function regenerate(section: SectionKey) {
    if (!report || busy || isFinal(report) || (report.type !== 'date' && report.type !== 'event')) return
    setBusy(true)
    setSectionError('')
    try {
      const result = await requestSection({
        section,
        instruction,
        kind: report.type,
        stats: report.stats,
        materials: report.materials.map(toAiMaterial),
        extracts: report.extraction,
        mediaIds: report.scope.mediaIds,
        sections: report.sections,
      })
      setPreview({ section, result })
    } catch (error) {
      setSectionError(error instanceof AiRequestError ? error.message : '这一节没有生成')
    } finally {
      setBusy(false)
    }
  }

  function applyPreview() {
    if (!report || !preview) return
    const sections = structuredClone(report.sections)
    const history = { ...report.history }
    if (preview.section === 'comparison' && preview.result.comparisonDimensions) {
      history.comparison = [...(history.comparison ?? []), report.sections.comparisonDimensions]
      sections.comparisonDimensions = preview.result.comparisonDimensions
    }
    if (preview.section === 'differences' && preview.result.keyDifferences) {
      history.differences = [...(history.differences ?? []), report.sections.keyDifferences]
      sections.keyDifferences = preview.result.keyDifferences
    }
    if (preview.section === 'summary' && preview.result.summary) {
      history.summary = [...(history.summary ?? []), report.sections.summary]
      sections.summary = preview.result.summary
    }
    if (preview.section === 'actions' && preview.result.nextActions) {
      history.actions = [...(history.actions ?? []), report.sections.nextActions]
      sections.nextActions = preview.result.nextActions
    }
    const next = { ...report, sections, history, status: 'draft' as const, finalizedAt: null }
    void persist(next)
    setPreview(null)
    setEditing(null)
  }

  function restore(section: SectionKey) {
    if (!report) return
    const sections = structuredClone(report.sections)
    const history = { ...report.history }
    if (section === 'comparison' && history.comparison?.length) sections.comparisonDimensions = history.comparison.pop()!
    if (section === 'differences' && history.differences?.length) sections.keyDifferences = history.differences.pop()!
    if (section === 'summary' && history.summary?.length) sections.summary = history.summary.pop()!
    if (section === 'actions' && history.actions?.length) sections.nextActions = history.actions.pop()!
    void persist({ ...report, sections, history, status: 'draft', finalizedAt: null })
  }

  async function acceptNewMaterials() {
    if (!report) return
    const changes = materialChanges(report)
    const base = isFinal(report) ? await ensureRevision(report) : structuredClone(report)
    const known = new Set(base.materials.map((item) => item.articleId))
    const extras = changes.added.filter((item) => !known.has(item.id)).map((item) => snapshotMaterial(item, profiles))
    const materials = [...base.materials, ...extras]
    const stats = buildReportStats(changes.pool.length ? changes.pool : MONITOR_NEWS, materials, base.scope, profiles)
    const now = new Date().toISOString()
    const replacingOpenDraft = isFinal(report) && base.id !== report.id
    const id = replacingOpenDraft ? base.id : `rpt-${Date.now().toString(36)}`
    const next = normalizeReport({
      ...base,
      id,
      versionId: id,
      groupId: report.groupId || report.id,
      parentVersionId: replacingOpenDraft ? base.parentVersionId : report.id,
      materials,
      stats,
      updatedAt: now,
      editedAt: now,
      status: 'draft',
      finalizedAt: null,
      createdAt: replacingOpenDraft ? base.createdAt : now,
    })
    await saveReport(next)
    navigate(`/reports/${next.id}`)
    setReport(next)
    setDirty(false)
  }

  if (missing) {
    return (
      <main className="page">
        <h1>没有找到报告</h1>
        <button type="button" className="btn" onClick={() => navigate('/compete')}>返回竞品监控</button>
      </main>
    )
  }
  if (!report) return <main className="page">正在读取报告</main>

  const names = (mediaId: string) => profileName(profiles, mediaId) || report.materials.find((item) => item.mediaId === mediaId)?.mediaName || mediaId
  const locked = isFinal(report)
  const changes = materialChanges(report)
  const toc = report.narrative?.length
    ? [['scope', '范围与材料'], ['stats', '数据概览'], ...report.narrative.map((chapter) => [chapter.id, chapter.title] as const), ['refs', '参考材料']]
    : TOC

  return (
    <main className="report-page">
      <header className="report-toolbar no-print">
        <button type="button" className="btn ghost" onClick={tryLeave}>返回</button>
        <button type="button" className="btn ghost" onClick={() => navigate('/compete')}>返回竞品监控</button>
        {linkedLeadId && <button type="button" className="btn ghost" onClick={() => navigate(`/leads?lead=${linkedLeadId}`)}>返回线索</button>}
        {report.scope.eventId && <button type="button" className="btn ghost" onClick={() => navigate('/hot')}>返回热搜</button>}
        <div>
          {editing === 'title' && !locked ? (
            <input
              aria-label="报告标题"
              value={report.title}
              onChange={(event) => patch((current) => ({ ...current, title: event.target.value }))}
            />
          ) : (
            <h1>{report.title}</h1>
          )}
          <p className="chart-note">{statusLabel(report)}{dirty ? ' · 有未保存修改' : ' · 已保存'}{locked ? ' · 只读' : ''}</p>
        </div>
        {!locked && <button type="button" className="btn tiny" onClick={() => setEditing(editing === 'title' ? null : 'title')}>编辑标题</button>}
        {!locked && <button type="button" className="btn active" onClick={() => void persist(report)}>保存草稿</button>}
        {!locked && <button type="button" className="btn" onClick={() => { if (dirty) setSaveError('请先保存草稿，再定稿。'); else setFinalAsk(true) }}>定稿</button>}
        {locked && <button type="button" className="btn active" onClick={() => void ensureRevision(report).then((next) => navigate(`/reports/${next.id}`))}>创建修订</button>}
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (dirty) {
              setSectionError('请先保存。导出使用已保存的编辑版本。')
              return
            }
            window.print()
          }}
        >
          导出
        </button>
        <label className="field">
          版本
          <select value={report.id} onChange={(event) => navigate(`/reports/${event.target.value}`)}>
            {versions.map((item) => <option key={item.id} value={item.id}>{statusLabel(item)} · {item.createdAt.slice(0, 16).replace('T', ' ')}</option>)}
          </select>
        </label>
      </header>
      <div className="report-layout">
        <nav className="report-toc no-print" aria-label="章节">
          {toc.map(([key, label]) => (
            <a key={key} href={`#sec-${key}`} className={activeToc === key ? 'active' : undefined}>{label}</a>
          ))}
        </nav>
        <article className="report-sheet">
          <p className="sim-banner">
            {report.stats.simulatedCount && !report.stats.realCount ? '模拟演示报告。结论只描述本次选中的演示材料，不是媒体真实发表内容。' : '报告包含真实与模拟材料，请按参考材料中的标记区分。'}
          </p>
          <p className="chart-note">数量以生成时的系统统计为准。引用编号只说明依据来自本次材料，不能代替正文，也不能证明事实已经全部核实。</p>
          {!locked && <p className="draft-mark">草稿</p>}
          {saveError && <p className="sim-banner no-print">{saveError}</p>}
          {sectionError && <p className="sim-banner no-print">{sectionError}</p>}
          {changes.hasChange && (
            <p className="sim-banner no-print">
              {changes.added.length ? `有新增材料 ${changes.added.length} 篇。` : ''}
              {changes.revised.length ? `原材料已修订 ${changes.revised.length} 篇。` : ''}
              {changes.removed.length ? `材料关联变化 ${changes.removed.length} 篇。` : ''}
              旧版本的统计和正文不会自动改写。
              <button type="button" className="btn tiny" onClick={() => void acceptNewMaterials()}>更新材料到新草稿</button>
            </p>
          )}

          <section id="sec-scope">
            <h2>{report.narrative?.length ? '范围与材料' : '比较范围与材料说明'}</h2>
            <p>{report.scope.samplingNote || '范围以生成时选定的材料和快照为准。'}</p>
            <p>
              统计区间 {report.stats.rangeLabel}。
              {report.extraction.length ? `已处理 ${report.materials.length} 篇材料，基于分批分析结果汇总。` : `模型阅读材料 ${report.stats.analyzedCount} 篇。`}
              全文 {report.stats.fullCount}、摘要 {report.stats.summaryCount}、仅标题 {report.stats.titleCount}。
              模拟 {report.stats.simulatedCount} 篇，真实 {report.stats.realCount} 篇。
            </p>
            {report.scope.hotBoard && report.scope.hotBoard.length > 0 && (
              <>
                <h3>期间观测汇总</h3>
                <p className="chart-note">按最佳观测榜位、再按命中快照次数排列。这不是平台官方日榜或周报。</p>
                <table className="data-table">
                  <thead><tr><th>平台</th><th>原始热搜词</th><th>最佳观测榜位</th><th>命中快照</th><th>首次观测</th><th>最后观测</th></tr></thead>
                  <tbody>
                    {report.scope.hotBoard.map((item) => (
                      <tr key={`${item.platform}-${item.title}`}>
                        <td>{item.platform}</td>
                        <td>{item.title}</td>
                        <td>{item.bestRank}</td>
                        <td>{item.hits}</td>
                        <td>{item.first.slice(0, 16).replace('T', ' ')}</td>
                        <td>{item.last.slice(0, 16).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <ul>
              {report.sections.limitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section id="sec-stats">
            <h2>数据概览</h2>
            <p>已收录报道 {report.stats.newsCount} 篇，事件 {report.stats.eventCount} 个，涉及上榜话题的报道 {report.stats.hotNewsCount} 篇。下表来自生成时的统计快照。</p>
            <StatTable report={report} names={names} />
          </section>

          {report.narrative?.map((chapter) => (
            <section id={`sec-${chapter.id}`} key={chapter.id}>
              <h2>{chapter.title}</h2>
              {chapter.paragraphs.map((paragraph, index) => paragraph.text.trim() ? (
                <p key={`${chapter.id}-${index}`}>
                  {locked ? paragraph.text : (
                    <textarea
                      rows={Math.min(14, Math.max(3, Math.ceil(paragraph.text.length / 36)))}
                      value={paragraph.text}
                      onChange={(event) => patch((current) => {
                        const narrative = structuredClone(current.narrative ?? [])
                        const target = narrative.find((item) => item.id === chapter.id)
                        if (target) target.paragraphs[index].text = event.target.value
                        return { ...current, narrative }
                      })}
                    />
                  )}
                  <CiteList ids={paragraph.articleIds} numberOf={numberOf} onOpen={setEvidenceId} />
                </p>
              ) : null)}
              {chapter.limitation && chapter.limitation !== '-' && <p className="chart-note">{chapter.limitation}</p>}
            </section>
          ))}
          {Boolean(report.narrative?.length) && (
            <label className="field">
              用户备注
              <textarea disabled={locked} value={report.notes} onChange={(event) => patch((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          )}

          {!report.narrative?.length && (
          <>
          <section id="sec-compare">
            <SectionHead locked={locked}
              title="核心对比"
              editing={editing === 'comparison'}
              canRestore={Boolean(report.history.comparison?.length)}
              onEdit={() => setEditing(editing === 'comparison' ? null : 'comparison')}
              onRegen={() => void regenerate('comparison')}
              onRestore={() => restore('comparison')}
              busy={busy}
            />
            <div className="compare-board">
              {report.sections.comparisonDimensions.map((dimension, dimensionIndex) => (
                <section key={dimension.dimension} className="compare-dimension">
                  <h3>{dimension.dimension}</h3>
                  <div className="compare-findings">
                    {report.scope.mediaIds.map((mediaId) => {
                      const finding = dimension.mediaFindings.find((item) => item.mediaId === mediaId)
                      return (
                        <article key={mediaId} className="compare-finding">
                          <h4>{names(mediaId)}</h4>
                          {!finding ? (
                            <p>所选材料中没有该媒体的报道</p>
                          ) : (
                            <>
                              {editing === 'comparison' ? (
                                <textarea
                                  value={finding.text}
                                  onChange={(event) => patch((current) => {
                                    const sections = structuredClone(current.sections)
                                    const target = sections.comparisonDimensions[dimensionIndex].mediaFindings.find((item) => item.mediaId === mediaId)
                                    if (target) target.text = event.target.value
                                    return { ...current, sections }
                                  })}
                                />
                              ) : (
                                <p>{finding.text}</p>
                              )}
                              <CiteList ids={finding.articleIds} numberOf={numberOf} onOpen={setEvidenceId} />
                              {editing === 'comparison' && (
                                <CitationEditor
                                  mediaId={mediaId}
                                  materials={report.materials}
                                  ids={finding.articleIds}
                                  onChange={(articleIds) => patch((current) => {
                                    const sections = structuredClone(current.sections)
                                    const target = sections.comparisonDimensions[dimensionIndex].mediaFindings.find((item) => item.mediaId === mediaId)
                                    if (target) target.articleIds = articleIds
                                    return { ...current, sections }
                                  })}
                                />
                              )}
                            </>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section id="sec-diff">
            <SectionHead locked={locked} title="主要差异" editing={editing === 'differences'} canRestore={Boolean(report.history.differences?.length)} onEdit={() => setEditing(editing === 'differences' ? null : 'differences')} onRegen={() => void regenerate('differences')} onRestore={() => restore('differences')} busy={busy} />
            {report.sections.keyDifferences.length === 0 ? <p>本次材料里没有足够依据写出明确差异。</p> : (
              <ol>
                {report.sections.keyDifferences.map((item, index) => (
                  <li key={`${item.text.slice(0, 12)}-${index}`}>
                    {editing === 'differences' ? (
                      <textarea value={item.text} onChange={(event) => patch((current) => {
                        const sections = structuredClone(current.sections)
                        sections.keyDifferences[index].text = event.target.value
                        return { ...current, sections }
                      })} />
                    ) : item.text}
                    <CiteList ids={item.articleIds} numberOf={numberOf} onOpen={setEvidenceId} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section id="sec-summary">
            <SectionHead locked={locked} title="对比总结" editing={editing === 'summary'} canRestore={Boolean(report.history.summary?.length)} onEdit={() => setEditing(editing === 'summary' ? null : 'summary')} onRegen={() => void regenerate('summary')} onRestore={() => restore('summary')} busy={busy} />
            {editing === 'summary' ? (
              <textarea value={report.sections.summary.text} onChange={(event) => patch((current) => ({ ...current, sections: { ...current.sections, summary: { ...current.sections.summary, text: event.target.value } } }))} />
            ) : <p>{report.sections.summary.text}</p>}
            <CiteList ids={report.sections.summary.articleIds} numberOf={numberOf} onOpen={setEvidenceId} />
          </section>

          <section id="sec-actions">
            <SectionHead locked={locked} title="下一步建议" editing={editing === 'actions'} canRestore={Boolean(report.history.actions?.length)} onEdit={() => setEditing(editing === 'actions' ? null : 'actions')} onRegen={() => void regenerate('actions')} onRestore={() => restore('actions')} busy={busy} />
            <ul>
              {report.sections.nextActions.map((item, index) => (
                <li key={index}>
                  {editing === 'actions' ? (
                    <textarea value={item.text} onChange={(event) => patch((current) => {
                      const sections: ReportSections = structuredClone(current.sections)
                      sections.nextActions[index].text = event.target.value
                      return { ...current, sections }
                    })} />
                  ) : item.text}
                  <CiteList ids={item.basedOnArticleIds} numberOf={numberOf} onOpen={setEvidenceId} />
                </li>
              ))}
            </ul>
            <label className="field">
              用户备注
              <textarea disabled={locked} value={report.notes} onChange={(event) => patch((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </section>
          </>
          )}

          <section id="sec-refs">
            <h2>参考材料</h2>
            <ol className="ref-list">
              {report.materials.map((item) => (
                <li key={item.articleId} id={`ref-${item.articleId}`}>
                  <button type="button" className="text-button" onClick={() => setEvidenceId(item.articleId)}>{item.title}</button>
                  <span className="news-meta">
                    <span>{item.mediaName}</span>
                    <span>{formatStamp(item.publishedAt)}</span>
                    <span>{levelLabel(item.completeness)}</span>
                    <span>{natureLabel(item.nature)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </article>
        <aside className={evidence ? 'evidence' : 'evidence hidden'} aria-label="证据">
          {evidence && (
            <>
              <div className="title-row">
                <h2>证据</h2>
                <button type="button" className="icon-button" aria-label="关闭证据" onClick={() => setEvidenceId(null)}>×</button>
              </div>
              <p>{evidence.title}</p>
              <p className="news-meta"><span>{evidence.mediaName}</span><span>{evidence.columnName}</span><span>{formatStamp(evidence.publishedAt)}</span></p>
              <p className="sim-banner">{evidence.nature === 'simulated' ? '演示模拟稿件，非该媒体真实发布。下面是站内全文，不是媒体官网链接。' : '真实材料。原文保存在站内，不另造外部链接。'}</p>
              <button type="button" className="btn tiny" onClick={() => document.getElementById('evidence-body')?.scrollIntoView({ block: 'nearest' })}>
                {evidence.nature === 'simulated' ? '站内全文' : '查看原文'}
              </button>
              {extract && (
                <ul>
                  {extract.facts.map((fact) => <li key={fact.quote}>摘录：{fact.quote}</li>)}
                  {extract.attributed.map((fact) => <li key={fact.quote}>{fact.who}：{fact.quote}</li>)}
                </ul>
              )}
              <div id="evidence-body">
                {(evidence.body || evidence.summary || evidence.title).split('\n\n').map((paragraph) => <p key={paragraph.slice(0, 20)}>{paragraph}</p>)}
              </div>
            </>
          )}
        </aside>
      </div>
      <label className="field no-print regen-note">
        重新生成时的修改要求
        <input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：只保留能在摘录里核对的差异" />
      </label>
      {preview && (
        <div className="modal-root">
          <div className="drawer-mask" />
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <header className="drawer-head"><h2 id="preview-title">确认替换这一节</h2></header>
            <div className="drawer-scroll">
              <p>当前编辑不会被直接覆盖，确认后才替换，并保留上一版。</p>
              <pre className="preview-block">{JSON.stringify(preview.result, null, 2)}</pre>
            </div>
            <footer className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setPreview(null)}>取消</button>
              <button type="button" className="btn active" onClick={applyPreview}>确认替换</button>
            </footer>
          </section>
        </div>
      )}
      {finalAsk && (
        <div className="modal-root">
          <div className="drawer-mask" />
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="final-title">
            <header className="drawer-head"><h2 id="final-title">确认定稿</h2></header>
            <p className="drawer-scroll">定稿表示你确认这一版。它不会自动归档线索，也不表示已经交接或已阅读。之后要修改，会另开修订草稿。</p>
            <footer className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setFinalAsk(false)}>取消</button>
              <button type="button" className="btn active" onClick={() => void finalizeReport(report).then((next) => { setReport(next); setFinalAsk(false); setDirty(false) })}>保存定稿</button>
            </footer>
          </section>
        </div>
      )}
      {leaveOpen && (
        <div className="modal-root">
          <div className="drawer-mask" />
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <header className="drawer-head"><h2 id="leave-title">有未保存的修改</h2></header>
            <p className="drawer-scroll">可以先保存当前编辑，或放弃这些修改后离开。</p>
            <footer className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setLeaveOpen(false)}>取消</button>
              <button type="button" className="btn" onClick={() => navigate('/reports')}>放弃修改</button>
              <button type="button" className="btn active" onClick={() => void persist(report).then(() => navigate('/reports'))}>保存并离开</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}

function StatTable({ report, names }: { report: ReportDocument; names: (id: string) => string }) {
  return (
    <div className="table-wrap">
      <table className="data-table compare-table">
        <thead>
          <tr>
            <th>媒体</th><th>已收录</th><th>事件</th><th>涉及上榜报道</th><th>进入分析</th><th>所选最早</th><th>所选最近</th>
          </tr>
        </thead>
        <tbody>
          {report.stats.byMedia.map((item) => (
            <tr key={item.mediaId}>
              <th>{names(item.mediaId)}</th>
              <td>{item.newsCount}</td>
              <td>{item.eventCount}</td>
              <td>{item.hotNewsCount}</td>
              <td>{item.selectedCount}</td>
              <td>{item.earliest ? formatStamp(item.earliest) : '—'}</td>
              <td>{item.latest ? formatStamp(item.latest) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.type === 'date' && (
        <table className="data-table">
          <caption>分类收录，按生成时快照</caption>
          <thead>
            <tr>
              <th>分类</th>
              {report.scope.mediaIds.map((id) => <th key={id}>{names(id)}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.stats.byCategory.map((row) => (
              <tr key={row.name}>
                <th>{row.name}</th>
                {report.scope.mediaIds.map((id) => <td key={id}>{row.counts[id] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SectionHead({
  title,
  editing,
  canRestore,
  busy,
  onEdit,
  onRegen,
  onRestore,
  locked = false,
}: {
  title: string
  editing: boolean
  canRestore: boolean
  busy: boolean
  onEdit: () => void
  onRegen: () => void
  onRestore: () => void
  locked?: boolean
}) {
  if (locked) return <div className="title-row"><h2>{title}</h2></div>
  return (
    <div className="title-row">
      <h2>{title}</h2>
      <button type="button" className="btn tiny no-print" onClick={onEdit}>{editing ? '完成编辑' : '编辑'}</button>
      <button type="button" className="btn tiny no-print" disabled={busy} onClick={onRegen}>重新生成</button>
      {canRestore && <button type="button" className="btn tiny no-print" onClick={onRestore}>恢复上一版</button>}
    </div>
  )
}

function CiteList({ ids, numberOf, onOpen }: { ids: string[]; numberOf: Map<string, number>; onOpen: (id: string) => void }) {
  if (!ids.length) return null
  return (
    <span className="cite-list">
      {ids.map((id) => (
        <button key={id} type="button" className="cite" onClick={() => onOpen(id)}>[{numberOf.get(id) ?? '?'}]</button>
      ))}
    </span>
  )
}

function CitationEditor({
  mediaId,
  materials,
  ids,
  onChange,
}: {
  mediaId: string
  materials: MaterialSnapshot[]
  ids: string[]
  onChange: (ids: string[]) => void
}) {
  const choices = materials.filter((item) => item.mediaId === mediaId)
  return (
    <label className="field no-print">
      引用
      <select
        value=""
        onChange={(event) => {
          const articleId = event.target.value
          if (!articleId || ids.includes(articleId)) return
          onChange([...ids, articleId])
        }}
      >
        <option value="">添加引用</option>
        {choices.map((item) => <option key={item.articleId} value={item.articleId}>{item.title}</option>)}
      </select>
      {ids.map((id) => (
        <button key={id} type="button" className="btn tiny" onClick={() => onChange(ids.filter((item) => item !== id))}>
          移除 {id}
        </button>
      ))}
    </label>
  )
}
