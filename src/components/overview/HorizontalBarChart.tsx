import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts'
import type { CountItem } from '../../lib/overviewSelectors.ts'
import { EChart, type ChartClick } from './EChart.tsx'

const FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'

export function HorizontalBarChart({
  items,
  color,
  onSelect,
}: {
  items: CountItem[]
  color: string | ((item: CountItem) => string)
  onSelect: (id: string) => void
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animation: false,
      textStyle: { fontFamily: FONT },
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const first = (Array.isArray(params) ? params[0] : params) as { dataIndex?: number }
          const item = items[first.dataIndex ?? -1]
          if (!item) return ''
          return `${item.name}<br/>新闻 ${item.count} 条`
        },
      },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#eef2f6' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        triggerEvent: true,
        data: items.map((item) => item.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#334155', width: 96, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          cursor: 'pointer',
          barMaxWidth: 16,
          data: items.map((item) => ({
            value: item.count,
            itemStyle: { color: typeof color === 'function' ? color(item) : color, borderRadius: 2 },
          })),
          label: { show: true, position: 'right', color: '#475569', fontSize: 12 },
        },
      ],
    }
  }, [items, color])

  const boxHeight = Math.max(280, items.length * 48 + 28)

  function handleClick(params: ChartClick) {
    if (typeof params.dataIndex !== 'number') return
    if (params.componentType !== 'series' && params.componentType !== 'yAxis') return
    onSelect(items[params.dataIndex].id)
  }

  return (
    <div className="chart-box" style={{ height: boxHeight }}>
      <EChart option={option} onClick={handleClick} />
    </div>
  )
}
