import { addDays, DATA_START } from '../../lib/dates.ts'
import type { HotPlatform, HotSnapshot } from '../../types/domain.ts'

interface HotSeries {
  platform: HotPlatform
  itemId: string
  title: string
  topicId: string | null
  /** 已确认的事件。缺省表示只有主题或尚未关联，不在这里猜测。 */
  eventId?: string | null
  /** dayIndex, hour, minute, rank, heat */
  points: [number, number, number, number, number][]
}

const SERIES: HotSeries[] = [
  {
    platform: '微博',
    itemId: 'wb-lowair',
    title: '低空经济试点航线',
    topicId: 't01',
    eventId: 'e01',
    points: [
      [6, 9, 30, 16, 386000],
      [8, 9, 30, 9, 742000],
      [10, 9, 30, 5, 968000],
      [13, 9, 30, 3, 1124000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-metro',
    title: '地铁末班延时',
    topicId: 't03',
    eventId: 'e06',
    points: [
      [0, 9, 30, 9, 654000],
      [1, 20, 10, 4, 889000],
      [3, 9, 30, 7, 702000],
      [5, 9, 30, 15, 241000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-coupon',
    title: '文旅消费券发放',
    topicId: 't05',
    points: [
      [2, 9, 30, 8, 510000],
      [4, 21, 0, 3, 1204000],
      [6, 9, 30, 3, 986000],
      [9, 9, 30, 2, 1310000],
      [12, 9, 30, 2, 1102000],
      [13, 17, 20, 4, 640000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-museum',
    title: '博物馆夜场',
    topicId: 't06',
    points: [
      [4, 18, 40, 18, 166000],
      [5, 21, 10, 9, 548000],
      [7, 9, 30, 14, 273000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-ai',
    title: '人工智能产业园',
    topicId: 't09',
    points: [
      [11, 10, 0, 15, 198000],
      [12, 18, 20, 8, 466000],
      [13, 11, 15, 6, 521000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-wetland',
    title: '湿地候鸟调查',
    topicId: 't11',
    points: [
      [8, 8, 50, 12, 233000],
      [9, 20, 0, 7, 401000],
      [11, 9, 30, 16, 142000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-drone',
    title: '无人机送检',
    topicId: 't02',
    eventId: 'e04',
    points: [
      [9, 9, 10, 20, 98000],
      [11, 15, 40, 13, 276000],
      [13, 16, 5, 11, 318000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-night-run',
    title: '城市夜跑路线推荐',
    topicId: null,
    points: [
      [3, 19, 20, 21, 87000],
      [4, 21, 5, 14, 255000],
      [6, 9, 30, 19, 121000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-bus',
    title: '公交专用道调优',
    topicId: 't04',
    points: [
      [1, 8, 20, 10, 344000],
      [5, 8, 20, 10, 301000],
      [8, 18, 0, 8, 418000],
      [13, 8, 40, 9, 289000],
    ],
  },
  {
    platform: '微博',
    itemId: 'wb-park',
    title: '口袋公园开放',
    topicId: 't12',
    points: [
      [2, 11, 0, 13, 176000],
      [6, 11, 0, 17, 99000],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-lowair',
    title: '淮州洛带载人首飞',
    topicId: 't01',
    eventId: 'e01',
    points: [
      [7, 8, 0, 9, 18600],
      [9, 8, 0, 4, 42300],
      [12, 8, 0, 2, 61000],
      [13, 8, 0, 3, 45200],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-coupon',
    title: '文旅消费券领取',
    topicId: 't05',
    points: [
      [3, 8, 0, 5, 26800],
      [5, 20, 0, 1, 87400],
      [8, 8, 0, 1, 79200],
      [13, 8, 0, 2, 51300],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-compute',
    title: '城市算力中心',
    topicId: 't10',
    points: [
      [10, 8, 0, 18, 6400],
      [12, 8, 0, 11, 15800],
      [13, 17, 0, 9, 19100],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-wetland',
    title: '湿地生态补水',
    topicId: 't11',
    points: [
      [8, 8, 0, 8, 14300],
      [10, 8, 0, 14, 7200],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-metro',
    title: '地铁末班时间',
    topicId: 't03',
    eventId: 'e06',
    points: [
      [0, 8, 0, 6, 33200],
      [2, 8, 0, 11, 12100],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-baby',
    title: '新生儿一件事',
    topicId: 't07',
    points: [
      [5, 9, 0, 16, 4800],
      [6, 18, 30, 7, 22600],
    ],
  },
  {
    platform: '百度',
    itemId: 'bd-market',
    title: '周末市集地图',
    topicId: null,
    points: [
      [1, 10, 0, 12, 9100],
      [2, 10, 0, 15, 5400],
    ],
  },
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export const HOT_SNAPSHOTS: HotSnapshot[] = SERIES.flatMap((series) =>
  series.points.map((point) => {
    const [dayIndex, hour, minute, rank, heat] = point
    const observedAt = `${addDays(DATA_START, dayIndex)}T${pad(hour)}:${pad(minute)}:00+08:00`
    return {
      id: `${series.platform}:${series.itemId}:${observedAt}`,
      platform: series.platform,
      itemId: series.itemId,
      title: series.title,
      topicId: series.topicId,
      eventId: series.eventId ?? null,
      rank,
      heat,
      observedAt,
    }
  }),
)
