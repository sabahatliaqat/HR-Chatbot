import { useEffect, useState } from 'react'
import { getChecklistItems, getChecklistProgress, setChecklistProgress } from '../lib/apiClient'

export default function OnboardingChecklist({ onAsk }) {
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState({}) // { [itemId]: completed }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getChecklistItems(), getChecklistProgress()])
      .then(([itemList, progressList]) => {
        setItems(itemList)
        const map = {}
        for (const p of progressList) map[p.item_id] = p.completed
        setProgress(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const doneCount = items.filter((item) => progress[item.id]).length
  const allDone = items.length > 0 && doneCount === items.length

  async function toggle(id) {
    const next = !progress[id]
    setProgress((prev) => ({ ...prev, [id]: next })) // optimistic
    try {
      await setChecklistProgress(id, next)
    } catch {
      setProgress((prev) => ({ ...prev, [id]: !next })) // revert on failure
    }
  }

  if (loading) {
    return <p className="text-center text-on-surface-variant py-8">Loading your checklist…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-[26px]">waving_hand</span>
        </div>
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">
            {allDone ? "You're all set!" : 'Welcome — let’s get you started'}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {allDone
              ? 'You’ve completed every onboarding task. Come back anytime to review them.'
              : 'A few things to take care of in your first days. Tap "Ask" and Arch will walk you through any of them.'}
          </p>
        </div>
      </div>

      {/* Progress card */}
      <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-label-md text-[14px] font-medium text-on-surface">Your progress</h3>
          <span className="text-[12px] text-on-surface-variant">
            {doneCount} of {items.length} done
          </span>
        </div>
        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl p-5">
        <div className="flex flex-col">
          {items.map((item, i) => {
            const done = !!progress[item.id]
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 py-3 ${
                  i < items.length - 1 ? 'border-b border-surface-variant/50' : ''
                }`}
              >
                <button
                  onClick={() => toggle(item.id)}
                  aria-label={done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    done ? 'bg-primary' : 'border-[1.5px] border-outline-variant'
                  }`}
                >
                  {done && <span className="material-symbols-outlined text-[13px] text-white">check</span>}
                </button>
                <span className={`flex-1 text-[14px] ${done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                  {item.title}
                </span>
                {!done && item.suggested_question && (
                  <button
                    onClick={() => onAsk(item.suggested_question)}
                    className="border border-primary text-primary text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-primary hover:text-white transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[12px]">chat_bubble</span>
                    Ask
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
