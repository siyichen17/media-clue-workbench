import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts'
import type { DailyPoint } from '../../lib/overviewSelectors.ts'
import { EChart, type ChartClick } from './EChart.tsx'

const FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
const POINT_COLORS = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#4f46e5', '#e11d48', '#0284c7']

export function DailyNewsChart({
  points,
  selectedDay,
  onSelectDay,
}: {
  points: DailyPoint[]
  selectedDay: string | null
  onSelectDay: (day: string) => void
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animation: false,
      textStyle: { fontFamily: FONT },
      grid: { left: 48, right: 16, top: 24, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const first = Array.isArray(params) ? params[0] : params
          const row = first as { dataIndex?: number }
          const point = points[row.dataIndex ?? 0]
          if (!point) return ''
          return `${point.date}<br/>新闻 ${point.count} 条`
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.date),
        triggerEvent: true,
        axisTick: { alignWithLabel: true },
        axisLabel: {
          color: '#64748b',
          formatter: (value: string) => value.slice(5),
        },
        axisLine: { lineStyle: { color: '#e5eaf1' } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#eef2f6' } },
      },
      series: [
        {
          type: 'line',
          name: '新闻数',
          cursor: 'pointer',
          showSymbol: true,
          symbol: 'circle',
          triggerEvent: true,
          data: points.map((point, index) => {
            const selected = point.date === selectedDay
            return {
              value: point.count,
              symbolSize: selected ? 14 : 8,
              itemStyle: {
                color: selected ? '#ffffff' : POINT_COLORS[index % POINT_COLORS.length],
                borderColor: selected ? '#7c3aed' : '#ffffff',
                borderWidth: 2,
              },
            }
          }),
          lineStyle: {
            width: 3,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#2563eb' },
                { offset: 0.5, color: '#0f766e' },
                { offset: 1, color: '#7c3aed' },
              ],
            },
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37, 99, 235, 0.22)' },
                { offset: 0.55, color: 'rgba(15, 118, 110, 0.08)' },
                { offset: 1, color: 'rgba(124, 58, 237, 0.02)' },
              ],
            },
          },
          markLine: selectedDay
            ? {
                silent: true,
                symbol: 'none',
                label: { formatter: '已选日期', color: '#6d28d9' },
                lineStyle: { color: '#6d28d9', type: 'dashed' },
                data: [{ xAxis: selectedDay }],
              }
            : undefined,
        },
      ],
    }
  }, [points, selectedDay])

  function handleClick(params: ChartClick) {
    if (params.componentType === 'xAxis' && typeof params.value === 'string') {
      onSelectDay(params.value)
      return
    }
    if (typeof params.dataIndex === 'number') onSelectDay(points[params.dataIndex].date)
  }

  return (
    <div className="chart-box" style={{ height: 300 }}>
      <EChart option={option} onClick={handleClick} />
    </div>
  )
}
