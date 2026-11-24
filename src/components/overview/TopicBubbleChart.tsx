import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_COLORS } from '../../data/demo/index.ts'
import { formatStamp } from '../../lib/dates.ts'
import type { TopicBubble } from '../../lib/overviewSelectors.ts'

interface Placement {
  id: string
  x: number
  y: number
  size: number
}

function diameter(count: number, max: number): number {
  const ratio = Math.sqrt(count / Math.max(max, 1))
  return Math.max(74, Math.round(136 * ratio))
}

function hashUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 1000) / 1000
}

function pack(items: { id: string; size: number }[]): Placement[] {
  const ordered = [...items].sort((left, right) => right.size - left.size || left.id.localeCompare(right.id))
  const placed: Placement[] = []
  for (const item of ordered) {
    const radius = item.size / 2
    if (placed.length === 0) {
      placed.push({ id: item.id, x: 0, y: 0, size: item.size })
      continue
    }
    const turn = hashUnit(item.id) * Math.PI * 2
    let chosen = { x: 0, y: 0 }
    let found = false
    for (let distance = 0; distance <= 2400 && !found; distance += 6) {
      const steps = Math.max(12, Math.ceil((Math.PI * 2 * Math.max(distance, 1)) / 10))
      for (let step = 0; step < steps; step += 1) {
        const angle = turn + (step / steps) * Math.PI * 2
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance * 0.8
        const clear = placed.every((other) => {
          const dx = other.x - x
          const dy = other.y - y
          const need = other.size / 2 + radius + 8
          return dx * dx + dy * dy >= need * need
        })
        if (clear) {
          chosen = { x, y }
          found = true
          break
        }
      }
    }
    placed.push({ id: item.id, x: chosen.x, y: chosen.y, size: item.size })
  }
  return placed
}

function fit(placed: Placement[], width: number, height: number): Placement[] {
  if (placed.length === 0 || width < 8 || height < 8) return []
  const minX = Math.min(...placed.map((item) => item.x - item.size / 2))
  const maxX = Math.max(...placed.map((item) => item.x + item.size / 2))
  const minY = Math.min(...placed.map((item) => item.y - item.size / 2))
  const maxY = Math.max(...placed.map((item) => item.y + item.size / 2))
  const boundsW = maxX - minX
  const boundsH = maxY - minY
  const scale = Math.min((width - 8) / boundsW, (height - 8) / boundsH)
  const offsetX = (width - boundsW * scale) / 2 - minX * scale
  const offsetY = (height - boundsH * scale) / 2 - minY * scale
  return placed.map((item) => ({
    id: item.id,
    x: offsetX + (item.x - item.size / 2) * scale,
    y: offsetY + (item.y - item.size / 2) * scale,
    size: item.size * scale,
  }))
}

export function TopicBubbleChart({
  items,
  totalTopics,
  onSelect,
}: {
  items: TopicBubble[]
  totalTopics: number
  onSelect: (topicId: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setBox((current) => (current.width === width && current.height === height ? current : { width, height }))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(() => {
    const max = Math.max(...items.map((item) => item.count), 1)
    const packed = pack(items.map((item) => ({ id: item.topicId, size: diameter(item.count, max) })))
    return fit(packed, box.width, box.height)
  }, [items, box.width, box.height])

  const byId = new Map(items.map((item) => [item.topicId, item]))
  const legend = [...new Map(items.map((item) => [item.categoryId, item])).values()]

  return (
    <div className="chart-stack">
      <div className="chart-box topic-stage" ref={hostRef} style={{ height: 360 }}>
        {layout.map((item) => {
          const topic = byId.get(item.id)
          if (!topic) return null
          const font = item.size >= 112 ? 15 : item.size >= 88 ? 13 : 12
          return (
            <button
              key={topic.topicId}
              type="button"
              className="topic-bubble"
              data-category={topic.categoryId}
              style={{ left: item.x, top: item.y, width: item.size, height: item.size, fontSize: font }}
              title={`${topic.name}，${topic.count} 条，${formatStamp(topic.latestAt)}`}
              onClick={() => onSelect(topic.topicId)}
            >
              <span className="topic-bubble-name">{topic.name}</span>
              <span className="topic-bubble-count">{topic.count}</span>
            </button>
          )
        })}
      </div>
      <p className="chart-note">
        当前范围内有话题 {totalTopics} 个，按新闻数展示前 {items.length} 个，上限 12 个。面积对应新闻数，颜色对应分类，位置只用于排布。
      </p>
      <ul className="legend">
        {legend.map((item) => (
          <li key={item.categoryId}>
            <i style={{ background: CATEGORY_COLORS[item.categoryId] }} />
            {item.categoryName}
          </li>
        ))}
      </ul>
    </div>
  )
}
