import { useEffect, useState } from 'react'
import type { CharacterInput } from './useCharacterState'

export function useCharacterControl(enabled: boolean): CharacterInput {
  const [input, setInput] = useState<CharacterInput>({
    left: false,
    right: false,
    jump: false,
  })

  useEffect(() => {
    if (!enabled) {
      setInput({ left: false, right: false, jump: false })
      return
    }

    const pressedKeys = new Set<string>()

    const handleKeyDown = (e: KeyboardEvent) => {
      pressedKeys.add(e.key)
      updateInput()
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key)
      updateInput()
    }

    const updateInput = () => {
      setInput({
        left: pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('ArrowRight'),
        jump: pressedKeys.has('ArrowUp') || pressedKeys.has(' '),
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [enabled])

  return input
}

