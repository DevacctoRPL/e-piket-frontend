import { useCallback, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'

/**
 * StatCard merender <a href> biasa. Handler klik terdelegasi ini mengubah klik kiri biasa pada
 * tautan internal menjadi navigasi SPA (tanpa reload), sambil tetap mempertahankan perilaku
 * tautan asli (Ctrl/⌘-klik, klik tengah, buka di tab baru).
 */
export function useSpaLinks() {
  const navigate = useNavigate()
  return useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('/') || href.startsWith('//')) return
      e.preventDefault()
      void navigate(href)
    },
    [navigate],
  )
}
