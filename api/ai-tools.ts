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
const colorProp = { type: 'string', description: 'Color value (hex like #FF0000 or name like red)' }

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
          fill: colorProp,
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
          fill: colorProp,
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
          fill: colorProp,
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
          fill: colorProp,
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
  // New: search and batch operations
  {
    type: 'function',
    function: {
      name: 'find_shapes',
      description: 'Search existing shapes by simple criteria to disambiguate references',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'rect | circle | text' },
          textContains: { type: 'string' },
          fill: { type: 'string' },
          limit: numberProp,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_shapes',
      description: 'Batch update shapes by ids or selection target',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: "'selected' to operate on the current selection" },
          ids: { type: 'array', items: stringProp },
          patch: {
            type: 'object',
            properties: {
              x: numberProp,
              y: numberProp,
              width: numberProp,
              height: numberProp,
              radius: numberProp,
              fill: { type: 'string' },
              text: { type: 'string' },
              fontSize: numberProp,
              rotation: numberProp,
            },
          },
        },
        required: ['patch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_shapes',
      description: 'Batch delete shapes by ids or selection target',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: "'selected' to operate on the current selection" },
          ids: { type: 'array', items: stringProp },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'duplicate_shapes',
      description: 'Batch duplicate shapes by ids or selection target',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: "'selected' to operate on the current selection" },
          ids: { type: 'array', items: stringProp },
          dx: numberProp,
          dy: numberProp,
        },
      },
    },
  },
]

export default aiTools


