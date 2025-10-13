import * as React from 'react'

// Mock react-konva to avoid requiring node-canvas in tests
vi.mock('react-konva', () => {
  const Stage = React.forwardRef<any, any>((props, ref) => {
    const api = {
      getPointerPosition: () => ({ x: 100, y: 100 }),
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
        onMouseDown: props.onMouseDown,
      },
      props.children,
    )
  })
  const Layer: React.FC<any> = (props) =>
    React.createElement('div', { 'data-testid': 'layer' }, props.children)
  const Line: React.FC<any> = () => React.createElement('div', { 'data-testid': 'line' })
  const Rect: React.FC<any> = () => React.createElement('div', { 'data-testid': 'rect' })
  const Circle: React.FC<any> = () => React.createElement('div', { 'data-testid': 'circle' })
  const Text: React.FC<any> = () => React.createElement('div', { 'data-testid': 'text' })
  return { Stage, Layer, Line, Rect, Circle, Text }
})


