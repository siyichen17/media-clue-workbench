import { minSize } from './layout.ts'
import type { WidgetKind, WidgetRole } from './types.ts'

/**
 * 主体区在 1920×1080 设计画布上的像素宽高比。
 * 组件存的是主体区百分比，屏幕上的形状要乘上这个比例。
 * 标题、指标带和页脚占掉约 194px 高度后，主体大约是 1880×886。
 */
export const BODY_ASPECT = 1880 / 886

export type LayoutBehavior = 'shape-sensitive' | 'directional' | 'flexible'
export type WidgetOrientation = 'horizontal' | 'vertical'

export interface WidgetShapeProfile {
  minWidth: number
  minHeight: number
  preferredAspectRatio?: [number, number]
  /** 超出这个范围的新候选直接作废。缺省表示只受最小尺寸约束。 */
  hardAspectRatio?: [number, number]
  layoutBehavior: LayoutBehavior
  supportedOrientations: WidgetOrientation[]
}

export function pixelAspect(width: number, height: number) {
  if (height <= 0) return 1
  return (width / height) * BODY_ASPECT
}

export function shapeProfile(type: WidgetKind, mapScope: 'auto' | 'china' | 'sichuan' = 'auto', _role: WidgetRole = 'secondary'): WidgetShapeProfile {
  const min = minSize(type)
  const base = { minWidth: min.w, minHeight: min.h }
  if (type === 'map') {
    const china = mapScope === 'china'
    return {
      ...base,
      preferredAspectRatio: china ? [1.2, 1.8] : [0.9, 1.4],
      hardAspectRatio: china ? [1.0, 2.15] : [0.75, 1.7],
      layoutBehavior: 'shape-sensitive',
      supportedOrientations: ['horizontal'],
    }
  }
  if (type === 'bubbles') {
    return { ...base, preferredAspectRatio: [1.0, 1.6], hardAspectRatio: [0.72, 2.35], layoutBehavior: 'shape-sensitive', supportedOrientations: ['horizontal'] }
  }
  if (type === 'newsList') {
    return { ...base, preferredAspectRatio: [1.4, 2.2], layoutBehavior: 'shape-sensitive', supportedOrientations: ['horizontal'] }
  }
  if (type === 'trend' || type === 'coverage') {
    return { ...base, preferredAspectRatio: [2.0, 3.5], hardAspectRatio: [1.5, 8.6], layoutBehavior: 'directional', supportedOrientations: ['horizontal'] }
  }
  if (type === 'hourly') {
    return { ...base, preferredAspectRatio: [1.8, 3.0], hardAspectRatio: [1.4, 6], layoutBehavior: 'directional', supportedOrientations: ['horizontal'] }
  }
  if (type === 'sources' || type === 'peers') {
    return { ...base, preferredAspectRatio: [1.1, 1.8], layoutBehavior: 'directional', supportedOrientations: ['horizontal'] }
  }
  if (type === 'progress') {
    return { ...base, layoutBehavior: 'directional', supportedOrientations: ['horizontal', 'vertical'] }
  }
  return { ...base, layoutBehavior: 'flexible', supportedOrientations: ['horizontal', 'vertical'] }
}

/** 新候选或交换结果不满足硬约束时返回原因。空字符串表示可以通过。 */
export function shapeViolation(type: WidgetKind, width: number, height: number, mapScope: 'auto' | 'china' | 'sichuan' = 'auto') {
  const profile = shapeProfile(type, mapScope)
  const hard = profile.hardAspectRatio
  if (!hard) return ''
  const aspect = pixelAspect(width, height)
  if (aspect + 0.03 < hard[0] || aspect - 0.03 > hard[1]) {
    const prefer = profile.preferredAspectRatio
    const band = prefer ? `${prefer[0]}–${prefer[1]}` : `${hard[0]}–${hard[1]}`
    return `外框宽高比约 ${aspect.toFixed(1)}，适合 ${band}`
  }
  return ''
}

export function aspectPenalty(type: WidgetKind, width: number, height: number, mapScope: 'auto' | 'china' | 'sichuan' = 'auto') {
  const profile = shapeProfile(type, mapScope)
  const pixel = pixelAspect(width, height)
  if (type === 'progress') {
    const band: [number, number] = pixel < 1.2 ? [0.45, 1.15] : [1.3, 4]
    return distancePenalty(pixel, band)
  }
  if (!profile.preferredAspectRatio || profile.layoutBehavior === 'flexible') return pixel > 6.5 || pixel < 0.35 ? 8 : 0
  return distancePenalty(pixel, profile.preferredAspectRatio)
}

function distancePenalty(pixel: number, band: [number, number]) {
  if (pixel < band[0]) return Math.min(14, Math.round((band[0] / Math.max(pixel, 0.2) - 1) * 12))
  if (pixel > band[1]) return Math.min(14, Math.round((pixel / band[1] - 1) * 10))
  return -4
}
