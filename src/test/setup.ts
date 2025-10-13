import * as React from 'react'

// Mock react-konva to avoid requiring node-canvas in tests
vi.mock('react-konva', () => {
  let pointer = { x: 100, y: 100 }
  const Stage = React.forwardRef<any, any>((props, ref) => {
    const api = {
      getPointerPosition: () => pointer,
      position: () => ({ x: props.x ?? 0, y: props.y ?? 0 }),
      container: () => ({ addEventListener: () => {}, removeEventListener: () => {} }),
    }
    if (typeof ref === 'function') ref(api)
    else if (ref) (ref as any).current = api
    return React.createElement(
      'div',
      {
        'data-testid': 'stage',
        'data-width': props.width,
        'data-height': props.height,
        onMouseDown: (e: any) => {
          pointer = { x: e.clientX ?? pointer.x, y: e.clientY ?? pointer.y }
          props.onMouseDown?.(e)
        },
        onMouseMove: (e: any) => {
          pointer = { x: e.clientX ?? pointer.x, y: e.clientY ?? pointer.y }
          props.onMouseMove?.(e)
        },
        onMouseUp: (e: any) => {
          pointer = { x: e.clientX ?? pointer.x, y: e.clientY ?? pointer.y }
          props.onMouseUp?.(e)
        },
      },
      props.children,
    )
  })
  const Layer: React.FC<any> = (props) =>
    React.createElement('div', { 'data-testid': 'layer' }, props.children)
  const Line: React.FC<any> = () => React.createElement('div', { 'data-testid': 'line' })
  const Rect: React.FC<any> = (props) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] || 'rect',
      onClick: props.onClick,
      onMouseDown: props.onMouseDown,
      onMouseUp: props.onMouseUp,
    })
  const Circle: React.FC<any> = (props) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] || 'circle',
      onClick: props.onClick,
      onMouseDown: props.onMouseDown,
      onMouseUp: props.onMouseUp,
    })
  const Text: React.FC<any> = (props) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] || 'text',
      onClick: props.onClick,
      onMouseDown: props.onMouseDown,
      onMouseUp: props.onMouseUp,
    })
  const Transformer: React.FC<any> = () => React.createElement('div', { 'data-testid': 'transformer' })
  return { Stage, Layer, Line, Rect, Circle, Text, Transformer }
})


