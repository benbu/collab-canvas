import * as React from 'react'
import { vi } from 'vitest'

// Mock react-konva to avoid requiring node-canvas in tests
vi.mock('react-konva', () => {
  let pointer = { x: 100, y: 100 }
  const Stage = React.forwardRef<Record<string, unknown>, Record<string, unknown>>((props, ref) => {
    const api = {
      getPointerPosition: () => pointer,
      position: () => ({ x: (props as any).x ?? 0, y: (props as any).y ?? 0 }),
      container: () => ({ addEventListener: () => {}, removeEventListener: () => {} }),
    }
    if (typeof ref === 'function') ref(api)
    else if (ref) (ref as any).current = api
    const children = (props as any).children as any
    return React.createElement(
      'div',
      {
        'data-testid': 'stage',
        'data-width': (props as any).width,
        'data-height': (props as any).height,
        onMouseDown: (e: any) => {
          pointer = { x: e.clientX ?? pointer.x, y: e.clientY ?? pointer.y }
          ;(props as any).onMouseDown?.(e)
        },
        onMouseMove: (e: any) => {
          pointer = { x: e.clientX ?? pointer.x, y: e.clientY ?? pointer.y }
          ;(props as any).onMouseMove?.(e)
        },
        onMouseUp: (e: any) => {
          pointer = { x: e.clientX ?? pointer.x, y: e.clientY ?? pointer.y }
          ;(props as any).onMouseUp?.(e)
        },
      },
      children,
    )
  })
  const Layer: React.FC<Record<string, unknown>> = (props) =>
    React.createElement('div', { 'data-testid': 'layer' }, props.children as any)
  const Line: React.FC = () => React.createElement('div', { 'data-testid': 'line' })
  const Rect: React.FC<Record<string, unknown>> = (props) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] || 'rect',
      onClick: props.onClick,
      onMouseDown: props.onMouseDown,
      onMouseUp: props.onMouseUp,
    })
  const Circle: React.FC<Record<string, unknown>> = (props) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] || 'circle',
      onClick: props.onClick,
      onMouseDown: props.onMouseDown,
      onMouseUp: props.onMouseUp,
    })
  const Text: React.FC<Record<string, unknown>> = (props) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] || 'text',
      onClick: props.onClick,
      onMouseDown: props.onMouseDown,
      onMouseUp: props.onMouseUp,
    })
  const Transformer: React.FC = () => React.createElement('div', { 'data-testid': 'transformer' })
  const Group: React.FC<Record<string, unknown>> = (props) =>
    React.createElement('div', { 'data-testid': 'group' }, props.children as any)
  return { Stage, Layer, Line, Rect, Circle, Text, Transformer, Group }
})


