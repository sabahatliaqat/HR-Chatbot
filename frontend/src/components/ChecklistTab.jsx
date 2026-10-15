import { useEffect, useState } from 'react'
import StatCard from './StatCard'
import ConfirmModal from './ConfirmModal'
import { getChecklistItems, createChecklistItem, deleteChecklistItem } from '../lib/apiClient'

const EMPTY_FORM = { title: '', description: '', suggestedQuestion: '' }

export default function ChecklistTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [itemToDelete, setItemToDelete] = useState(null) // { id, title } pending delete-confirmation
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    try {
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
      setLoadError(`Couldn't delete "${itemToDelete.title}". Make sure the backend is running.`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-xl">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Onboarding Checklist</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Tasks every new employee sees on their first login.
        </p>
      </header>

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

      {loadError && <p className="text-error text-[13px] -mt-4">{loadError}</p>}

      {/* Add task */}
      <section className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 p-lg flex flex-col gap-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Add a Task</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-250 outline-none"
              placeholder="Task title (required)"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <input
              className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-250 outline-none"
              placeholder="Suggested question (optional)"
              value={form.suggestedQuestion}
              onChange={(e) => setForm((f) => ({ ...f, suggestedQuestion: e.target.value }))}
            />
          </div>
          <textarea
            className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-250 outline-none resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          {saveError && <p className="text-error text-[13px]">{saveError}</p>}
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="self-start arcana-gradient-bg text-on-primary px-6 py-3 rounded-full font-label-md text-label-md shadow-[0_8px_16px_-4px_rgba(138,63,252,0.4)] hover:-translate-y-[2px] transition-all duration-250 disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add Task'}
          </button>
        </form>
      </section>

      {/* Task list */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 overflow-hidden arcana-glow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant">
                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant w-[30%]">Task</th>
                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Description</th>
                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Suggested Question</th>
                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-on-surface divide-y divide-surface-variant">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 px-6 text-center text-on-surface-variant">Loading…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-6 text-center text-on-surface-variant">
                    No tasks yet — add one above.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors duration-150">
                    <td className="py-4 px-6 font-medium">{item.title}</td>
                    <td className="py-4 px-6 text-on-surface-variant">{item.description || '—'}</td>
                    <td className="py-4 px-6 text-on-surface-variant">{item.suggested_question || '—'}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setItemToDelete({ id: item.id, title: item.title })}
                        aria-label={`Delete ${item.title}`}
                        className="p-2 text-outline hover:text-error hover:bg-error-container/50 rounded-full transition-colors duration-150"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
