import { NEWS } from '../data/demo/news.ts'
import { HOT_SNAPSHOTS } from '../data/demo/hotSnapshots.ts'
import { topicById } from '../data/demo/catalog.ts'
import type { AlertRecord, AlertRule, DataSource } from './adminStore.ts'
import { kindLabel, loadAlertRecords, mediaName, saveAlertRecords } from './adminStore.ts'

function fresh(partial: Omit<AlertRecord, 'status' | 'read' | 'note'>): AlertRecord {
  return { ...partial, status: 'open', read: false, note: '' }
}

export function evaluateRules(rules: AlertRule[], sources: DataSource[], existing = loadAlertRecords()): AlertRecord[] {
  const kept = new Map(existing.map((item) => [item.id, item]))
  const next: AlertRecord[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    next.push(...matches(rule, sources))
  }
  const merged = next.map((item) => {
    const prior = kept.get(item.id)
    if (!prior) return item
    return { ...item, status: prior.status, read: prior.read, note: prior.note }
  })
  const orphans = existing.filter((item) => !merged.some((row) => row.id === item.id))
  const all = [...merged, ...orphans].sort((a, b) => b.triggerAt.localeCompare(a.triggerAt))
  saveAlertRecords(all)
  return all
}

function matches(rule: AlertRule, sources: DataSource[]): AlertRecord[] {
  if (rule.kind === 'topic_news') return topicNews(rule)
  if (rule.kind === 'peer_news') return peerNews(rule)
  if (rule.kind === 'hot_rank') return hotRank(rule)
  return sourceFail(rule, sources)
}

function arrivedAt(item: { ingestedAt?: string; publishedAt: string }) {
  return item.ingestedAt || item.publishedAt
}

function topicNews(rule: AlertRule): AlertRecord[] {
  return NEWS.filter((item) => arrivedAt(item) > rule.baselineAt)
    .filter((item) => (rule.topicId ? item.topicId === rule.topicId : true))
    .filter((item) => (rule.eventId ? item.eventId === rule.eventId : true))
    .filter(() => Boolean(rule.topicId || rule.eventId))
    .map((item) =>
      fresh({
        id: `${rule.id}:${item.id}`,
        ruleId: rule.id,
        title: `${kindLabel(rule.kind)}：${item.title}`,
        kind: rule.kind,
        objectLabel: item.eventName,
        triggerAt: arrivedAt(item),
        severity: '一般',
        why: '入库时间晚于规则水位。晚收录的旧稿也算这次新增，不单看发布时间。',
        numbers: `水位 ${rule.baselineAt.slice(0, 16).replace('T', ' ')}，入库 ${arrivedAt(item).slice(0, 16).replace('T', ' ')}，发布 ${item.publishedAt.slice(0, 16).replace('T', ' ')}`,
        href: `/compete?media=${item.mediaId}`,
      }),
    )
}

function peerNews(rule: AlertRule): AlertRecord[] {
  if (!rule.mediaId) return []
  return NEWS.filter((item) => item.mediaId === rule.mediaId && arrivedAt(item) > rule.baselineAt).map((item) =>
    fresh({
      id: `${rule.id}:${item.id}`,
      ruleId: rule.id,
      title: `${mediaName(rule.mediaId)}新增报道：${item.title}`,
      kind: rule.kind,
      objectLabel: mediaName(rule.mediaId),
      triggerAt: arrivedAt(item),
      severity: '一般',
      why: '指定媒体在水位之后入库了新报道。',
      numbers: `水位 ${rule.baselineAt.slice(0, 16).replace('T', ' ')}`,
      href: `/compete?media=${rule.mediaId}`,
    }),
  )
}

function hotRank(rule: AlertRule): AlertRecord[] {
  const rows: AlertRecord[] = []
  const grouped = new Map<string, typeof HOT_SNAPSHOTS>()
  for (const snap of HOT_SNAPSHOTS) {
    const key = `${snap.platform}:${snap.itemId}`
    grouped.set(key, [...(grouped.get(key) ?? []), snap])
  }
  for (const [key, snaps] of grouped) {
    const ordered = [...snaps].sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    for (let index = 0; index < ordered.length; index += 1) {
      const current = ordered[index]
      if (current.observedAt <= rule.baselineAt) continue
      const previous = index > 0 ? ordered[index - 1] : null
      const entered = rule.rankEnter != null && current.rank <= rule.rankEnter
      const rose = previous != null && rule.rankRise != null && previous.rank - current.rank >= rule.rankRise
      if (!entered && !rose) continue
      if (!previous && rule.rankRise != null && !entered) continue
      const topic = (current.topicId ? topicById[current.topicId]?.name : null) ?? current.title
      rows.push(
        fresh({
          id: `${rule.id}:${key}:${current.observedAt}`,
          ruleId: rule.id,
          title: `${current.platform}「${current.title}」排名第 ${current.rank} 位`,
          kind: rule.kind,
          objectLabel: topic,
          triggerAt: current.observedAt,
          severity: current.rank <= 3 ? '重要' : '一般',
          why: rose
            ? `相邻快照名次上升 ${previous!.rank - current.rank} 位，达到设定的 ${rule.rankRise} 位。`
            : `进入设定榜位前 ${rule.rankEnter} 名。没有相邻快照时不判断上升。`,
          numbers: previous ? `由第 ${previous.rank} 位到第 ${current.rank} 位` : `当前第 ${current.rank} 位，无更早快照`,
          href: '/hot',
        }),
      )
    }
  }
  return rows
}

function sourceFail(rule: AlertRule, sources: DataSource[]): AlertRecord[] {
  const targets = sources.filter((item) => (rule.sourceId ? item.id === rule.sourceId : true))
  const rows: AlertRecord[] = []
  for (const source of targets) {
    for (const task of source.tasks) {
      if (task.demo) continue
      if (!task.result.includes('失败')) continue
      if (task.at <= rule.baselineAt) continue
      rows.push(
        fresh({
          id: `${rule.id}:${task.id}`,
          ruleId: rule.id,
          title: `${source.name}任务失败`,
          kind: rule.kind,
          objectLabel: source.name,
          triggerAt: task.at,
          severity: '重要',
          why: '已接入来源的任务结果为失败。演示检查不生成这类告警。',
          numbers: task.result,
          href: '/source',
        }),
      )
    }
  }
  return rows
}
