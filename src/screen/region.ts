import { EVENT_PLACES } from '../data/demo/news.ts'

/** 阿里云 DataV GeoAtlas，四川省地级边界 510000_full，2026-11-17 下载。 */
export const SICHUAN_CITIES = [
  '成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市',
  '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市',
  '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州',
]

export function regionOfPlace(place: string): string | null {
  if (!place) return null
  if (/和|、|及/.test(place)) return null
  if (/平台|政务|网站/.test(place)) return null
  if (place.includes('雅安') || place.includes('芦山')) return '雅安市'
  if (/成都|都江堰|金堂|双流|新津|武侯|锦江|高新|东部新区|天府|洛带/.test(place)) return '成都市'
  return null
}

/** 与 DataV 100000_full 的省级名称一致，不含境界线。 */
export const PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省',
  '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省', '云南省', '西藏自治区',
  '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区', '台湾省', '香港特别行政区', '澳门特别行政区',
]

/** 演示材料里的发生地原文映射到省级名称。无法判断的返回 null，不猜测。 */
export function provinceOfPlace(place: string): string | null {
  if (!place) return null
  if (/和|、|及/.test(place)) return null
  if (/平台|政务|网站/.test(place)) return null
  if (/成都|都江堰|金堂|双流|新津|武侯|锦江|高新|东部新区|天府|洛带|雅安|芦山/.test(place)) return '四川省'
  return null
}

export function placeOfEvent(eventId: string) {
  return EVENT_PLACES[eventId] ?? ''
}
