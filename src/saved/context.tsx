import { createContext, useContext, type ReactNode } from 'react'
import { sharedSavedStore } from './store'
import type { SavedStoreHandle } from './types'

const SavedStoreContext = createContext<Promise<SavedStoreHandle> | null>(null)

/** Tests (and nothing else) pass a store in; the app uses the shared one. */
export function SavedStoreProvider({ value, children }: { value: Promise<SavedStoreHandle>; children: ReactNode }) {
  return <SavedStoreContext.Provider value={value}>{children}</SavedStoreContext.Provider>
}

export function useSavedStoreHandle(): Promise<SavedStoreHandle> {
  return useContext(SavedStoreContext) ?? sharedSavedStore()
}
