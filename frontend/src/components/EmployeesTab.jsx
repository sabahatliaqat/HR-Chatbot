import { useEffect, useState } from 'react'
import StatCard from './StatCard'
import EmployeeChatModal from './EmployeeChatModal'
import { getEmployees } from '../lib/apiClient'

function initials(email) {
  const name = email.split('@')[0].replace(/[._]/g, ' ')

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export default function EmployeesTab() {
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewingEmail, setViewingEmail] = useState(null)

  useEffect(() => {
    getEmployees()
      .then(setEmployees)
      .catch((e) => setError(e.message || 'Could not load employees.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <p className="text-center text-on-surface-variant">
          Loading employees…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-error-container/30 border border-error/30 rounded-2xl p-6 text-center">
        <span className="material-symbols-outlined text-error text-3xl mb-2">
          error
        </span>
        <p className="text-error">{error}</p>
      </div>
    )
  }

  const fullyOnboarded = employees.filter(
    (e) =>
      e.total_items > 0 &&
      e.completed_items === e.total_items
  ).length

  return (
    <div className="flex flex-col gap-xl">
      {/* Header */}
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">
          Employees
        </h1>

        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Roster and onboarding progress.
        </p>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <StatCard
          label="Total Employees"
          icon="groups"
          iconBg="bg-primary-container text-primary"
          value={employees.length}
        />

        <StatCard
          label="Fully Onboarded"
          icon="task_alt"
          iconBg="bg-secondary-container text-on-secondary-container"
          value={fullyOnboarded}
        />
      </section>

      {/* Employees Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/50 overflow-hidden arcana-glow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">
                  Employee
                </th>

                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant w-[40%]">
                  Onboarding progress
                </th>

                <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="font-body-md text-on-surface divide-y divide-outline-variant/60">
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-10 px-6 text-center text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-3xl block mb-2">
                      group_off
                    </span>
                    No employees registered yet.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const pct = emp.total_items
                    ? Math.round(
                        (emp.completed_items / emp.total_items) * 100
                      )
                    : 0

                  return (
                    <tr
                      key={emp.email}
                      className="hover:bg-surface-container-low/70 transition-colors duration-150"
                    >
                      {/* Employee */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-[12px] flex-shrink-0">
                            {initials(emp.email)}
                          </div>

                          <p className="font-medium break-all">
                            {emp.email}
                          </p>
                        </div>
                      </td>

                      {/* Onboarding Progress */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <span className="text-[12px] text-on-surface-variant w-20 text-right flex-shrink-0 tabular-nums">
                            {emp.completed_items}/{emp.total_items} done
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setViewingEmail(emp.email)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary-container/20 transition-all duration-200 text-[12px] font-label-md whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            forum
                          </span>
                          View Chats
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Chat Modal */}
      <EmployeeChatModal
        email={viewingEmail}
        onClose={() => setViewingEmail(null)}
      />
    </div>
  )
}