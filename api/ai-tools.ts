// Minimal tool schema for serverless function (duplicated from src/ai/tools)
export type AiTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

const numberProp = { type: 'number' }
const stringProp = { type: 'string' }

const aiTools: AiTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_rectangle',
      description: 'Create a rectangle on the canvas',
      parameters: {
        type: 'object',
        properties: {
          x: numberProp,
          y: numberProp,
          width: numberProp,
          height: numberProp,
          fill: stringProp,
          rotation: numberProp,
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_circle',
      description: 'Create a circle on the canvas',
      parameters: {
        type: 'object',
        properties: {
          x: numberProp,
          y: numberProp,
          radius: numberProp,
          fill: stringProp,
          rotation: numberProp,
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_text',
      description: 'Create a text element on the canvas',
      parameters: {
        type: 'object',
        properties: {
          x: numberProp,
          y: numberProp,
          text: stringProp,
          fontSize: numberProp,
          fill: stringProp,
          rotation: numberProp,
        },
        required: ['x', 'y', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_shape',
      description: 'Update properties of an existing shape',
      parameters: {
        type: 'object',
        properties: {
          id: stringProp,
          x: numberProp,
          y: numberProp,
          width: numberProp,
          height: numberProp,
          radius: numberProp,
          fill: stringProp,
          text: stringProp,
          fontSize: numberProp,
          rotation: numberProp,
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_shape',
      description: 'Delete a shape by id',
      parameters: {
        type: 'object',
        properties: { id: stringProp },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'duplicate_shape',
      description: 'Duplicate a shape with optional offset',
      parameters: {
        type: 'object',
        properties: { id: stringProp, dx: numberProp, dy: numberProp },
        required: ['id'],
      },
    },
  },
]

export default aiTools


