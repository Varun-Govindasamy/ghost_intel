import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Globe,
  Building2,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  Tag,
  Cpu,
  Package,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Network,
  BarChart3,
  Download,
} from 'lucide-react'
import { getCompany, getCompanyGraph, getSimilarCompanies } from '../api'

function InfoCard({ icon: Icon, label, value, link }) {
  if (!value) return null
  
  const content = (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-ghost-700/50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-ghost-400" />
      </div>
      <div>
        <p className="text-xs text-ghost-500 uppercase tracking-wide">{label}</p>
        <p className="text-ghost-200 mt-1">{value}</p>
      </div>
    </div>
  )
  
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="block hover:bg-ghost-800/30 rounded-lg p-3 -m-3 transition-colors">
        {content}
      </a>
    )
  }
  
  return content
}

function ConfidenceBadge({ value }) {
  const percentage = Math.round(value * 100)
  let color = 'ghost'
  if (percentage >= 80) color = 'green'
  else if (percentage >= 60) color = 'yellow'
  else if (percentage >= 40) color = 'orange'
  else color = 'red'
  
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    ghost: 'bg-ghost-600/20 text-ghost-400 border-ghost-500/30',
  }
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${colorClasses[color]}`}>
      {percentage}% confidence
    </span>
  )
}

export default function CompanyDetail() {
  const { domain } = useParams()
  const [company, setCompany] = useState(null)
  const [graph, setGraph] = useState(null)
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    async function fetchData() {
      try {
        const [companyData, graphData, similarData] = await Promise.all([
          getCompany(domain),
          getCompanyGraph(domain),
          getSimilarCompanies(domain),
        ])
        setCompany(companyData)
        setGraph(graphData)
        setSimilar(similarData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [domain])

  // Download CSV for single company
  const downloadCSV = () => {
    if (!company) return

    const headers = [
      'Domain',
      'Company Name',
      'Long Description',
      'Short Description',
      'SIC Code',
      'SIC Text',
      'Sub Industry',
      'Industry',
      'Sector',
      'Tags',
      'Full Address',
      'Phone',
      'Email',
      'Hours of Operation',
      'HQ Indicator',
      'Logo URL',
      'LinkedIn',
      'Facebook',
      'Instagram',
      'X (Twitter)',
      'YouTube',
      'Blog',
      'People Name',
      'People Title',
      'Certifications'
    ]

    const na = (value) => value || 'Not Available'

    const tags = company.tags?.join('; ') || company.keywords?.join('; ') || ''
    const longDesc = company.long_description || company.description || ''
    const shortDesc = company.short_description || company.tagline || ''
    const social = company.social_media || company.social_links || {}
    const people = company.people || []
    const peopleNames = people.map(p => typeof p === 'object' ? p.name : p).filter(Boolean).join('; ')
    const peopleTitles = people.map(p => typeof p === 'object' ? p.title || p.role || p.position : '').filter(Boolean).join('; ')
    const certs = company.certifications || []
    const certsStr = Array.isArray(certs) ? certs.join('; ') : certs

    const row = [
      na(company.domain),
      na(company.company_name || company.name),
      na(longDesc),
      na(shortDesc),
      na(company.sic_code),
      na(company.sic_text || company.sic_description),
      na(company.sub_industry),
      na(company.industry),
      na(company.sector),
      na(tags),
      na(company.full_address || company.address || company.headquarters),
      na(company.phone || company.phone_number),
      na(company.email || company.contact_email),
      na(company.hours_of_operation || company.business_hours),
      na(company.hq_indicator || company.is_headquarters),
      na(company.logo_url || company.logo),
      na(social.linkedin || company.linkedin),
      na(social.facebook || company.facebook),
      na(social.instagram || company.instagram),
      na(social.twitter || social.x || company.twitter || company.x),
      na(social.youtube || company.youtube),
      na(social.blog || company.blog || company.blog_url),
      na(peopleNames),
      na(peopleTitles),
      na(certsStr)
    ]

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvContent = [
      headers.join(','),
      row.map(escapeCSV).join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ghostintel_${company.domain}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-ghost-600 border-t-ghost-300 animate-spin mx-auto" />
          <p className="mt-4 text-ghost-400">Loading company data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Company not found</h2>
        <p className="text-ghost-400 mb-6">{error}</p>
        <Link
          to="/companies"
          className="px-6 py-3 bg-ghost-700 hover:bg-ghost-600 rounded-lg font-medium text-white transition-all inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Companies
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/companies"
        className="inline-flex items-center gap-2 text-ghost-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Companies
      </Link>

      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ghost-500 to-ghost-700 flex items-center justify-center">
            <Globe className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {company.company_name || company.domain}
                </h1>
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ghost-400 hover:text-ghost-300 flex items-center gap-1 mt-1"
                >
                  {company.domain}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <ConfidenceBadge value={company.overall_confidence} />
            </div>
            {company.short_description && (
              <p className="text-ghost-300 mt-4 max-w-2xl">{company.short_description}</p>
            )}
            <button
              onClick={downloadCSV}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-ghost-700 hover:bg-ghost-600 rounded-lg text-white transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </div>

        {/* Industry badges */}
        <div className="flex flex-wrap gap-2 mt-6">
          {company.sic_code && (
            <span className="px-3 py-1 rounded-lg bg-ghost-600/30 text-ghost-300 text-sm font-mono">
              SIC: {company.sic_code}
            </span>
          )}
          {company.sector && (
            <span className="px-3 py-1 rounded-lg bg-ghost-700/50 text-ghost-300 text-sm">
              {company.sector}
            </span>
          )}
          {company.industry && (
            <span className="px-3 py-1 rounded-lg bg-ghost-700/50 text-ghost-300 text-sm">
              {company.industry}
            </span>
          )}
          {company.sub_industry && (
            <span className="px-3 py-1 rounded-lg bg-ghost-800/50 text-ghost-400 text-sm">
              {company.sub_industry}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ghost-800">
        {['overview', 'technologies', 'products', 'people', 'graph'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-white border-ghost-500'
                : 'text-ghost-400 border-transparent hover:text-ghost-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {company.long_description && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">About</h2>
                <p className="text-ghost-300 leading-relaxed">{company.long_description}</p>
              </div>
            )}

            {/* Signals */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Signals</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-ghost-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-ghost-400" />
                    <span className="text-sm text-ghost-400">Pages Analyzed</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{company.pages_analyzed}</p>
                </div>
                <div className="p-4 rounded-xl bg-ghost-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-ghost-400" />
                    <span className="text-sm text-ghost-400">Hiring</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {company.is_hiring ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-ghost-500">No signal</span>
                    )}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-ghost-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-ghost-400" />
                    <span className="text-sm text-ghost-400">Careers Page</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {company.has_careers_page ? (
                      <span className="text-green-400">Found</span>
                    ) : (
                      <span className="text-ghost-500">Not found</span>
                    )}
                  </p>
                </div>
                {company.founding_year && (
                  <div className="p-4 rounded-xl bg-ghost-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-ghost-400" />
                      <span className="text-sm text-ghost-400">Founded</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{company.founding_year}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {company.tags.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-ghost-400" />
                  Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {company.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-lg bg-ghost-700/50 text-ghost-300 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">Contact</h2>
              <InfoCard icon={Mail} label="Email" value={company.email} link={company.email ? `mailto:${company.email}` : null} />
              <InfoCard icon={Phone} label="Phone" value={company.phone} />
              {company.locations.length > 0 && (
                <InfoCard
                  icon={MapPin}
                  label="Location"
                  value={[
                    company.locations[0].city,
                    company.locations[0].state,
                    company.locations[0].country,
                  ].filter(Boolean).join(', ')}
                />
              )}
            </div>

            {/* Social Links */}
            {Object.keys(company.social_links).length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Social Links</h2>
                <div className="space-y-2">
                  {Object.entries(company.social_links).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ghost-800/50 hover:bg-ghost-700/50 text-ghost-300 hover:text-white transition-colors capitalize"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {platform}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Companies */}
            {similar.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Similar Companies</h2>
                <div className="space-y-2">
                  {similar.map((s) => (
                    <Link
                      key={s}
                      to={`/companies/${s}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ghost-800/50 hover:bg-ghost-700/50 text-ghost-300 hover:text-white transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      {s}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'technologies' && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-ghost-400" />
            Technologies ({company.technologies.length})
          </h2>
          {company.technologies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.technologies.map((tech) => (
                <div
                  key={tech.name}
                  className="p-4 rounded-xl bg-ghost-800/50 border border-ghost-700/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{tech.name}</span>
                    <span className="text-xs text-ghost-500">
                      {Math.round(tech.confidence * 100)}%
                    </span>
                  </div>
                  <span className="text-sm text-ghost-400 capitalize">{tech.category}</span>
                  <div className="mt-2 h-1 bg-ghost-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ghost-500 rounded-full"
                      style={{ width: `${tech.confidence * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ghost-500 text-center py-8">No technologies detected</p>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-ghost-400" />
            Products & Services ({company.products.length})
          </h2>
          {company.products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.products.map((product, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-ghost-800/50 border border-ghost-700/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{product.name}</span>
                    <span className="text-xs text-ghost-500">
                      {Math.round(product.confidence * 100)}%
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-sm text-ghost-400 mt-2">{product.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ghost-500 text-center py-8">No products detected</p>
          )}
        </div>
      )}

      {activeTab === 'people' && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-ghost-400" />
            People ({company.people?.length || 0})
          </h2>
          {company.people?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.people.map((person, i) => (
                <div key={i} className="p-4 rounded-xl bg-ghost-800/50 border border-ghost-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ghost-700 flex items-center justify-center">
                      <Users className="w-5 h-5 text-ghost-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{person.name}</p>
                      {person.title && (
                        <p className="text-sm text-ghost-400">{person.title}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ghost-500 text-center py-8">No people detected</p>
          )}
        </div>
      )}

      {activeTab === 'graph' && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Network className="w-5 h-5 text-ghost-400" />
            Knowledge Graph
          </h2>
          {graph && graph.nodes.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-ghost-800/50 text-center">
                  <p className="text-2xl font-bold text-white">{graph.nodes.length}</p>
                  <p className="text-sm text-ghost-400">Nodes</p>
                </div>
                <div className="p-4 rounded-xl bg-ghost-800/50 text-center">
                  <p className="text-2xl font-bold text-white">{graph.edges.length}</p>
                  <p className="text-sm text-ghost-400">Relationships</p>
                </div>
              </div>
              
              {/* Nodes list */}
              <div>
                <h3 className="font-medium text-white mb-3">Connected Entities</h3>
                <div className="flex flex-wrap gap-2">
                  {graph.nodes.map((node) => (
                    <span
                      key={node.id}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        node.node_type === 'company' ? 'bg-ghost-500/50 text-white' :
                        node.node_type === 'industry' ? 'bg-white/20 text-white' :
                        node.node_type === 'sector' ? 'bg-ghost-300/20 text-ghost-200' :
                        node.node_type === 'technology' ? 'bg-ghost-200/20 text-ghost-100' :
                        node.node_type === 'product' ? 'bg-ghost-700/50 text-ghost-300' :
                        'bg-black text-ghost-400'
                      }`}
                    >
                      {node.label}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                to="/graph"
                className="inline-flex items-center gap-2 px-4 py-2 bg-ghost-700 hover:bg-ghost-600 rounded-lg text-white transition-colors"
              >
                <Network className="w-4 h-4" />
                View Full Graph
              </Link>
            </div>
          ) : (
            <p className="text-ghost-500 text-center py-8">No graph data available</p>
          )}
        </div>
      )}

      {/* Contradictions */}
      {company.contradictions.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-orange-500/30">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            Detected Contradictions
          </h2>
          <div className="space-y-3">
            {company.contradictions.map((c, i) => (
              <div key={i} className="p-4 rounded-lg bg-orange-500/10">
                <p className="font-medium text-orange-300">{c.field_name}</p>
                <p className="text-sm text-ghost-400 mt-1">{c.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {c.values.map((v, j) => (
                    <span key={j} className="px-2 py-1 rounded bg-ghost-800/50 text-xs text-ghost-300">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
