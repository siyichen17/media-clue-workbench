import { PROTO_WIDGETS } from './protoCatalog.ts'

const HEAT = [0.35, 0.55, 0.8, 0.4, 0.62, 0.3, 0.7, 0.48, 0.58, 0.28, 0.66, 0.42, 0.5, 0.75, 0.33, 0.6, 0.45, 0.52]

export function MiniGlyph({ type }: { type: number }) {
  const kind = PROTO_WIDGETS[type]?.type
  if (kind === 'line') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <path d="M10,60 Q30,40 50,50 T90,30 L110,20" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.7" />
        <path d="M10,70 Q30,55 50,60 T90,45 L110,40" fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.5" />
        <path d="M10,65 Q30,50 50,55 T90,35 L110,30" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" />
      </svg>
    )
  }
  if (kind === 'bar') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        {[10, 28, 46, 64, 82, 100].map((x, index) => <rect key={x} x={x} y={[40, 25, 50, 15, 35, 45][index]} width="14" height={[30, 45, 20, 55, 35, 25][index]} rx="2" fill="#3b82f6" opacity={0.5 + index * 0.08} />)}
      </svg>
    )
  }
  if (kind === 'pie') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="60" cy="40" r="30" fill="none" stroke="#3b82f6" strokeWidth="12" strokeDasharray="60 140" opacity="0.8" />
        <circle cx="60" cy="40" r="30" fill="none" stroke="#8b5cf6" strokeWidth="12" strokeDasharray="40 140" strokeDashoffset="-60" opacity="0.7" />
        <circle cx="60" cy="40" r="30" fill="none" stroke="#10b981" strokeWidth="12" strokeDasharray="30 140" strokeDashoffset="-100" opacity="0.6" />
        <circle cx="60" cy="40" r="18" fill="#fff" />
      </svg>
    )
  }
  if (kind === 'heatmap') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        {HEAT.map((opacity, index) => <rect key={index} x={10 + (index % 6) * 18} y={10 + Math.floor(index / 6) * 22} width="16" height="20" rx="2" fill="#3b82f6" opacity={opacity} />)}
      </svg>
    )
  }
  if (kind === 'wordcloud') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <text x="60" y="30" textAnchor="middle" fontSize="12" fill="#3b82f6" fontWeight="700">AI大模型</text>
        <text x="40" y="50" textAnchor="middle" fontSize="9" fill="#8b5cf6">低空经济</text>
        <text x="85" y="48" textAnchor="middle" fontSize="10" fill="#ef4444">三星堆</text>
        <text x="60" y="65" textAnchor="middle" fontSize="8" fill="#10b981">新能源</text>
      </svg>
    )
  }
  if (kind === 'kpi') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <text x="60" y="45" textAnchor="middle" fontSize="24" fill="#1e293b" fontWeight="800">12,847</text>
        <text x="60" y="65" textAnchor="middle" fontSize="10" fill="#94a3b8">今日线索</text>
      </svg>
    )
  }
  if (kind === 'table') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="10" y="10" width="100" height="12" rx="2" fill="#f1f5f9" />
        <rect x="10" y="26" width="100" height="10" rx="1" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="10" y="40" width="100" height="10" rx="1" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="10" y="54" width="100" height="10" rx="1" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      </svg>
    )
  }
  if (kind === 'alert') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="16" cy="20" r="4" fill="#ef4444" /><rect x="26" y="16" width="70" height="8" rx="2" fill="#f1f5f9" />
        <circle cx="16" cy="40" r="4" fill="#f59e0b" /><rect x="26" y="36" width="60" height="8" rx="2" fill="#f1f5f9" />
        <circle cx="16" cy="60" r="4" fill="#3b82f6" /><rect x="26" y="56" width="80" height="8" rx="2" fill="#f1f5f9" />
      </svg>
    )
  }
  if (kind === 'timeline') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <line x1="20" y1="10" x2="20" y2="70" stroke="#3b82f6" strokeWidth="2" opacity="0.3" />
        <circle cx="20" cy="20" r="4" fill="#3b82f6" /><rect x="30" y="16" width="60" height="8" rx="2" fill="#f1f5f9" />
        <circle cx="20" cy="40" r="4" fill="#8b5cf6" /><rect x="30" y="36" width="50" height="8" rx="2" fill="#f1f5f9" />
        <circle cx="20" cy="60" r="4" fill="#10b981" /><rect x="30" y="56" width="70" height="8" rx="2" fill="#f1f5f9" />
      </svg>
    )
  }
  if (kind === 'map') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <path d="M30,15 L50,10 L80,15 L100,25 L105,45 L95,60 L75,68 L55,65 L35,58 L25,45 L20,30 Z" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
        <circle cx="60" cy="35" r="3" fill="#ef4444" /><circle cx="75" cy="45" r="2.5" fill="#3b82f6" /><circle cx="45" cy="50" r="2" fill="#10b981" />
      </svg>
    )
  }
  if (kind === 'progress') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="10" y="15" width="100" height="10" rx="5" fill="#f1f5f9" /><rect x="10" y="15" width="75" height="10" rx="5" fill="#3b82f6" opacity="0.8" />
        <rect x="10" y="35" width="100" height="10" rx="5" fill="#f1f5f9" /><rect x="10" y="35" width="60" height="10" rx="5" fill="#8b5cf6" opacity="0.7" />
        <rect x="10" y="55" width="100" height="10" rx="5" fill="#f1f5f9" /><rect x="10" y="55" width="90" height="10" rx="5" fill="#10b981" opacity="0.8" />
      </svg>
    )
  }
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
      {[12, 24, 36, 48, 60].map((y) => <rect key={y} x="10" y={y} width="100" height="8" rx="2" fill="#f1f5f9" />)}
    </svg>
  )
}
