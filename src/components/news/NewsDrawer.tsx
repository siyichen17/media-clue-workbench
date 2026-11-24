import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryById, topicById } from '../../data/demo/index.ts'
import { formatStamp } from '../../lib/dates.ts'
import { followEvent, restoreLead, type LeadEntry } from '../../lib/leads.ts'
import type { DrawerModel, NewsItem } from '../../types/domain.ts'

function heatName(platform: string): string {
  return platform === '微博' ? '微博热度' : '百度热度'
}

export function NewsDrawer({
  model,
  followedIds,
  onClose,
  onToggleFollow,
  entry = 'overview',
}: {
  model: DrawerModel | null
  followedIds: Set<string>
  onClose: () => void
  onToggleFollow: (newsId: string) => void
  entry?: LeadEntry
}) {
  const navigate = useNavigate()
  const [followMsg, setFollowMsg] = useState<{ id: string; archived: boolean; text: string } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [sort, setSort] = useState<'latest' | 'earliest'>('latest')
  const [titleQuery, setTitleQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const open = model !== null
  const signature = model?.kind === 'news' ? model.items.map((item) => item.id).join('|') : model?.snapshot.observedAt ?? ''

  useEffect(() => {
    setSort('latest')
    setTitleQuery('')
    setDetailId(null)
  }, [signature, model?.kind])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const scrollY = window.scrollY
    const { position, top, left, right, width } = document.body.style
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.position = position
      document.body.style.top = top
      document.body.style.left = left
      document.body.style.right = right
      document.body.style.width = width
      window.scrollTo(0, scrollY)
      opener?.focus()
    }
  }, [open])

  const shown = useMemo(() => {
    if (model?.kind !== 'news') return []
    const keyword = titleQuery.trim()
    const filtered = keyword ? model.items.filter((item) => item.title.includes(keyword)) : model.items
    return [...filtered].sort((a, b) =>
      sort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt),
    )
  }, [model, sort, titleQuery])

  const detail = model?.kind === 'news' ? model.items.find((item) => item.id === detailId) ?? null : null
  if (!model) return null

  return (
    <div className="drawer-root" data-testid="news-drawer">
      <button type="button" className="drawer-mask" aria-label="关闭新闻抽屉" onClick={onClose} />
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-head">
          <div>
            <h2 id="drawer-title">{model.kind === 'news' ? '相关新闻' : '热榜记录'}</h2>
            <div className="tag-row">
              {model.tags.map((tag) => (
                <span key={tag.id} className="static-tag">
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        {model.kind === 'snapshot' ? (
          <div className="drawer-scroll">
            <p className="sim-banner">模拟热榜快照，不是平台当时的真实榜单。</p>
            <p>{model.summary}</p>
            <dl className="meta-list">
              <div>
                <dt>平台</dt>
                <dd>{model.snapshot.platform}</dd>
              </div>
              <div>
                <dt>条目</dt>
                <dd>{model.snapshot.title}</dd>
              </div>
              <div>
                <dt>观测时间</dt>
                <dd>{formatStamp(model.snapshot.observedAt)}</dd>
              </div>
              <div>
                <dt>排名</dt>
                <dd>第 {model.snapshot.rank} 位</dd>
              </div>
              {model.snapshot.previousRank !== undefined && (
                <div>
                  <dt>上一快照排名</dt>
                  <dd>第 {model.snapshot.previousRank} 位</dd>
                </div>
              )}
              <div>
                <dt>{heatName(model.snapshot.platform)}</dt>
                <dd>{model.snapshot.heat.toLocaleString('zh-CN')}</dd>
              </div>
            </dl>
            <p className="chart-note">热度为该平台自身口径，不与另一平台的数值比较。</p>
            <div className="empty-state">当前未关联新闻</div>
          </div>
        ) : detail ? (
          <NewsDetail item={detail} followed={followedIds.has(detail.id)} onBack={() => setDetailId(null)} onToggleFollow={onToggleFollow} />
        ) : (
          <div className="drawer-scroll">
            {model.note && <p className="chart-note">{model.note}</p>}
            <div className="drawer-tools">
              <strong data-testid="drawer-count">
                匹配 {model.items.length} 条
                {titleQuery.trim() ? `，显示 ${shown.length} 条` : ''}
              </strong>
              <div className="segmented" role="group" aria-label="新闻排序">
                <button type="button" aria-pressed={sort === 'latest'} onClick={() => setSort('latest')}>
                  最新优先
                </button>
                <button type="button" aria-pressed={sort === 'earliest'} onClick={() => setSort('earliest')}>
                  最早优先
                </button>
              </div>
              <input
                type="search"
                aria-label="搜索标题"
                placeholder="搜索标题"
                value={titleQuery}
                onChange={(event) => setTitleQuery(event.target.value)}
              />
            </div>
            {shown.length === 0 ? (
              <div className="empty-state">没有符合条件的新闻</div>
            ) : (
              <ul className="news-list">
                {shown.map((item) => (
                  <li key={item.id}>
                    <article className="news-card">
                      <h3>{item.title}</h3>
                      <p className="news-meta">
                        <span>{item.mediaName}</span>
                        <span>{item.platform}</span>
                        <span>{formatStamp(item.publishedAt)}</span>
                      </p>
                      <p className="news-topic">话题：{topicById[item.topicId].name}</p>
                      <p>{item.summary}</p>
                      <p className="sim-flag">模拟数据</p>
                      <div className="news-actions">
                        <button type="button" className="btn" onClick={() => setDetailId(item.id)}>
                          查看全文
                        </button>
                        <button
                          type="button"
                          className={followedIds.has(item.id) ? 'btn active' : 'btn ghost'}
                          aria-pressed={followedIds.has(item.id)}
                          onClick={() => onToggleFollow(item.id)}
                        >
                          {followedIds.has(item.id) ? '已关注' : '关注'}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            const result = followEvent({
                              eventId: item.eventId,
                              eventName: item.eventName,
                              articleIds: [item.id],
                              entry,
                            })
                            setFollowMsg({
                              id: result.lead.id,
                              archived: result.kind === 'archived',
                              text: result.kind === 'archived' ? '这条线索已结束，没有自动恢复。' : result.kind === 'created' ? '已加入跟进。' : '已合并到原线索，备注保持不变。',
                            })
                          }}
                        >
                          跟进事件
                        </button>
                        {followMsg && (
                          <>
                            <p className="sim-flag">{followMsg.text}</p>
                            <button type="button" className="btn" onClick={() => navigate(`/leads?lead=${followMsg.id}`)}>查看线索</button>
                            {followMsg.archived && <button type="button" className="btn ghost" onClick={() => { restoreLead(followMsg.id); setFollowMsg({ ...followMsg, archived: false, text: '已恢复为待处理。' }) }}>恢复跟进</button>}
                          </>
                        )}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function NewsDetail({
  item,
  followed,
  onBack,
  onToggleFollow,
}: {
  item: NewsItem
  followed: boolean
  onBack: () => void
  onToggleFollow: (newsId: string) => void
}) {
  return (
    <div className="drawer-scroll">
      <button type="button" className="btn ghost" onClick={onBack}>
        返回列表
      </button>
      <h3 className="detail-title">{item.title}</h3>
      <p className="sim-banner">模拟报道，非该媒体实际发布</p>
      <dl className="meta-list">
        <div>
          <dt>媒体</dt>
          <dd>{item.mediaName}</dd>
        </div>
        <div>
          <dt>栏目</dt>
          <dd>{item.columnName}</dd>
        </div>
        <div>
          <dt>发布平台</dt>
          <dd>{item.platform}</dd>
        </div>
        <div>
          <dt>发布时间</dt>
          <dd>{formatStamp(item.publishedAt)}</dd>
        </div>
        <div>
          <dt>话题</dt>
          <dd>{topicById[item.topicId].name}</dd>
        </div>
        <div>
          <dt>事件</dt>
          <dd>{item.eventName}</dd>
        </div>
        <div>
          <dt>分类</dt>
          <dd>{categoryById[item.categoryId].name}</dd>
        </div>
      </dl>
      {item.body.split('\n\n').map((paragraph, index) => (
        <p key={index} className="detail-paragraph">
          {paragraph}
        </p>
      ))}
      <p className="sim-footnote">此正文为演示生成的模拟稿，不能视为上述媒体的真实发表内容，也不提供媒体官网链接。</p>
      <button
        type="button"
        className={followed ? 'btn active' : 'btn ghost'}
        aria-pressed={followed}
        onClick={() => onToggleFollow(item.id)}
      >
        {followed ? '已关注' : '关注'}
      </button>
    </div>
  )
}
