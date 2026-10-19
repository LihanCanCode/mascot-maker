import { useCallback, useEffect, useRef, type Dispatch } from 'react'
import { inspectImageFile } from '../../adapters/fileCheck'
import type { SheetKind } from '../../core/types'
import type { AppAction } from '../state/appReducer'

const READ_FAILED = 'We could not read that file. Try downloading the image again.'

/**
 * Validates a chosen file from its header, then hands it to the reducer.
 * The preview URL is created only after validation passes, a newer pick for the same sheet
 * supersedes an older one, and nothing happens after unmount.
 */
export function useFileIntake(dispatch: Dispatch<AppAction>): (sheet: SheetKind, file: File) => Promise<void> {
  const tokens = useRef<Record<SheetKind, number>>({ directions: 0, reactions: 0 })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return useCallback(
    async (sheet, file) => {
      tokens.current[sheet] += 1
      const token = tokens.current[sheet]
      const isCurrent = (): boolean => mounted.current && tokens.current[sheet] === token
      try {
        const info = await inspectImageFile(file)
        if (!isCurrent()) return
        if (!info.ok) {
          dispatch({ type: 'file/rejected', sheet, message: info.message })
          return
        }
        dispatch({ type: 'file/accepted', sheet, file, previewUrl: URL.createObjectURL(file) })
      } catch {
        if (isCurrent()) dispatch({ type: 'file/rejected', sheet, message: READ_FAILED })
      }
    },
    [dispatch],
  )
}
