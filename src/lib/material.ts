import type { MaterialLevel } from '../../shared/aiTypes.ts'
import type { NewsItem } from '../types/domain.ts'

export function materialNature(item: Pick<NewsItem, 'nature'>): 'real' | 'simulated' {
  return item.nature === 'real' ? 'real' : 'simulated'
}

export function materialLevel(item: Pick<NewsItem, 'title' | 'summary' | 'body'>): MaterialLevel {
  if (item.body.trim().length >= 40) return 'full'
  if (item.summary.trim().length >= 8) return 'summary'
  return 'title'
}

export function levelLabel(level: MaterialLevel): string {
  if (level === 'full') return '全文'
  if (level === 'summary') return '摘要'
  return '仅标题'
}

export function natureLabel(nature: 'real' | 'simulated'): string {
  return nature === 'real' ? '真实' : '模拟'
}
