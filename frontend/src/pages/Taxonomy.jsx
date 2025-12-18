import { useState, useEffect } from 'react'
import {
  Tags,
  Search,
  Building2,
  ChevronRight,
  ChevronDown,
  Hash,
} from 'lucide-react'
import { getTaxonomy, searchTaxonomy } from '../api'

function SectorGroup({ sector, industries, expanded, onToggle, searchQuery }) {
  const industryGroups = industries.reduce((acc, item) => {
    if (!acc[item.industry]) {
      acc[item.industry] = []
    }
    acc[item.industry].push(item)
    return acc
  }, {})

  // Helper to highlight matching text
  const highlightMatch = (text, query) => {
    if (!query || query.length < 1) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</mark> : part
    )
  }

  return (
    <div className="border border-ghost-700/50 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-ghost-800/30 hover:bg-ghost-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ghost-600/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-ghost-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-white">{highlightMatch(sector, searchQuery)}</p>
            <p className="text-sm text-ghost-400">{industries.length} SIC codes</p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-ghost-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-ghost-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {Object.entries(industryGroups).map(([industry, items]) => (
            <div key={industry}>
              <h4 className="font-medium text-ghost-300 mb-2">{highlightMatch(industry, searchQuery)}</h4>
              <div className="grid gap-2">
                {items.map((item) => (
                  <div
                    key={item.sic_code}
                    className="p-3 rounded-lg bg-ghost-900/50 flex items-start gap-3 hover:bg-ghost-800/50 transition-colors"
                  >
                    <span className="font-mono text-ghost-400 text-sm bg-ghost-800 px-2 py-0.5 rounded">
                      {highlightMatch(item.sic_code, searchQuery)}
                    </span>
                    <div className="flex-1">
                      <p className="text-ghost-200">{highlightMatch(item.sic_description, searchQuery)}</p>
                      <p className="text-sm text-ghost-500 mt-1">
                        {highlightMatch(item.sub_industry, searchQuery)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Taxonomy() {
  const [taxonomy, setTaxonomy] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [expandedSectors, setExpandedSectors] = useState(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getTaxonomy()
        setTaxonomy(data)
      } catch (error) {
        console.error('Failed to fetch taxonomy:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    async function search() {
      if (searchQuery.length < 1) {
        setSearchResults(null)
        return
      }

      try {
        const results = await searchTaxonomy(searchQuery)
        setSearchResults(results)
        // Auto-expand all sectors when searching
        if (results.length > 0) {
          const sectors = new Set(results.map(r => r.sector))
          setExpandedSectors(sectors)
        }
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResults([])
      }
    }

    const timeout = setTimeout(search, 200)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const toggleSector = (sector) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev)
      if (next.has(sector)) {
        next.delete(sector)
      } else {
        next.add(sector)
      }
      return next
    })
  }

  // Group by sector
  const sectorGroups = (searchResults || taxonomy).reduce((acc, item) => {
    if (!acc[item.sector]) {
      acc[item.sector] = []
    }
    acc[item.sector].push(item)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-ghost-600 border-t-ghost-300 animate-spin mx-auto" />
          <p className="mt-4 text-ghost-400">Loading taxonomy...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">SIC Taxonomy</h1>
        <p className="text-ghost-400 mt-1">
          Standard Industrial Classification codes used for deterministic industry classification
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{taxonomy.length}</p>
          <p className="text-sm text-ghost-400">Total SIC Codes</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-white">
            {Object.keys(sectorGroups).length}
          </p>
          <p className="text-sm text-ghost-400">Sectors</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-white">
            {[...new Set(taxonomy.map((t) => t.industry))].length}
          </p>
          <p className="text-sm text-ghost-400">Industries</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-white">
            {[...new Set(taxonomy.map((t) => t.sub_industry))].length}
          </p>
          <p className="text-sm text-ghost-400">Sub-Industries</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ghost-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SIC code, industry, sector, or keyword (e.g., 'tech', '7372', 'banking')..."
            className="w-full pl-12 pr-4 py-3 bg-ghost-900/50 border border-ghost-700 rounded-xl text-white placeholder-ghost-500 focus:outline-none focus:border-ghost-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ghost-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        {searchResults !== null && (
          <p className="mt-2 text-sm text-ghost-400">
            {searchResults.length > 0 
              ? `Found ${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`
              : `No results found for "${searchQuery}". Try searching for: tech, finance, health, retail, manufacturing...`
            }
          </p>
        )}
        {!searchQuery && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-ghost-500">Quick search:</span>
            {['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', '7372'].map(term => (
              <button
                key={term}
                onClick={() => setSearchQuery(term)}
                className="px-2 py-1 text-xs bg-ghost-800/50 hover:bg-ghost-700 text-ghost-400 hover:text-white rounded transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Taxonomy List */}
      <div className="space-y-4">
        {Object.entries(sectorGroups).map(([sector, items]) => (
          <SectorGroup
            key={sector}
            sector={sector}
            industries={items}
            expanded={expandedSectors.has(sector) || searchResults !== null}
            onToggle={() => toggleSector(sector)}
            searchQuery={searchQuery}
          />
        ))}

        {Object.keys(sectorGroups).length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <Tags className="w-16 h-16 mx-auto text-ghost-600 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No results found</h2>
            <p className="text-ghost-400">
              Try a different search term
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="glass-light rounded-xl p-6">
        <h3 className="font-medium text-white mb-3">About SIC Classification</h3>
        <p className="text-ghost-400 text-sm leading-relaxed">
          The Standard Industrial Classification (SIC) is a system for classifying industries by
          a four-digit code. GhostIntel uses SIC codes to provide deterministic, auditable industry
          classification without relying on opaque AI systems. All industry, sub-industry, and sector
          labels are derived exclusively through taxonomy lookup based on assigned SIC codes.
        </p>
      </div>
    </div>
  )
}
