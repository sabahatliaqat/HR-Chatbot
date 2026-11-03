import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import useBodyScrollLock from '../lib/useBodyScrollLock'

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}) {
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return

    function handleEscape(event) {
      if (event.key === 'Escape' && !loading) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, loading, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Modal backdrop */}
      <div
        className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm backdrop-fade-in"
        onClick={!loading ? onCancel : undefined}
        aria-hidden="true"
      />

      {/* Confirmation dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        className="relative bg-surface-container-lowest border border-outline-variant/50 w-[90%] max-w-[480px] rounded-2xl shadow-2xl p-lg flex flex-col gap-6 animate-slide-up"
      >
        {/* Icon and Message */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-error mb-2">
            <span className="material-symbols-outlined text-[32px]">
              warning
            </span>
          </div>

          <h3
            id="confirm-modal-title"
            className="font-headline-sm text-headline-sm text-on-surface"
          >
            {title}
          </h3>

          <p
            id="confirm-modal-description"
            className="font-body-md text-body-md text-on-surface-variant"
          >
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full mt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-full border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors duration-250 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-full bg-error text-on-error font-label-md text-label-md hover:bg-error/90 shadow-[0_8px_16px_-4px_rgba(186,26,26,0.3)] hover:-translate-y-[2px] transition-all duration-250 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}