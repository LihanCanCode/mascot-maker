import { useEffect, useState, type RefObject } from 'react'

const MARGIN = '300px'

/** True once the element has come within ~300px of the viewport. It never goes back to false. */
export function useNearViewport(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (near || element === null) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: MARGIN },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [near, ref])
  return near
}
