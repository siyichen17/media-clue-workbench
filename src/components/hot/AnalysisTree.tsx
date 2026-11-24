import { useEffect, useMemo, useRef, useState } from 'react'
import type { PitchCandidate, ProgressResult } from '../../../shared/aiTypes.ts'
import { branchId, branchesFromAi, type AnalysisDraft, type TreeBranch } from '../../lib/analysisDraft.ts'
import type { NewsItem } from '../../types/domain.ts'

interface ViewNode {
  id: string
  kind: 'root' | 'pending' | 'fact' | 'commentary' | 'note' | 'pitch-group' | 'pitch' | 'article'
  title: string
  summary: string
  tag: string
  branch?: TreeBranch
  news?: NewsItem
  children: ViewNode[]
}

const TAG: Record<ViewNode['kind'], string> = {
  root: '事件',
  pending: '待生成',
  fact: '事实进展',
  commentary: '相关解读',
  note: '编辑补充',
  'pitch-group': '推荐拟题',
  pitch: '选题建议',
  article: '报道',
}

export interface TreeController {
  isDirty: () => boolean
  save: () => string
  discard: () => void
}

export function AnalysisTree({
  eventTitle,
  news,
  progress,
  pitches,
  pitchError,
  busy,
  staleCount,
  draft,
  savedAt,
  bindRef,
  onGenerate,
  onRetryPitches,
  onSave,
  onAdopt,
  onOpenNews,
  onReport,
}: {
  eventTitle: string
  news: NewsItem[]
  progress: ProgressResult | null
  pitches: PitchCandidate[] | null
  pitchError: string
  busy: boolean
  staleCount: number
  draft: AnalysisDraft | null
  savedAt: string
  bindRef?: { current: TreeController | null }
  onGenerate: () => void
  onRetryPitches: (notes: string) => void
  onSave: (branches: TreeBranch[], rootTitle: string, meta: { deletedIds: string[]; previous: AnalysisDraft['previous'] }) => string
  onAdopt: (branch: TreeBranch, mode: 'keep' | 'append' | 'replace') => void
  onOpenNews: (item: NewsItem) => void
  onReport: (branch: TreeBranch) => void
}) {
  const base = useMemo(() => draft?.branches ?? branchesFromAi(progress, pitches), [draft, progress, pitches])
  const [rootTitle, setRootTitle] = useState(draft?.rootTitle || eventTitle)
  const [branches, setBranches] = useState<TreeBranch[]>(base)
  const [baseline, setBaseline] = useState<{ title: string; branches: TreeBranch[] }>({ title: draft?.rootTitle || eventTitle, branches: base })
  const [undo, setUndo] = useState<TreeBranch[][]>([])
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState('root')
  const [detailOpen, setDetailOpen] = useState(false)
  const [open, setOpen] = useState<Set<string>>(() => new Set(['root', 'pitch-root']))
  const [full, setFull] = useState(false)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [leave, setLeave] = useState(false)
  const [candidate, setCandidate] = useState<TreeBranch[] | null>(null)
  const [prior, setPrior] = useState<AnalysisDraft['previous']>(draft?.previous ?? null)
  const [deletedIds, setDeletedIds] = useState<string[]>(draft?.deletedIds ?? [])
  const [adoptFor, setAdoptFor] = useState<TreeBranch | null>(null)
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const dirtyRef = useRef(false)
  const branchesRef = useRef(branches)
  const loadedKey = useRef('')
  const seenSig = useRef('')
  const expecting = useRef(false)
  branchesRef.current = branches
  dirtyRef.current = dirty
  const scope = `${eventTitle}:${progress?.analyzedCount ?? 0}:${pitches?.map((item) => item.id).join(',') ?? ''}:${savedAt}`

  useEffect(() => {
    const incoming = branchesFromAi(progress, pitches)
    const sigOf = (rows: TreeBranch[]) => rows.map((item) => `${item.kind}:${item.id}:${item.title}`).join('|')
    if (loadedKey.current !== savedAt) {
      loadedKey.current = savedAt
      seenSig.current = sigOf(incoming)
      const next = draft?.branches ?? incoming
      setBranches(next)
      setRootTitle(draft?.rootTitle || eventTitle)
      setBaseline({ title: draft?.rootTitle || eventTitle, branches: next })
      setDeletedIds(draft?.deletedIds ?? [])
      setPrior(draft?.previous ?? null)
      setUndo([])
      setDirty(false)
      setCandidate(null)
      setSelected('root')
      return
    }
    const nextSig = sigOf(incoming)
    if (nextSig === seenSig.current) return
    seenSig.current = nextSig
    if (!expecting.current) {
      if (!draft) {
        setBranches(incoming)
        setRootTitle(eventTitle)
        setBaseline({ title: eventTitle, branches: incoming })
      }
      return
    }
    expecting.current = false
    const current = branchesRef.current
    const manual = dirty || current.some((item) => item.origin === 'editor' || item.edited)
    const factSig = (rows: TreeBranch[]) => rows.filter((item) => item.kind !== 'pitch').map((item) => `${item.id}:${item.title}`).join('|')
    const pitchSig = (rows: TreeBranch[]) => rows.filter((item) => item.kind === 'pitch').map((item) => `${item.id}:${item.title}`).join('|')
    const factsSame = factSig(current) === factSig(incoming)
    const pitchesSame = pitchSig(current) === pitchSig(incoming)
    if (factsSame && pitchesSame) return
    const deleted = new Set(deletedIds)
    const incomingPitches = incoming.filter((item) => item.kind === 'pitch' && !deleted.has(item.id))
    const hasFacts = current.some((item) => item.origin === 'ai' && item.kind !== 'pitch')
    if (!hasFacts && !manual) {
      setBranches(incoming.filter((item) => !deleted.has(item.id)))
      setCandidate(null)
      return
    }
    if (!manual && factsSame && !current.some((item) => item.kind === 'pitch') && incomingPitches.length) {
      setBranches([...current, ...incomingPitches])
      setCandidate(null)
      return
    }
    setCandidate(incoming)
  }, [scope])

  useEffect(() => {
    if (!dirty) return
    const onLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  function commit(next: TreeBranch[]) {
    setUndo((stack) => [...stack.slice(-30), branches])
    setBranches(next)
    setDirty(true)
    setError('')
  }

  const tree = useMemo(() => buildTree(rootTitle, branches, news), [rootTitle, branches, news])
  const selectedNode = findNode(tree, selected)

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addBranch(parentId: string | null, kind: TreeBranch['kind']) {
    const item: TreeBranch = {
      id: branchId(), parentId, kind, title: kind === 'pitch' ? '新的候选拟题' : '编辑补充', summary: '',
      origin: 'editor', edited: true, articleIds: [], evidence: [], timeLabel: '编辑补充',
      angle: '', question: '', reason: '', gaps: [], outline: [],
    }
    commit([...branches, item])
    setSelected(item.id)
    setOpen((current) => new Set(current).add(parentId || 'root'))
  }

  function removeBranch(id: string) {
    const ids = new Set<string>([id])
    let grew = true
    while (grew) {
      grew = false
      for (const item of branches) if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) { ids.add(item.id); grew = true }
    }
    if (ids.size > 1 && !window.confirm(`会同时移除 ${ids.size - 1} 个子节点。只影响当前分析草稿，不删除原始报道。`)) return
    setDeletedIds((current) => [...new Set([...current, ...ids])])
    commit(branches.filter((item) => !ids.has(item.id)))
    setSelected('root')
  }

  function applyCandidate(part: 'progress' | 'pitch') {
    if (!candidate) return
    const deleted = new Set(deletedIds)
    const current = branches
    setPrior({ rootTitle, branches: current, savedAt: new Date().toISOString() })
    const keptNotes = current.filter((item) => item.kind !== 'pitch' && (item.origin === 'editor' || item.edited))
    const keptPitches = current.filter((item) => item.kind === 'pitch' && (item.origin === 'editor' || item.edited))
    if (part === 'progress') {
      const fresh = candidate.filter((item) => item.kind !== 'pitch' && !deleted.has(item.id) && !keptNotes.some((note) => note.id === item.id))
      const pitchesKept = current.filter((item) => item.kind === 'pitch')
      commit([...fresh, ...keptNotes, ...pitchesKept])
    } else {
      const fresh = candidate.filter((item) => item.kind === 'pitch' && !deleted.has(item.id) && !keptPitches.some((note) => note.id === item.id))
      const facts = current.filter((item) => item.kind !== 'pitch')
      commit([...facts, ...keptPitches, ...fresh])
    }
    setCandidate(null)
  }

  function patchBranch(id: string, partial: Partial<TreeBranch>) {
    commit(branches.map((item) => item.id === id ? { ...item, ...partial, edited: true, origin: item.origin } : item))
  }

  function save() {
    const message = onSave(branches, rootTitle, { deletedIds, previous: prior })
    if (message) { setError(message); return message }
    setBaseline({ title: rootTitle, branches })
    setDirty(false)
    setEditing(false)
    setError('')
    return ''
  }

  function cancel() {
    setBranches(baseline.branches)
    setRootTitle(baseline.title)
    setUndo([])
    setDirty(false)
    setEditing(false)
    setError('')
  }

  if (bindRef) {
    bindRef.current = {
      isDirty: () => dirtyRef.current,
      save,
      discard: cancel,
    }
  }
  useEffect(() => () => { if (bindRef) bindRef.current = null }, [bindRef])

  const canvas = (
    <div
      className="htree-canvas"
      onWheel={(event) => { event.preventDefault(); setScale((value) => Math.min(1.8, Math.max(0.5, value + (event.deltaY < 0 ? 0.08 : -0.08)))) }}
      onPointerDown={(event) => { if ((event.target as HTMLElement).closest('.htree-card,button')) return; drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y } }}
      onPointerMove={(event) => { if (!drag.current) return; setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y }) }}
      onPointerUp={() => { drag.current = null }}
    >
      <div className="htree-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
        <TreeView node={tree} open={open} selected={selected} onToggle={toggle} onSelect={(id) => { setSelected(id); setDetailOpen(true) }} />
      </div>
    </div>
  )

  const body = (
    <div className={full ? 'htree-full' : 'htree-wrap'}>
      <div className="htree-bar">
        {!progress && branches.length === 0 && <button type="button" className="btn-primary" disabled={busy || !news.length} onClick={() => { expecting.current = true; onGenerate() }}>{busy ? '生成中' : '生成分析树'}</button>}
        {(progress || branches.length > 0) && <button type="button" className="btn-primary" onClick={() => setEditing((value) => !value)}>{editing ? '完成编辑' : '编辑树'}</button>}
        <button type="button" className="btn-primary" onClick={() => setFull(true)}>放大查看</button>
        <div className="htree-zoom" role="group" aria-label="缩放">
          <button type="button" onClick={() => { setScale((value) => Math.min(1.8, value + 0.1)) }}>放大</button>
          <button type="button" onClick={() => { setScale((value) => Math.max(0.5, value - 0.1)) }}>缩小</button>
          <button type="button" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }}>适应画布</button>
        </div>
        <button type="button" className="btn-text" onClick={() => { setSelected('root'); setPan({ x: 0, y: 0 }) }}>回到根节点</button>
        {(progress || branches.length > 0) && <button type="button" className="btn-quiet" onClick={() => { expecting.current = true; onGenerate() }}>更新进展分析</button>}
        {(progress || branches.some((item) => item.kind === 'pitch')) && <button type="button" className="btn-quiet" onClick={() => { expecting.current = true; onRetryPitches(branches.filter((item) => item.origin === 'editor').map((item) => item.summary).join('\n')) }}>重新推荐拟题</button>}
        {editing && (
          <>
            <button type="button" className="btn-quiet" disabled={!undo.length} onClick={() => { const prev = undo[undo.length - 1]; if (!prev) return; setUndo(undo.slice(0, -1)); setBranches(prev); setDirty(true) }}>撤销</button>
            <button type="button" className="btn-primary" onClick={save}>保存</button>
            <button type="button" className="btn-quiet" onClick={() => { if (dirty) setLeave(true); else cancel() }}>取消</button>
          </>
        )}
        {full && <button type="button" className="btn-quiet" onClick={() => { if (dirty) setLeave(true); else setFull(false) }}>关闭放大</button>}
      </div>
      {staleCount > 0 && <p className="hot-banner">新增 {staleCount} 篇报道，分析可能需要更新。不会自动改写已有节点。</p>}
      {pitchError && <p className="hot-banner">{pitchError} <button type="button" className="btn-text" onClick={() => { expecting.current = true; onRetryPitches('') }}>重试拟题</button></p>}
      {candidate && <p className="hot-banner">新结果只是候选，还没有替换当前内容。手工笔记和已改过的拟题会保留。<button type="button" className="btn-text" onClick={() => applyCandidate('progress')}>替换进展</button><button type="button" className="btn-text" onClick={() => applyCandidate('pitch')}>替换拟题</button><button type="button" className="btn-text" onClick={() => setCandidate(null)}>暂不替换</button></p>}
      {prior && <p className="hot-banner">可以恢复替换前的版本。<button type="button" className="btn-text" onClick={() => { if (!prior) return; setBranches(prior.branches); setRootTitle(prior.rootTitle); setDirty(true) }}>恢复上一版</button></p>}
      {error && <p className="hot-banner">{error}</p>}
      <div className="htree-layout">
        {canvas}
      </div>
      {detailOpen && selectedNode && (
        <aside className="htree-drawer" role="dialog" aria-label="节点详情">
          <div className="htree-drawer-bar">
            <strong>节点详情</strong>
            <button type="button" className="btn-text" onClick={() => setDetailOpen(false)}>关闭</button>
          </div>
          <Detail node={selectedNode} editing={editing} news={news} branches={branches} onPatch={patchBranch} onAdd={addBranch} onRemove={removeBranch} onOpenNews={onOpenNews} onTitle={(value) => { setRootTitle(value); setDirty(true) }} onAdopt={setAdoptFor} onReport={onReport} />
        </aside>
      )}
      {leave && (
        <div className="hot-dialog-mask">
          <section className="hot-dialog" role="dialog" aria-modal="true">
            <h2>分析树还有未保存的修改</h2>
            <div className="ops">
              <button type="button" className="btn-primary" onClick={() => { save(); setLeave(false); setFull(false) }}>保存</button>
              <button type="button" className="btn-quiet" onClick={() => { cancel(); setLeave(false); setFull(false) }}>放弃</button>
              <button type="button" className="btn-text" onClick={() => setLeave(false)}>继续编辑</button>
            </div>
          </section>
        </div>
      )}
      {adoptFor && (
        <div className="hot-dialog-mask">
          <section className="hot-dialog" role="dialog" aria-modal="true">
            <h2>采用为跟进拟题</h2>
            <p>只记录工作方向，不会标成已发布或已形成选题。</p>
            <div className="ops">
              <button type="button" className="btn-primary" onClick={() => { onAdopt(adoptFor, 'keep'); setAdoptFor(null) }}>只保存拟题</button>
              <button type="button" className="btn-quiet" onClick={() => { onAdopt(adoptFor, 'append'); setAdoptFor(null) }}>追加到计划</button>
              <button type="button" className="btn-quiet" onClick={() => { onAdopt(adoptFor, 'replace'); setAdoptFor(null) }}>替换下一步计划</button>
              <button type="button" className="btn-text" onClick={() => setAdoptFor(null)}>取消</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
  return body
}

function buildTree(title: string, branches: TreeBranch[], news: NewsItem[]): ViewNode {
  const byId = new Map(news.map((item) => [item.id, item]))
  const facts = branches.filter((item) => item.kind !== 'pitch' && !item.parentId).sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
  const pitches = branches.filter((item) => item.kind === 'pitch')
  const childOf = (id: string) => branches.filter((item) => item.parentId === id && item.kind !== 'pitch')
  const toNode = (item: TreeBranch): ViewNode => ({
    id: item.id,
    kind: item.edited && item.origin === 'ai' ? (item.kind === 'pitch' ? 'pitch' : item.kind) : item.kind,
    title: item.title,
    summary: item.summary,
    tag: item.edited && item.origin === 'ai' ? '已人工编辑' : TAG[item.kind],
    branch: item,
    children: [
      ...childOf(item.id).map(toNode),
      ...item.articleIds.map((articleId) => {
        const row = byId.get(articleId)
        return { id: `article:${item.id}:${articleId}`, kind: 'article' as const, title: row?.title ?? articleId, summary: row ? `${row.mediaName} · ${row.publishedAt.slice(0, 16).replace('T', ' ')}` : '报道不在当前范围', tag: '报道', news: row, children: [] }
      }),
    ],
  })
  const progressNodes = facts.length ? facts.map(toNode) : [{ id: 'pending-progress', kind: 'pending' as const, title: '报道进展：待生成', summary: `${news.length} 篇材料尚未生成分析`, tag: '待生成', children: [] }]
  const pitchNodes = pitches.length ? pitches.map(toNode) : [{ id: 'pending-pitch', kind: 'pending' as const, title: '推荐拟题：待生成', summary: '生成分析树后出现候选选题', tag: '待生成', children: [] }]
  return {
    id: 'root',
    kind: 'root',
    title,
    summary: `${news.length} 篇报道 · ${new Set(news.map((item) => item.mediaId)).size} 家媒体`,
    tag: '事件',
    children: [
      ...progressNodes,
      { id: 'pitch-root', kind: 'pitch-group', title: '推荐拟题', summary: pitches.length ? `${pitches.length} 个候选` : '待生成', tag: '推荐拟题', children: pitchNodes },
    ],
  }
}

function findNode(node: ViewNode, id: string): ViewNode | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

function TreeView({ node, open, selected, onToggle, onSelect }: { node: ViewNode; open: Set<string>; selected: string; onToggle: (id: string) => void; onSelect: (id: string) => void }) {
  const expanded = open.has(node.id) || node.kind === 'root'
  return (
    <div className="htree-branch">
      <button type="button" className={`htree-card is-${node.kind}${selected === node.id ? ' is-selected' : ''}`} onClick={() => onSelect(node.id)}>
        <span>{node.tag}</span>
        <strong>{node.title}</strong>
        <small>{node.summary}</small>
      </button>
      {node.children.length > 0 && (
        <>
          <button type="button" className="btn-text" onClick={() => onToggle(node.id)}>{expanded ? '收起' : '展开'}</button>
          {expanded && (
            <div className="htree-kids">
              {node.children.map((child) => <TreeView key={child.id} node={child} open={open} selected={selected} onToggle={onToggle} onSelect={onSelect} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Detail({
  node, editing, news, branches, onPatch, onAdd, onRemove, onOpenNews, onTitle, onAdopt, onReport,
}: {
  node: ViewNode
  editing: boolean
  news: NewsItem[]
  branches: TreeBranch[]
  onPatch: (id: string, partial: Partial<TreeBranch>) => void
  onAdd: (parentId: string | null, kind: TreeBranch['kind']) => void
  onRemove: (id: string) => void
  onOpenNews: (item: NewsItem) => void
  onTitle: (value: string) => void
  onAdopt: (branch: TreeBranch) => void
  onReport: (branch: TreeBranch) => void
}) {
  const branch = node.branch
  return (
    <div>
      <p className="hot-faint">{node.tag}</p>
      {node.kind === 'root' && editing ? <input aria-label="展示标题" value={node.title} onChange={(event) => onTitle(event.target.value)} /> : <h3>{node.title}</h3>}
      <p>{node.summary}</p>
      {branch?.kind === 'pitch' && (
        <>
          <p><b>选题角度</b> {branch.angle || '未填写'}</p>
          <p><b>要回答的问题</b> {branch.question || '未填写'}</p>
          <p><b>推荐理由</b> {branch.reason || branch.summary}</p>
          <p><b>材料已经支持</b> {branch.articleIds.length ? `${branch.articleIds.length} 篇引用` : '还没有报道引用'}</p>
          <p><b>尚需核实</b> {branch.gaps.join('；') || '未列出'}</p>
          <p><b>建议提纲</b></p>
          <ol>{branch.outline.map((item) => <li key={item}>{item}</li>)}</ol>
          <p className="hot-faint">以上是选题建议，不是已经发生的新闻。</p>
          <div className="ops">
            <button type="button" className="btn-primary" onClick={() => onAdopt(branch)}>采用为跟进拟题</button>
            <button type="button" className="btn-quiet" onClick={() => onReport(branch)}>整理成报告草稿</button>
          </div>
        </>
      )}
      {node.news && <button type="button" className="btn-text" onClick={() => onOpenNews(node.news!)}>查看全文</button>}
      {branch && branch.evidence.map((item) => <p key={item.quote} className="hot-quote">{item.quote}</p>)}
      {editing && branch && (
        <>
          <label>标题<input aria-label="节点标题" value={branch.title} onChange={(event) => onPatch(branch.id, { title: event.target.value })} /></label>
          <label>内容<textarea aria-label="节点内容" value={branch.summary} onChange={(event) => onPatch(branch.id, { summary: event.target.value })} /></label>
          {branch.kind === 'pitch' && (
            <>
              <label>角度<input aria-label="选题角度" value={branch.angle} onChange={(event) => onPatch(branch.id, { angle: event.target.value })} /></label>
              <label>问题<input aria-label="核心问题" value={branch.question} onChange={(event) => onPatch(branch.id, { question: event.target.value })} /></label>
              <label>提纲<textarea aria-label="报道提纲" value={branch.outline.join('\n')} onChange={(event) => onPatch(branch.id, { outline: event.target.value.split('\n').filter(Boolean) })} /></label>
            </>
          )}
          <label>关联报道
            <select aria-label="关联报道" value="" onChange={(event) => { if (!event.target.value) return; onPatch(branch.id, { articleIds: branch.articleIds.includes(event.target.value) ? branch.articleIds : [...branch.articleIds, event.target.value] }) }}>
              <option value="">从当前事件报道中选择</option>
              {news.map((item) => <option key={item.id} value={item.id}>{item.mediaName} {item.title}</option>)}
            </select>
          </label>
          {branch.articleIds.map((id) => {
            const row = news.find((item) => item.id === id)
            return <button key={id} type="button" className="btn-text" onClick={() => onPatch(branch.id, { articleIds: branch.articleIds.filter((item) => item !== id) })}>移除 {row?.title ?? id}</button>
          })}
          <div className="ops">
            <button type="button" className="btn-quiet" onClick={() => onAdd(branch.parentId, branch.kind === 'pitch' ? 'pitch' : 'note')}>新增同级</button>
            {branch.kind !== 'pitch' && <button type="button" className="btn-quiet" onClick={() => onAdd(branch.id, 'note')}>新增子节点</button>}
            <button type="button" className="btn-quiet" onClick={() => onRemove(branch.id)}>删除节点</button>
          </div>
        </>
      )}
      {editing && node.kind === 'pitch-group' && <button type="button" className="btn-quiet" onClick={() => onAdd('pitch-root', 'pitch')}>新增候选拟题</button>}
      {editing && node.kind === 'root' && <button type="button" className="btn-quiet" onClick={() => onAdd(null, 'note')}>新增分析节点</button>}
      <p className="hot-faint">当前草稿节点 {branches.length} 个。删除节点不会删除原始新闻。</p>
    </div>
  )
}
