import { useCallback, useMemo, useState } from 'react'

export function useCanvasInteractions() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectionRect, setSelectionRect] = useState<
    | null
    | { x: number; y: number; w: number; h: number; active: boolean; originX: number; originY: number }
  >(null)

  const selectOne = useCallback((id: string) => setSelectedIds([id]), [])
  const toggleSelect = useCallback(
    (id: string) =>
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])),
    [],
  )
  const clearSelection = useCallback(() => setSelectedIds([]), [])

  const beginDragSelect = useCallback((x: number, y: number) => {
    setSelectionRect({ x, y, w: 0, h: 0, active: true, originX: x, originY: y })
  }, [])
  const updateDragSelect = useCallback((x: number, y: number) => {
    setSelectionRect((prev) => {
      if (!prev) return prev
      const w = x - prev.originX
      const h = y - prev.originY
      return { ...prev, x: Math.min(prev.originX, x), y: Math.min(prev.originY, y), w: Math.abs(w), h: Math.abs(h) }
    })
  }, [])
  const endDragSelect = useCallback(() => setSelectionRect((prev) => (prev ? { ...prev, active: false } : prev)), [])

  return useMemo(
    () => ({ selectedIds, setSelectedIds, selectOne, toggleSelect, clearSelection, selectionRect, beginDragSelect, updateDragSelect, endDragSelect }),
    [selectedIds, selectOne, toggleSelect, clearSelection, selectionRect, beginDragSelect, updateDragSelect, endDragSelect],
  )
}


