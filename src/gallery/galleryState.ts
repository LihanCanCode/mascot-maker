import { findMascot } from './mascots'

export type GalleryState =
  | { readonly view: 'grid' }
  | { readonly view: 'detail'; readonly slug: string }
  | { readonly view: 'use'; readonly slug: string }

export type GalleryAction =
  | { readonly type: 'open'; readonly slug: string }
  | { readonly type: 'use' }
  | { readonly type: 'back' }
  | { readonly type: 'close' }

export const initialGallery: GalleryState = { view: 'grid' }

/** grid -> detail -> use. Invalid transitions return the same state reference. */
export function galleryReducer(state: GalleryState, action: GalleryAction): GalleryState {
  switch (action.type) {
    case 'open':
      if (state.view === 'use' || findMascot(action.slug) === undefined) return state
      return { view: 'detail', slug: action.slug }
    case 'use':
      return state.view === 'detail' ? { view: 'use', slug: state.slug } : state
    case 'back':
      if (state.view === 'use') return { view: 'detail', slug: state.slug }
      return state.view === 'detail' ? initialGallery : state
    case 'close':
      return state.view === 'grid' ? state : initialGallery
  }
}
