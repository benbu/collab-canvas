import * as React from 'react'

// Mock react-konva to avoid requiring node-canvas in tests
vi.mock('react-konva', () => {
  const Stage: React.FC<any> = (props) =>
    React.createElement(
      'div',
      { 'data-testid': 'stage', 'data-width': props.width, 'data-height': props.height },
      props.children,
    )
  const Layer: React.FC<any> = (props) =>
    React.createElement('div', { 'data-testid': 'layer' }, props.children)
  const Line: React.FC<any> = () => React.createElement('div', { 'data-testid': 'line' })
  return { Stage, Layer, Line }
})


