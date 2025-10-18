import { useEffect, useRef } from 'react'

type Props = {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }: Props) {
  const firstBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    firstBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, minWidth: 360, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{title}</div>
        <div style={{ marginBottom: 12, color: '#374151' }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button ref={firstBtnRef} onClick={onCancel}>{cancelText}</button>
          <button onClick={onConfirm} style={{ color: '#b91c1c' }}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}


