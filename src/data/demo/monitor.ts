import { NEWS } from './news.ts'
import { SUPPLEMENT_NEWS } from './competitorSupplement.ts'
import type { NewsItem } from '../../types/domain.ts'

export const MONITOR_NEWS: NewsItem[] = [...NEWS, ...SUPPLEMENT_NEWS]
