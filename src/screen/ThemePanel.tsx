import type { CSSProperties } from 'react'
import { THEME_LIST, type DashboardAppearance, type DashPalette } from './theme.ts'

export function ThemePanel({
  value,
  onChange,
  onApply,
  onClose,
  onReset,
}: {
  value: DashboardAppearance
  onChange: (next: DashboardAppearance) => void
  onApply: () => void
  onClose: () => void
  onReset: () => void
}) {
  return (
    <section className="theme-strip" aria-label="主题">
      <header>
        <h3>主题</h3>
        <span className="compose-note">预览只改配色。应用后写入草稿，可撤销。不会重排组件。</span>
        <button type="button" className="dash-btn" onClick={onReset}>恢复本主题默认设置</button>
        <button type="button" className="dash-btn" onClick={onClose}>取消</button>
        <button type="button" className="dash-btn primary" onClick={onApply}>应用主题</button>
      </header>
      <div className="theme-row">
        {THEME_LIST.map((theme) => (
          <button key={theme.id} type="button" className={value.themeId === theme.id ? 'theme-card on' : 'theme-card'} aria-pressed={value.themeId === theme.id} onClick={() => onChange({ ...value, themeId: theme.id })}>
            <span className="theme-sample" style={sampleStyle(theme)} aria-hidden="true">
              <i className="sample-head" />
              <i className="sample-map" />
              <i className="sample-side" />
              <i className="sample-trend" />
            </span>
            <strong>{theme.name}</strong>
            <em>{theme.blurb}</em>
          </button>
        ))}
      </div>
      <div className="theme-tools">
        <label>
          <input type="checkbox" checked={value.motionEnabled} onChange={(event) => onChange({ ...value, motionEnabled: event.target.checked })} />
          动效
        </label>
        <span className="compose-note">关闭动效只停掉过渡和装饰动画。新闻轮播仍按播放设置，数据刷新不受影响。</span>
      </div>
    </section>
  )
}

function sampleStyle(theme: DashPalette): CSSProperties {
  return {
    background: theme.bg,
    ['--sample-border' as string]: theme.border,
    ['--sample-accent' as string]: theme.accent,
    ['--sample-panel' as string]: theme.panel,
    ['--sample-scale' as string]: theme.mapScale[2],
    ['--sample-highlight' as string]: theme.highlight,
  }
}
