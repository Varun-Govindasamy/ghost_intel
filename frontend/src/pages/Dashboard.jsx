import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  TrendingUp,
  Network,
  Cpu,
  ArrowRight,
  Sparkles,
  BarChart3,
  Globe,
} from 'lucide-react'
import { getAnalyticsSummary, getCompanies } from '../api'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

const COLORS = ['#ef4444', '#f87171', '#fca5a5', '#dc2626', '#b91c1c', '#fee2e2']

function StatCard({ icon: Icon, title, value, subtitle, color = 'ghost' }) {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl bg-${color}-600/20 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
        <Sparkles className="w-5 h-5 text-ghost-500 opacity-50" />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-sm text-ghost-400 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-ghost-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function RecentCompanies({ companies }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Recent Companies</h2>
        <Link to="/companies" className="text-sm text-ghost-400 hover:text-ghost-300 flex items-center gap-1">
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="space-y-3">
        {companies.slice(0, 5).map((company) => (
          <Link
            key={company.domain}
            to={`/companies/${company.domain}`}
            className="block p-4 rounded-xl bg-ghost-900/30 hover:bg-ghost-800/40 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-ghost-600/30 flex items-center justify-center">
                <Globe className="w-5 h-5 text-ghost-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {company.company_name || company.domain}
                </p>
                <p className="text-sm text-ghost-400 truncate">{company.domain}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-ghost-300">
                  {Math.round(company.overall_confidence * 100)}%
                </div>
                <div className="text-xs text-ghost-500">confidence</div>
              </div>
            </div>
            {company.industry && (
              <div className="mt-3 flex items-center gap-2">
                <span className="px-2 py-1 rounded-md bg-ghost-700/50 text-xs text-ghost-300">
                  {company.industry}
                </span>
                {company.sector && (
                  <span className="px-2 py-1 rounded-md bg-ghost-800/50 text-xs text-ghost-400">
                    {company.sector}
                  </span>
                )}
              </div>
            )}
          </Link>
        ))}
        {companies.length === 0 && (
          <div className="text-center py-8 text-ghost-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No companies analyzed yet</p>
            <Link to="/analyze" className="text-ghost-400 hover:text-ghost-300 text-sm mt-2 inline-block">
              Start analyzing →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [analyticsData, companiesData] = await Promise.all([
          getAnalyticsSummary(),
          getCompanies(),
        ])
        setAnalytics(analyticsData)
        setCompanies(companiesData)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const industryData = analytics?.industry_distribution
    ? Object.entries(analytics.industry_distribution).map(([name, value]) => ({ name, value }))
    : []

  const techData = analytics?.technology_trends
    ? Object.entries(analytics.technology_trends).slice(0, 8).map(([name, value]) => ({ name, value }))
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-ghost-600 border-t-ghost-300 animate-spin mx-auto" />
          <p className="mt-4 text-ghost-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-ghost-400 mt-2">
          Overview of your company intelligence data
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Building2}
          title="Companies Analyzed"
          value={analytics?.total_companies || 0}
        />
        <StatCard
          icon={TrendingUp}
          title="Classification Rate"
          value={`${Math.round((analytics?.classification_rate || 0) * 100)}%`}
          subtitle="SIC codes assigned"
        />
        <StatCard
          icon={BarChart3}
          title="Avg. Confidence"
          value={`${Math.round((analytics?.average_confidence || 0) * 100)}%`}
        />
        <StatCard
          icon={Network}
          title="Graph Nodes"
          value={analytics?.graph_statistics?.total_nodes || 0}
          subtitle={`${analytics?.graph_statistics?.total_edges || 0} relationships`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Distribution */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Industry Distribution</h2>
          {industryData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={industryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {industryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#000000',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-ghost-500">
              No industry data available
            </div>
          )}
          {industryData.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {industryData.slice(0, 4).map((item, index) => (
                <span
                  key={item.name}
                  className="px-2 py-1 rounded-md text-xs"
                  style={{ backgroundColor: `${COLORS[index % COLORS.length]}30`, color: COLORS[index % COLORS.length] }}
                >
                  {item.name}: {item.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Technology Trends */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Technology Trends</h2>
          {techData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techData} layout="vertical">
                  <XAxis type="number" stroke="#ef4444" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#fca5a5" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#000000',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-ghost-500">
              <div className="text-center">
                <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No technology data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Companies */}
      <RecentCompanies companies={companies} />

      {/* Quick Actions */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/analyze"
            className="p-4 rounded-xl bg-gradient-to-r from-ghost-600 to-ghost-700 hover:from-ghost-500 hover:to-ghost-600 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Analyze Company</p>
                <p className="text-sm text-ghost-200">Extract intelligence from a domain</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white ml-auto transition-colors" />
            </div>
          </Link>

          <Link
            to="/graph"
            className="p-4 rounded-xl bg-ghost-800/50 hover:bg-ghost-700/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ghost-600/30 flex items-center justify-center">
                <Network className="w-5 h-5 text-ghost-400" />
              </div>
              <div>
                <p className="font-medium text-white">View Graph</p>
                <p className="text-sm text-ghost-400">Explore knowledge relationships</p>
              </div>
              <ArrowRight className="w-5 h-5 text-ghost-500 group-hover:text-ghost-300 ml-auto transition-colors" />
            </div>
          </Link>

          <Link
            to="/taxonomy"
            className="p-4 rounded-xl bg-ghost-800/50 hover:bg-ghost-700/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ghost-600/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-ghost-400" />
              </div>
              <div>
                <p className="font-medium text-white">Browse Taxonomy</p>
                <p className="text-sm text-ghost-400">Explore SIC classifications</p>
              </div>
              <ArrowRight className="w-5 h-5 text-ghost-500 group-hover:text-ghost-300 ml-auto transition-colors" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
