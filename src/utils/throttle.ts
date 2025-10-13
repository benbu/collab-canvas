export function throttle<T extends (...args: unknown[]) => void>(callback: T, waitMs: number) {
  let lastCallTime = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const invoke = () => {
    lastCallTime = Date.now()
    timeoutId = null
    if (lastArgs) {
      callback(...lastArgs)
      lastArgs = null
    }
  }

  return (...args: Parameters<T>) => {
    const now = Date.now()
    const remaining = waitMs - (now - lastCallTime)
    lastArgs = args

    if (remaining <= 0 || remaining > waitMs) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      invoke()
    } else if (!timeoutId) {
      timeoutId = setTimeout(invoke, remaining)
    }
  }
}


