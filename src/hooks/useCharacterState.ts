export type CharacterState = 'alive' | 'dead' | 'dying'

export interface Character {
  userId: string
  x: number
  y: number
  vx: number
  vy: number
  onGround: boolean
  color: string
  name?: string
  state: CharacterState
  deathTimer?: number
}

export interface CharacterInput {
  left: boolean
  right: boolean
  jump: boolean
}

