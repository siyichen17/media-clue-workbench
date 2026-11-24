import { useState } from 'react'
import type { AlertRule, MediaProfile, MediaState } from '../../lib/competeStorage.ts'

function splitKeywords(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function MediaManager({
  state,
  onClose,
  onSave,
}: {
  state: MediaState
  onClose: () => void
  onSave: (state: MediaState) => void
}) {
  const [draft, setDraft] = useState<MediaState>(state)
  const [name, setName] = useState('')

  function update(id: string, patch: Partial<MediaProfile>) {
    setDraft((current) => ({
      ...current,
      profiles: current.profiles.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ownMediaId: patch.enabled === false && current.ownMediaId === id ? 'cover' : current.ownMediaId,
    }))
  }

  return (
    <div className="modal-root">
      <button type="button" className="drawer-mask" aria-label="关闭媒体管理" onClick={onClose} />
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="media-manager-title">
        <header className="drawer-head">
          <div>
            <h2 id="media-manager-title">管理媒体</h2>
            <p className="chart-note">停用后不再进入默认对照，已有新闻仍保留。没有报道的媒体会显示暂无数据。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="drawer-scroll">
          <label className="field">
            本媒体
            <select
              value={draft.ownMediaId}
              onChange={(event) => setDraft((current) => ({ ...current, ownMediaId: event.target.value }))}
            >
              {draft.profiles.filter((item) => item.enabled).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {draft.profiles.map((item) => (
            <article key={item.id} className="editor-block">
              <div className="title-row">
                <strong>{item.builtin ? item.name : '自建媒体'}</strong>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) => update(item.id, { enabled: event.target.checked })}
                  />
                  启用
                </label>
                {!item.builtin && (
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        profiles: current.profiles.filter((profile) => profile.id !== item.id),
                      }))
                    }
                  >
                    删除
                  </button>
                )}
              </div>
              <label className="field">
                名称
                <input value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} />
              </label>
              <label className="field">
                官网
                <input value={item.site} placeholder="https://" onChange={(event) => update(item.id, { site: event.target.value })} />
              </label>
              <label className="field">
                关注关键词
                <input
                  value={item.keywords.join('，')}
                  onChange={(event) => update(item.id, { keywords: splitKeywords(event.target.value) })}
                />
              </label>
              <label className="field">
                备注
                <input value={item.note} onChange={(event) => update(item.id, { note: event.target.value })} />
              </label>
            </article>
          ))}
          <div className="title-row">
            <input aria-label="新媒体名称" value={name} placeholder="新媒体名称" onChange={(event) => setName(event.target.value)} />
            <button
              type="button"
              className="btn"
              disabled={!name.trim()}
              onClick={() => {
                const id = `custom-${Date.now().toString(36)}`
                setDraft((current) => ({
                  ...current,
                  profiles: [
                    ...current.profiles,
                    { id, name: name.trim(), site: '', keywords: [], note: '', enabled: true, builtin: false },
                  ],
                }))
                setName('')
              }}
            >
              新增媒体
            </button>
          </div>
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn active" onClick={() => onSave(draft)}>
            保存
          </button>
        </footer>
      </section>
    </div>
  )
}

export function AlertRuleDialog({
  mediaName,
  mediaId,
  rules,
  onClose,
  onSave,
}: {
  mediaName: string
  mediaId: string
  rules: AlertRule[]
  onClose: () => void
  onSave: (rules: AlertRule[]) => void
}) {
  const [draft, setDraft] = useState<AlertRule[]>(() => {
    const kinds = ['daily_count', 'keyword', 'hot_event'] as const
    return kinds.map((kind) => {
      return (
        rules.find((rule) => rule.mediaId === mediaId && rule.kind === kind) ?? {
          id: `${mediaId}:${kind}`,
          mediaId,
          kind,
          enabled: false,
          threshold: 5,
          keywords: [],
        }
      )
    })
  })

  function patch(kind: AlertRule['kind'], next: Partial<AlertRule>) {
    setDraft((current) => current.map((rule) => (rule.kind === kind ? { ...rule, ...next } : rule)))
  }

  return (
    <div className="modal-root">
      <button type="button" className="drawer-mask" aria-label="关闭预警设置" onClick={onClose} />
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="alert-rule-title">
        <header className="drawer-head">
          <div>
            <h2 id="alert-rule-title">设置预警 · {mediaName}</h2>
            <p className="chart-note">规则只根据已收录报道和热榜快照计算，不调用模型。模拟数据触发的记录会标明模拟。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="drawer-scroll">
          {draft.map((rule) => (
            <article key={rule.kind} className="editor-block">
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => patch(rule.kind, { enabled: event.target.checked })}
                />
                {rule.kind === 'daily_count' && '单日已收录报道数达到阈值'}
                {rule.kind === 'keyword' && '新增报道命中关键词'}
                {rule.kind === 'hot_event' && '报道所属话题出现在热榜'}
              </label>
              {rule.kind === 'daily_count' && (
                <label className="field">
                  阈值
                  <input
                    type="number"
                    min={1}
                    value={rule.threshold}
                    onChange={(event) => patch(rule.kind, { threshold: Number(event.target.value) || 1 })}
                  />
                </label>
              )}
              {rule.kind === 'keyword' && (
                <label className="field">
                  关键词，用逗号分隔
                  <input
                    value={rule.keywords.join('，')}
                    onChange={(event) => patch(rule.kind, { keywords: splitKeywords(event.target.value) })}
                  />
                </label>
              )}
            </article>
          ))}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn active" onClick={() => onSave(draft)}>
            保存规则
          </button>
        </footer>
      </section>
    </div>
  )
}
