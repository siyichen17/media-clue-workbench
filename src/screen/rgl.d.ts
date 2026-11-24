declare module 'react-grid-layout' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react'

  export interface Layout {
    i: string
    x: number
    y: number
    w: number
    h: number
    minW?: number
    minH?: number
    static?: boolean
  }

  interface GridProps {
    layout: Layout[]
    cols: number
    rowHeight: number
    width: number
    margin?: [number, number]
    containerPadding?: [number, number]
    maxRows?: number
    compactType?: 'vertical' | 'horizontal' | null
    preventCollision?: boolean
    isBounded?: boolean
    isDraggable?: boolean
    isResizable?: boolean
    transformScale?: number
    draggableHandle?: string
    resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>
    onDrag?: (layout: Layout[], oldItem: Layout, newItem: Layout) => void
    onDragStop?: (layout: Layout[], oldItem: Layout, newItem: Layout) => void
    onResize?: (layout: Layout[], oldItem: Layout, newItem: Layout) => void
    onResizeStop?: (layout: Layout[], oldItem: Layout, newItem: Layout) => void
    className?: string
    children?: ReactNode
    style?: CSSProperties
  }

  const GridLayout: ComponentType<GridProps>
  export default GridLayout
}
