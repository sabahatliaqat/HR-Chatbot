import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import StatCard from './StatCard'
import { getAnalyticsSummary } from '../lib/apiClient'

const PRIMARY = '#7015e2'
const PRIMARY_LIGHT = '#8a3ffc'
const AMBER = '#f59e0b'
const GRID = '#e2e2e7' // surface-variant — hairline, recessive
const AXIS_TEXT = '#4b4455' // on-surface-variant

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-surface-container-lowest border border-surface-variant rounded-xl px-3 py-2 shadow-lg text-[12px]">
      <p className="text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-on-surface font-medium">{payload[0].value.toLocaleString()} questions</p>
    </div>
  )
}

function DocTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-surface-container-lowest border border-surface-variant rounded-xl px-3 py-2 shadow-lg text-[12px]">
      <p className="text-on-surface-variant mb-0.5">{payload[0].payload.document}</p>
      <p className="text-on-surface font-medium">{payload[0].value.toLocaleString()} citations</p>
    </div>
  )
}

export default function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAnalyticsSummary()
      .then(setData)
      .catch((e) => setError(e.message || 'Could not load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-center text-on-surface-variant py-12">Loading analytics…</p>
  }

  if (error || !data) {
    return <p className="text-center text-error py-12">{error || 'Could not load analytics.'}</p>
  }

  const weekTotal = data.questions_last_7_days.reduce((sum, d) => sum + d.count, 0)
  const chartData = data.questions_last_7_days.map((d) => ({ ...d, label: formatDayLabel(d.date) }))
  const hasDocData = data.most_cited_documents.length > 0

  const answeredData = [
    { name: 'Answered', value: data.answered_count },
    { name: 'Not found', value: data.not_found_count },
  ].filter((d) => d.value > 0)
  const hasAnsweredData = data.answered_count + data.not_found_count > 0

  const gaugeData = [{ name: 'Completed', value: data.checklist_completion_rate, fill: PRIMARY }]

  return (
    <div className="flex flex-col gap-xl">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Analytics</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Usage across Arch Assistant.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <StatCard
          label="Total Questions"
          icon="forum"
          iconBg="bg-primary-container text-primary"
          value={data.total_questions}
        />
        <StatCard
          label="Questions This Week"
          icon="calendar_month"
          iconBg="bg-secondary-container text-on-secondary-container"
          value={weekTotal}
        />
        <StatCard
          label="Registered Employees"
          icon="groups"
          iconBg="bg-surface-variant text-on-surface-variant"
          value={data.total_employees}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 p-6">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Questions — last 7 days</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY_LIGHT} />
                  <stop offset="100%" stopColor={PRIMARY} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip cursor={{ fill: 'rgba(112,21,226,0.06)' }} content={<BarTooltip />} />
              <Bar
                dataKey="count"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 p-6">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Most-cited documents</h2>
          {hasDocData ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.most_cited_documents}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barGradientH" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={PRIMARY} />
                    <stop offset="100%" stopColor={PRIMARY_LIGHT} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="document"
                  tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                  tickFormatter={(v) => (v.length > 18 ? v.slice(0, 17) + '…' : v)}
                />
                <Tooltip cursor={{ fill: 'rgba(112,21,226,0.06)' }} content={<DocTooltip />} />
                <Bar
                  dataKey="count"
                  fill="url(#barGradientH)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-on-surface-variant text-[14px] py-12 text-center">
              No questions answered from a document yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 p-6">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Answered vs. not found</h2>
          <p className="text-[12px] text-on-surface-variant mb-2">How often Arch finds an answer in the documents.</p>
          {hasAnsweredData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={answeredData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={answeredData.length > 1 ? 3 : 0}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {answeredData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === 'Answered' ? PRIMARY : AMBER}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload && payload.length ? (
                      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl px-3 py-2 shadow-lg text-[12px]">
                        <p className="text-on-surface font-medium">
                          {payload[0].name}: {payload[0].value.toLocaleString()}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value) => <span className="text-[12px] text-on-surface-variant">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-on-surface-variant text-[14px] py-12 text-center">No questions asked yet.</p>
          )}
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/50 p-6">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Onboarding checklist completion</h2>
          <p className="text-[12px] text-on-surface-variant mb-2">Average across all employees.</p>
          <ResponsiveContainer width="100%" height={240}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              barSize={18}
              data={gaugeData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={9}
                background={{ fill: GRID }}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-on-surface"
                style={{ fontSize: 28, fontWeight: 700 }}
              >
                {data.checklist_completion_rate}%
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
