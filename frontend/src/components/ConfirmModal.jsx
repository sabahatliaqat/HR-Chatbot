import { createPortal } from 'react-dom'
import useBodyScrollLock from '../lib/useBodyScrollLock'

export default function ConfirmModal({ open, title, description, confirmLabel, onConfirm, onCancel, loading }) {
  useBodyScrollLock(open)

  if (!open) return null

  // Rendered via a portal straight into <body> — an ancestor page carrying
  // a completed CSS animation (even one that only ever animates opacity in
  // its source) can still leave a resolved (if identity) transform matrix
  // on itself for as long as the animation is attached, which makes that
  // ancestor a containing block for `position: fixed` descendants and
  // breaks true viewport-fixed positioning. A portal sidesteps this
  // entirely by not being a DOM descendant of any page content at all.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm backdrop-fade-in" onClick={onCancel} />
      <div className="relative bg-surface-container-lowest w-[90%] max-w-[480px] rounded-2xl shadow-2xl p-lg flex flex-col gap-6 animate-slide-up">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-error mb-2">
            <span className="material-symbols-outlined text-[32px]">warning</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
          <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
        </div>
        <div className="flex gap-4 w-full mt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-full border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-variant transition-colors duration-250 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-full bg-error text-on-error font-label-md text-label-md hover:bg-error/90 shadow-[0_8px_16px_-4px_rgba(186,26,26,0.3)] hover:-translate-y-[2px] transition-all duration-250 disabled:opacity-60"
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}