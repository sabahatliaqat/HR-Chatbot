import { useEffect, useState } from 'react'

export default function StatCard({ label, icon, iconBg, value, comingSoon, comingSoonNote }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (comingSoon || typeof value !== 'number') return
    let frame
    const duration = 600
    const start = performance.now()
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      setDisplay(Math.round(progress * value))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value, comingSoon])

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-md arcana-glow border border-surface-variant/50 relative overflow-hidden group transition-transform duration-200 ease-out hover:scale-[1.03] hover:-translate-y-0.5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/20 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
          {label}
        </h3>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      <div className="relative z-10">
        {comingSoon ? (
          <>
            <span className="font-headline-lg text-headline-lg text-on-surface-variant/40 block">—</span>
            <span className="text-sm text-outline mt-1 block">{comingSoonNote}</span>
          </>
        ) : (
          <span className="font-headline-lg text-headline-lg text-on-surface block">
            {display.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}