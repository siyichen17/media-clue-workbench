import { PLATFORMS } from '../../data/demo/index.ts'
import { DATA_END, DATA_START, dateRangeOf, presetLabel } from '../../lib/dates.ts'
import type { DatePreset, OverviewFilters } from '../../types/domain.ts'

function keepDay(filters: OverviewFilters): OverviewFilters {
  if (!filters.selectedDay) return filters
  const { start, end } = dateRangeOf(filters)
  if (filters.selectedDay < start || filters.selectedDay > end) {
    return { ...filters, selectedDay: null }
  }
  return filters
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: OverviewFilters
  onChange: (filters: OverviewFilters) => void
}) {
  const range = dateRangeOf(filters)
  const tags = [
    { id: 'range', label: `${presetLabel(filters.preset)} · ${range.start} 至 ${range.end}` },
    ...(filters.selectedDay ? [{ id: 'day', label: `单日 ${filters.selectedDay}` }] : []),
    ...(filters.platform !== 'all' ? [{ id: 'platform', label: `平台 ${filters.platform}` }] : []),
    ...(filters.keyword.trim() ? [{ id: 'keyword', label: `关键词 ${filters.keyword.trim()}` }] : []),
  ]

  function setPreset(preset: DatePreset) {
    onChange(keepDay({ ...filters, preset }))
  }

  function clearTag(id: string) {
    if (id === 'range') {
      onChange(
        keepDay({
          ...filters,
          preset: '7d',
          customStart: '2026-11-04',
          customEnd: DATA_END,
        }),
      )
      return
    }
    if (id === 'day') onChange({ ...filters, selectedDay: null })
    if (id === 'platform') onChange({ ...filters, platform: 'all' })
    if (id === 'keyword') onChange({ ...filters, keyword: '' })
  }

  return (
    <section className="filter-bar" aria-label="筛选">
      <div className="filter-controls">
        <div className="field">
          <span>日期范围</span>
          <div className="segmented" role="group" aria-label="日期范围">
            <button type="button" aria-pressed={filters.preset === '7d'} onClick={() => setPreset('7d')}>
              最近7天
            </button>
            <button type="button" aria-pressed={filters.preset === '14d'} onClick={() => setPreset('14d')}>
              最近14天
            </button>
            <button type="button" aria-pressed={filters.preset === 'custom'} onClick={() => setPreset('custom')}>
              自定义
            </button>
          </div>
        </div>
        {filters.preset === 'custom' && (
          <div className="field dates">
            <label>
              开始
              <input
                type="date"
                min={DATA_START}
                max={DATA_END}
                value={filters.customStart}
                onChange={(event) =>
                  onChange(keepDay({ ...filters, preset: 'custom', customStart: event.target.value }))
                }
              />
            </label>
            <label>
              结束
              <input
                type="date"
                min={DATA_START}
                max={DATA_END}
                value={filters.customEnd}
                onChange={(event) =>
                  onChange(keepDay({ ...filters, preset: 'custom', customEnd: event.target.value }))
                }
              />
            </label>
          </div>
        )}
        <label className="field">
          <span>发布平台</span>
          <select
            value={filters.platform}
            onChange={(event) => onChange({ ...filters, platform: event.target.value })}
          >
            <option value="all">全部平台</option>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>关键词</span>
          <input
            type="search"
            placeholder="搜索标题、话题、事件或媒体"
            value={filters.keyword}
            onChange={(event) => onChange({ ...filters, keyword: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            onChange({
              preset: '7d',
              customStart: '2026-11-04',
              customEnd: DATA_END,
              selectedDay: null,
              platform: 'all',
              keyword: '',
            })
          }
        >
          重置筛选
        </button>
      </div>
      <div className="tag-row">
        {tags.map((tag) => (
          <button key={tag.id} type="button" className="filter-tag" onClick={() => clearTag(tag.id)}>
            {tag.label}
            <span aria-hidden="true">×</span>
            <span className="sr-only">取消</span>
          </button>
        ))}
      </div>
    </section>
  )
}
