import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  Globe,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { getCompanies, deleteCompany } from '../api'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('domain')
  const [sortOrder, setSortOrder] = useState('asc')
  const [filterSector, setFilterSector] = useState('')

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies()
      setCompanies(data)
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (domain) => {
    if (!confirm(`Delete ${domain} from results?`)) return
    
    try {
      await deleteCompany(domain)
      setCompanies(prev => prev.filter(c => c.domain !== domain))
    } catch (error) {
      console.error('Failed to delete company:', error)
    }
  }

  const sectors = [...new Set(companies.map(c => c.sector).filter(Boolean))]

  const filteredCompanies = companies
    .filter(c => {
      const matchesSearch = 
        c.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.industry || '').toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesSector = !filterSector || c.sector === filterSector
      
      return matchesSearch && matchesSector
    })
    .sort((a, b) => {
      let aVal = a[sortBy] || ''
      let bVal = b[sortBy] || ''
      
      if (sortBy === 'overall_confidence') {
        aVal = a.overall_confidence
        bVal = b.overall_confidence
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-ghost-600 border-t-ghost-300 animate-spin mx-auto" />
          <p className="mt-4 text-ghost-400">Loading companies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Companies</h1>
          <p className="text-ghost-400 mt-1">
            {companies.length} companies analyzed
          </p>
        </div>
        <Link
          to="/analyze"
          className="px-4 py-2 bg-gradient-to-r from-ghost-600 to-ghost-700 hover:from-ghost-500 hover:to-ghost-600 rounded-lg font-medium text-white transition-all inline-flex items-center gap-2"
        >
          <Building2 className="w-4 h-4" />
          Analyze New
        </Link>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ghost-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-10 pr-4 py-2 bg-ghost-900/50 border border-ghost-700 rounded-lg text-white placeholder-ghost-500 focus:outline-none focus:border-ghost-500"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="px-4 py-2 bg-ghost-900/50 border border-ghost-700 rounded-lg text-ghost-300 focus:outline-none focus:border-ghost-500"
          >
            <option value="">All Sectors</option>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredCompanies.length > 0 ? (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ghost-700/50">
                  <th className="text-left p-4">
                    <button
                      onClick={() => toggleSort('domain')}
                      className="flex items-center gap-2 text-ghost-400 hover:text-white font-medium"
                    >
                      Company
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left p-4">
                    <button
                      onClick={() => toggleSort('industry')}
                      className="flex items-center gap-2 text-ghost-400 hover:text-white font-medium"
                    >
                      Industry
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left p-4 hidden lg:table-cell">
                    <span className="text-ghost-400 font-medium">Sector</span>
                  </th>
                  <th className="text-left p-4">
                    <button
                      onClick={() => toggleSort('overall_confidence')}
                      className="flex items-center gap-2 text-ghost-400 hover:text-white font-medium"
                    >
                      Confidence
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="text-left p-4 hidden md:table-cell">
                    <span className="text-ghost-400 font-medium">SIC</span>
                  </th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr
                    key={company.domain}
                    className="border-b border-ghost-800/50 hover:bg-ghost-800/30 transition-colors"
                  >
                    <td className="p-4">
                      <Link
                        to={`/companies/${company.domain}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-ghost-700/50 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-ghost-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-ghost-300 transition-colors">
                            {company.company_name || company.domain}
                          </p>
                          <p className="text-sm text-ghost-500">{company.domain}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4">
                      {company.industry ? (
                        <span className="px-2 py-1 rounded-md bg-ghost-700/50 text-sm text-ghost-300">
                          {company.industry}
                        </span>
                      ) : (
                        <span className="text-ghost-600">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {company.sector ? (
                        <span className="text-ghost-400">{company.sector}</span>
                      ) : (
                        <span className="text-ghost-600">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-ghost-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ghost-500 rounded-full"
                            style={{ width: `${company.overall_confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-ghost-400">
                          {Math.round(company.overall_confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {company.sic_code ? (
                        <span className="font-mono text-ghost-400">{company.sic_code}</span>
                      ) : (
                        <span className="text-ghost-600">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/companies/${company.domain}`}
                          className="p-2 rounded-lg hover:bg-ghost-700/50 text-ghost-400 hover:text-white transition-colors"
                          title="View details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(company.domain)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-ghost-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto text-ghost-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No companies found</h2>
          <p className="text-ghost-400 mb-6">
            {searchQuery || filterSector
              ? 'Try adjusting your search or filters'
              : 'Start by analyzing some company domains'}
          </p>
          <Link
            to="/analyze"
            className="px-6 py-3 bg-gradient-to-r from-ghost-600 to-ghost-700 hover:from-ghost-500 hover:to-ghost-600 rounded-lg font-medium text-white transition-all inline-flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Analyze Company
          </Link>
        </div>
      )}
    </div>
  )
}
