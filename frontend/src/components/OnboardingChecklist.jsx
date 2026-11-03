import { useEffect, useState } from 'react'
import {
  getChecklistItems,
  getChecklistProgress,
  setChecklistProgress,
} from '../lib/apiClient'

export default function OnboardingChecklist({ onAsk }) {
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getChecklistItems(), getChecklistProgress()])
      .then(([itemList, progressList]) => {
        setItems(itemList)

        const map = {}

        for (const p of progressList) {
          map[p.item_id] = p.completed
        }

        setProgress(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const doneCount = items.filter((item) => progress[item.id]).length
  const allDone = items.length > 0 && doneCount === items.length

  async function toggle(id) {
    const next = !progress[id]

    setProgress((prev) => ({
      ...prev,
      [id]: next,
    }))

    try {
      await setChecklistProgress(id, next)
    } catch {
      setProgress((prev) => ({
        ...prev,
        [id]: !next,
      }))
    }
  }

  if (loading) {
    return (
      <p className="text-center text-on-surface-variant py-8">
        Loading your checklist…
      </p>
    )
  }

  const completionPercentage = items.length
    ? (doneCount / items.length) * 100
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-[26px]">
            waving_hand
          </span>
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">
            {allDone
              ? "You're all set!"
              : 'Welcome — let’s get you started'}
          </h2>

          <p className="font-body-md text-body-md text-on-surface-variant">
            {allDone
              ? 'You’ve completed every onboarding task. Come back anytime to review them.'
              : 'A few things to take care of in your first days. Tap "Ask" and Arch will walk you through any of them.'}
          </p>
        </div>
      </div>

      {/* Progress Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="font-label-md text-[14px] font-medium text-on-surface">
            Your progress
          </h3>

          <span className="text-[12px] text-on-surface-variant tabular-nums">
            {doneCount} of {items.length} done
          </span>
        </div>

        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {allDone && (
          <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300 mt-3">
            <span className="material-symbols-outlined text-[18px]">
              check_circle
            </span>
            All onboarding tasks completed!
          </p>
        )}
      </div>

      {/* Task List */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm">
        <h3 className="font-label-md text-[14px] font-medium text-on-surface mb-2">
          Onboarding tasks
        </h3>

        {items.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl block mb-2">
              checklist
            </span>
            No onboarding tasks available yet.
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((item, i) => {
              const done = !!progress[item.id]

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 py-3 ${
                    i < items.length - 1
                      ? 'border-b border-outline-variant/50'
                      : ''
                  }`}
                >
                  {/* Completion Toggle */}
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-label={
                      done
                        ? `Mark "${item.title}" as not done`
                        : `Mark "${item.title}" as done`
                    }
                    aria-pressed={done}
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                      done
                        ? 'bg-primary text-white'
                        : 'border-2 border-outline-variant hover:border-primary hover:bg-primary-container/20'
                    }`}
                  >
                    {done && (
                      <span className="material-symbols-outlined text-[15px]">
                        check
                      </span>
                    )}
                  </button>

                  {/* Task Title */}
                  <span
                    className={`flex-1 text-[14px] min-w-0 ${
                      done
                        ? 'text-on-surface-variant line-through'
                        : 'text-on-surface'
                    }`}
                  >
                    {item.title}
                  </span>

                  {/* Ask Arch */}
                  {!done && item.suggested_question && (
                    <button
                      type="button"
                      onClick={() => onAsk(item.suggested_question)}
                      className="border border-primary text-primary text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary hover:text-white transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        chat_bubble
                      </span>
                      Ask
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}