import { useEffect } from 'react'

// Prevents the page behind a modal from scrolling while it's open — without
// this, scrolling inside a modal's own content can "chain" to the page once
// it hits the top/bottom of its own scroll range, which visually looks like
// the modal itself is moving (it's actually the page moving underneath it).
export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return
    // The actual scrolling element in standards mode is <html>
    // (document.documentElement), not <body> — locking only body.overflow
    // measurably did nothing (verified: window.scrollY still changed with
    // it set) because <html> was still free to scroll.
    const html = document.documentElement
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [active])
}
