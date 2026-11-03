import { useEffect, useState } from 'react'
import StatCard from './StatCard'
import ConfirmModal from './ConfirmModal'
import {
  getChecklistItems,
  createChecklistItem,
  deleteChecklistItem,
} from '../lib/apiClient'

const EMPTY_FORM = {
  title: '',
  description: '',
  suggestedQuestion: '',
}

const inputStyles =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/70 font-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-250 outline-none'

export default function ChecklistTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [itemToDelete, setItemToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    try {
      setLoadError('')
      setItems(await getChecklistItems())
    } catch {
      setLoadError("Couldn't load the checklist from the backend.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()

    if (!form.title.trim()) return

    setSaving(true)
    setSaveError('')

    try {
      await createChecklistItem(form)
      setForm(EMPTY_FORM)
      await refresh()
    } catch (err) {
      setSaveError(err.message || 'Could not add task.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) return

    setDeleting(true)

    try {
      await deleteChecklistItem(itemToDelete.id)
      await refresh()
      setItemToDelete(null)
    } catch {
      setLoadError(
        `Couldn't delete "${itemToDelete.title}". Make sure the backend is running.`
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-xl">
      {/* Page Heading */}
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">
          Onboarding Checklist
        </h1>

        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Tasks every new employee sees on their first login.
        </p>
      </header>

      {/* Statistics */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <StatCard
          label="Total Tasks"
          icon="checklist"
          iconBg="bg-primary-container text-primary"
          value={items.length}
        />

        <StatCard
          label="With Suggested Question"
          icon="chat_bubble"
          iconBg="bg-secondary-container text-on-secondary-container"
          value={items.filter((i) => i.suggested_question).length}
        />
      </section>

      {/* Error Message */}
      {loadError && (
        <p
          role="alert"
          className="text-error text-[13px] -mt-4 bg-error-container/20 border border-error/20 rounded-lg px-3 py-2"
        >
          {loadError}
        </p>
      )}

      {/* Add Task Form */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/50 p-lg flex flex-col gap-4 shadow-sm">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Add a Task
          </h2>

          <p className="text-sm text-on-surface-variant mt-1">
            Create a new onboarding task for employees.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className={inputStyles}
              placeholder="Task title (required)"
              aria-label="Task title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />

            <input
              className={inputStyles}
              placeholder="Suggested question (optional)"
              aria-label="Suggested question"
              value={form.suggestedQuestion}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  suggestedQuestion: e.target.value,
                }))
              }
            />
          </div>

          <textarea
            className={`${inputStyles} resize-none`}
            placeholder="Description (optional)"
            aria-label="Task description"
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />

          {saveError && (
            <p role="alert" className="text-error text-[13px]">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="self-start arcana-gradient-bg text-on-primary px-6 py-3 rounded-full font-label-md text-label-md shadow-[0_8px_16px_-4px_rgba(138,63,252,0.4)] hover:-translate-y-[2px] transition-all duration-250 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {saving ? 'Adding…' : 'Add Task'}
          </button>
        </form>
      </section>

      {/* Task List */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/50 overflow-hidden arcana-glow">
        <div className="px-5 py-4 border-b border-outline-variant/50">
          <h2 className="font-headline-sm text-on-surface">
            Existing Tasks
          </h2>

          <p className="text-sm text-on-surface-variant mt-1">
            Manage the tasks displayed to new employees.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant w-[25%]">
                  Task
                </th>

                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">
                  Description
                </th>

                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">
                  Suggested Question
                </th>

                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="font-body-md text-on-surface divide-y divide-outline-variant/50">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 px-6 text-center text-on-surface-variant"
                  >
                    Loading tasks…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 px-6 text-center text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-3xl block mb-2">
                      checklist
                    </span>
                    No tasks yet — add one above.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-container-low/70 transition-colors duration-150"
                  >
                    <td className="py-4 px-6 font-medium text-on-surface">
                      {item.title}
                    </td>

                    <td className="py-4 px-6 text-on-surface-variant">
                      {item.description || '—'}
                    </td>

                    <td className="py-4 px-6 text-on-surface-variant">
                      {item.suggested_question || '—'}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({
                            id: item.id,
                            title: item.title,
                          })
                        }
                        aria-label={`Delete ${item.title}`}
                        title="Delete task"
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!itemToDelete}
        title="Delete this task?"
        description={
          itemToDelete
            ? `"${itemToDelete.title}" will be removed for everyone, including any employee progress already recorded against it. This cannot be undone.`
            : ''
        }
        confirmLabel="Yes, Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
        loading={deleting}
      />
    </div>
  )
}