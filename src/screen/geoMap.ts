import * as echarts from 'echarts'
import china from './geo/china.json'
import geo from './geo/sichuan.json'

let sichuanReady = false
let chinaReady = false

export function ensureSichuanMap() {
  if (sichuanReady) return
  echarts.registerMap('sichuan-clue', geo as never)
  sichuanReady = true
}

export function ensureChinaMap() {
  if (chinaReady) return
  echarts.registerMap('china-clue', china as never)
  chinaReady = true
}
