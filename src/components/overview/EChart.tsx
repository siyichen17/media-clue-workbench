import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export interface ChartClick {
  componentType?: string
  seriesId?: string
  dataIndex?: number
  data?: unknown
  value?: unknown
  name?: string
}

export function EChart({
  option,
  onClick,
  restoreToken = 0,
}: {
  option: echarts.EChartsCoreOption
  onClick?: (params: ChartClick) => void
  restoreToken?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const clickRef = useRef(onClick)
  const optionRef = useRef(option)
  clickRef.current = onClick
  optionRef.current = option

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let chart: echarts.ECharts | null = null
    let frame = 0
    let width = 0
    let height = 0
    const handleClick = (params: unknown) => {
      clickRef.current?.(params as ChartClick)
    }
    const paint = () => {
      if (!chart || chart.isDisposed()) return
      try {
        chart.setOption(optionRef.current, true)
        chart.resize({ width, height })
      } catch {
        // A map drawn at zero size throws inside ECharts. Keep the page usable.
      }
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const nextWidth = Math.round(rect.width)
      const nextHeight = Math.round(rect.height)
      if (nextWidth < 2 || nextHeight < 2) return
      if (nextWidth === width && nextHeight === height && chart) return
      width = nextWidth
      height = nextHeight
      if (!chart) {
        chart = echarts.init(host, undefined, { width, height })
        chartRef.current = chart
        chart.on('click', handleClick)
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(paint)
    })
    observer.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      chart?.off('click', handleClick)
      chart?.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || chart.isDisposed()) return
    const width = chart.getWidth()
    const height = chart.getHeight()
    if (width < 2 || height < 2) return
    try {
      chart.setOption(option, { notMerge: false, lazyUpdate: true })
    } catch {
      // Keep the last successful frame instead of blanking the page.
    }
  }, [option])

  useEffect(() => {
    if (!restoreToken) return
    const chart = chartRef.current
    if (!chart || chart.isDisposed()) return
    try { chart.dispatchAction({ type: 'restore' }) } catch { /* keep the current view */ }
  }, [restoreToken])

  return <div ref={hostRef} className="echart-host" />
}
