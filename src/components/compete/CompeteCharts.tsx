import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts'
import { EChart, type ChartClick } from '../overview/EChart.tsx'
import { formatAxisDay } from '../../lib/dates.ts'
import { mediaColor } from '../../lib/mediaColor.ts'

const FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'

export function CompeteTrendChart({
  dates,
  series,
  onSelect,
}: {
  dates: string[]
  series: { id: string; name: string; data: number[] }[]
  onSelect: (mediaId: string, date: string) => void
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animation: false,
      textStyle: { fontFamily: FONT },
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll', bottom: 0, textStyle: { color: '#475569' } },
      grid: { left: 8, right: 16, top: 16, bottom: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: '#64748b', formatter: (value: string) => formatAxisDay(value) },
      },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#eef2f6' } } },
      series: series.map((item) => ({
        id: item.id,
        name: item.name,
        type: 'line',
        data: item.data,
        showSymbol: dates.length < 3,
        symbolSize: 8,
        itemStyle: { color: mediaColor(item.id) },
        lineStyle: { width: 2, color: mediaColor(item.id) },
      })),
    }
  }, [dates, series])

  return (
    <div className="chart-box" style={{ height: 320 }}>
      <EChart
        option={option}
        onClick={(params: ChartClick) => {
          if (!params.seriesId || typeof params.dataIndex !== 'number') return
          const date = dates[params.dataIndex]
          if (date) onSelect(params.seriesId, date)
        }}
      />
    </div>
  )
}

export function CompeteCategoryChart({
  categories,
  series,
  onSelect,
}: {
  categories: { id: string; name: string }[]
  series: { id: string; name: string; data: number[] }[]
  onSelect: (mediaId: string, categoryId: string) => void
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animation: false,
      textStyle: { fontFamily: FONT },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { type: 'scroll', bottom: 0, textStyle: { color: '#475569' } },
      grid: { left: 8, right: 16, top: 12, bottom: 48, containLabel: true },
      xAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#eef2f6' } } },
      yAxis: {
        type: 'category',
        inverse: true,
        data: categories.map((item) => item.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#334155' },
      },
      series: series.map((item) => ({
        id: item.id,
        name: item.name,
        type: 'bar',
        barMaxWidth: 14,
        data: item.data,
        itemStyle: { color: mediaColor(item.id), borderRadius: 2 },
      })),
    }
  }, [categories, series])

  return (
    <div className="chart-box" style={{ height: Math.max(280, categories.length * 48 + 72) }}>
      <EChart
        option={option}
        onClick={(params: ChartClick) => {
          if (!params.seriesId || typeof params.dataIndex !== 'number') return
          const category = categories[params.dataIndex]
          if (category) onSelect(params.seriesId, category.id)
        }}
      />
    </div>
  )
}
