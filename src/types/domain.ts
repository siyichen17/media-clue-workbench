export type CategoryId =
  | 'low-air'
  | 'traffic'
  | 'culture'
  | 'public'
  | 'tech'
  | 'eco'

export type HotPlatform = '微博' | '百度'

export type DatePreset = '7d' | '14d' | 'custom'

export interface Category {
  id: CategoryId
  name: string
}

export interface Topic {
  id: string
  name: string
  categoryId: CategoryId
}

export interface MediaOutlet {
  id: string
  name: string
  columns: string[]
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  body: string
  publishedAt: string
  topicId: string
  eventId: string
  eventName: string
  categoryId: CategoryId
  mediaId: string
  mediaName: string
  columnName: string
  platform: string
  /** 未标注时视为模拟演示数据。真实材料才会标成 real。 */
  nature?: 'real' | 'simulated'
  /** 一篇报道可关联多个主题。缺省时只使用 topicId。统计按报道 ID 去重。 */
  topicIds?: string[]
  /** 首次入库时间。缺省时等于发布时间。关注新增用它，不用发布时间。 */
  ingestedAt?: string
}

export interface HotSnapshot {
  id: string
  platform: HotPlatform
  itemId: string
  title: string
  topicId: string | null
  /** 生成数据时写入的确认关系。人工关联优先，存在时覆盖这里。 */
  eventId?: string | null
  rank: number
  heat: number
  observedAt: string
}

export interface OverviewFilters {
  preset: DatePreset
  customStart: string
  customEnd: string
  selectedDay: string | null
  platform: string
  keyword: string
}

export type AlertKind = 'rank_rise' | 'first_entry' | 'new_coverage'

export interface AlertSnapshot {
  platform: HotPlatform
  itemId: string
  title: string
  rank: number
  heat: number
  observedAt: string
  previousRank?: number
}

export interface OverviewAlert {
  id: string
  kind: AlertKind
  topicId: string | null
  topicName: string
  triggerAt: string
  summary: string
  magnitude: number
  magnitudeLabel: string
  newsIds: string[]
  snapshot: AlertSnapshot | null
}

export interface DrawerTag {
  id: string
  label: string
}

export type DrawerModel =
  | {
      kind: 'news'
      tags: DrawerTag[]
      items: NewsItem[]
      note?: string
    }
  | {
      kind: 'snapshot'
      tags: DrawerTag[]
      summary: string
      snapshot: AlertSnapshot
    }
