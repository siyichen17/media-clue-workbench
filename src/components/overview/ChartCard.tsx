import type { ReactNode } from 'react'

export function ChartCard({
  title,
  caption,
  extra,
  empty,
  emptyText = '没有符合条件的新闻',
  children,
  testId,
  className,
}: {
  title: string
  caption: string
  extra?: ReactNode
  empty?: boolean
  emptyText?: string
  children: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <section className={className ? `card ${className}` : 'card'} data-testid={testId}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          <p>{caption}</p>
        </div>
        {extra}
      </header>
      <div className="card-body">{empty ? <div className="empty-state">{emptyText}</div> : children}</div>
    </section>
  )
}
