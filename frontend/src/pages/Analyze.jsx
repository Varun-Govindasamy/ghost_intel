import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Upload,
  X,
  Globe,
  Download,
} from 'lucide-react'
import { analyzeCompany, getAnalysisStatus, batchAnalyze, getBatchStatus } from '../api'

function AnalysisProgress({ domain, onComplete }) {
  const [status, setStatus] = useState({ status: 'pending', progress: 0 })
  const intervalRef = useRef(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await getAnalysisStatus(domain)
        setStatus(result)
        
        if (result.status === 'completed' || result.status === 'failed') {
          clearInterval(intervalRef.current)
          if (result.status === 'completed') {
            onComplete(result.result)
          }
        }
      } catch (error) {
        console.error('Failed to check status:', error)
      }
    }

    checkStatus()
    intervalRef.current = setInterval(checkStatus, 2000)

    return () => clearInterval(intervalRef.current)
  }, [domain, onComplete])

  const statusConfig = {
    pending: { color: 'ghost', icon: Loader2, text: 'Queued...' },
    crawling: { color: 'blue', icon: Loader2, text: 'Crawling website...' },
    extracting: { color: 'purple', icon: Loader2, text: 'Extracting intelligence...' },
    classifying: { color: 'amber', icon: Loader2, text: 'Classifying industry...' },
    completed: { color: 'green', icon: CheckCircle2, text: 'Complete!' },
    failed: { color: 'red', icon: AlertCircle, text: 'Failed' },
  }

  const config = statusConfig[status.status] || statusConfig.pending
  const Icon = config.icon

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-ghost-600/30 flex items-center justify-center">
          <Globe className="w-5 h-5 text-ghost-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-white">{domain}</p>
          <div className="flex items-center gap-2 mt-1">
            <Icon className={`w-4 h-4 ${status.status === 'completed' ? 'text-green-400' : status.status === 'failed' ? 'text-red-400' : 'text-ghost-400 animate-spin'}`} />
            <span className={`text-sm ${status.status === 'completed' ? 'text-green-400' : status.status === 'failed' ? 'text-red-400' : 'text-ghost-400'}`}>
              {config.text}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-ghost-300">{status.progress}%</div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-2 bg-ghost-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status.status === 'completed' ? 'bg-green-500' : 
            status.status === 'failed' ? 'bg-red-500' : 
            'bg-ghost-500 shimmer'
          }`}
          style={{ width: `${status.progress}%` }}
        />
      </div>
      {status.error && (
        <p className="mt-2 text-sm text-red-400">{status.error}</p>
      )}
    </div>
  )
}

export default function Analyze() {
  const [domain, setDomain] = useState('')
  const [analyzing, setAnalyzing] = useState([])
  const [completed, setCompleted] = useState([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchDomains, setBatchDomains] = useState('')

  const handleAnalyze = async () => {
    if (!domain.trim()) return
    
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    
    if (analyzing.includes(cleanDomain)) return
    
    try {
      await analyzeCompany(cleanDomain)
      setAnalyzing([...analyzing, cleanDomain])
      setDomain('')
    } catch (error) {
      console.error('Failed to start analysis:', error)
    }
  }

  const handleBatchAnalyze = async () => {
    const domains = batchDomains
      .split('\n')
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''))
      .filter(d => d.length > 0)
    
    if (domains.length === 0) return
    
    try {
      await batchAnalyze(domains)
      setAnalyzing([...analyzing, ...domains])
      setBatchDomains('')
    } catch (error) {
      console.error('Failed to start batch analysis:', error)
    }
  }

  const handleComplete = (result) => {
    setAnalyzing(prev => prev.filter(d => d !== result.domain))
    setCompleted(prev => [result, ...prev])
  }

  const removeFromAnalyzing = (domain) => {
    setAnalyzing(prev => prev.filter(d => d !== domain))
  }

  // Download CSV with all completed results
  const downloadCSV = () => {
    if (completed.length === 0) return

    // Define CSV headers based on required fields
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

    // Helper to return "Not Available" for empty values
    const na = (value) => value || 'Not Available'

    // Convert completed results to CSV rows
    const rows = completed.map(result => {
      const tags = result.tags?.join('; ') || result.keywords?.join('; ') || ''
      const longDesc = result.long_description || result.description || ''
      const shortDesc = result.short_description || result.tagline || ''
      
      // Social media links - handle both nested and flat structures
      const social = result.social_media || result.social_links || {}
      
      // People - can be array of objects or strings
      const people = result.people || result.team || result.leadership || []
      const peopleNames = Array.isArray(people) 
        ? people.map(p => typeof p === 'object' ? p.name : p).filter(Boolean).join('; ')
        : ''
      const peopleTitles = Array.isArray(people)
        ? people.map(p => typeof p === 'object' ? p.title || p.role || p.position : '').filter(Boolean).join('; ')
        : ''
      
      // Certifications - can be array or string
      const certs = result.certifications || result.certificates || []
      const certsStr = Array.isArray(certs) ? certs.join('; ') : certs
      
      return [
        na(result.domain),
        na(result.company_name || result.name),
        na(longDesc),
        na(shortDesc),
        na(result.sic_code),
        na(result.sic_text || result.sic_description),
        na(result.sub_industry),
        na(result.industry),
        na(result.sector),
        na(tags),
        na(result.full_address || result.address || result.headquarters),
        na(result.phone || result.phone_number),
        na(result.email || result.contact_email),
        na(result.hours_of_operation || result.business_hours),
        na(result.hq_indicator || result.is_headquarters),
        na(result.logo_url || result.logo),
        na(social.linkedin || result.linkedin),
        na(social.facebook || result.facebook),
        na(social.instagram || result.instagram),
        na(social.twitter || social.x || result.twitter || result.x),
        na(social.youtube || result.youtube),
        na(social.blog || result.blog || result.blog_url),
        na(peopleNames),
        na(peopleTitles),
        na(certsStr)
      ]
    })

    // Build CSV content
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
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ghostintel_analysis_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-ghost-500 to-ghost-700 flex items-center justify-center mx-auto mb-6 animate-float">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Analyze Company</h1>
        <p className="text-ghost-400 mt-2 max-w-lg mx-auto">
          Enter a company domain to extract structured intelligence, classify industry, and build knowledge graph connections.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setBatchMode(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            !batchMode
              ? 'bg-ghost-600 text-white'
              : 'bg-ghost-800/50 text-ghost-400 hover:text-white'
          }`}
        >
          Single Domain
        </button>
        <button
          onClick={() => setBatchMode(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            batchMode
              ? 'bg-ghost-600 text-white'
              : 'bg-ghost-800/50 text-ghost-400 hover:text-white'
          }`}
        >
          Batch Analysis
        </button>
      </div>

      {/* Input Section */}
      <div className="glass rounded-2xl p-6">
        {!batchMode ? (
          <>
            <label className="block text-sm font-medium text-ghost-300 mb-2">
              Company Domain
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ghost-500" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="example.com"
                  className="w-full pl-12 pr-4 py-4 bg-ghost-900/50 border border-ghost-700 rounded-xl text-white placeholder-ghost-500 focus:outline-none focus:border-ghost-500 focus:ring-2 focus:ring-ghost-500/20"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!domain.trim()}
                className="px-6 py-4 bg-gradient-to-r from-ghost-600 to-ghost-700 hover:from-ghost-500 hover:to-ghost-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Analyze
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-ghost-300 mb-2">
              Domains (one per line)
            </label>
            <textarea
              value={batchDomains}
              onChange={(e) => setBatchDomains(e.target.value)}
              placeholder="example1.com&#10;example2.com&#10;example3.com"
              rows={6}
              className="w-full p-4 bg-ghost-900/50 border border-ghost-700 rounded-xl text-white placeholder-ghost-500 focus:outline-none focus:border-ghost-500 focus:ring-2 focus:ring-ghost-500/20 resize-none"
            />
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-ghost-400">
                {batchDomains.split('\n').filter(d => d.trim()).length} domains
              </span>
              <button
                onClick={handleBatchAnalyze}
                disabled={!batchDomains.trim()}
                className="px-6 py-3 bg-gradient-to-r from-ghost-600 to-ghost-700 hover:from-ghost-500 hover:to-ghost-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Analyze Batch
              </button>
            </div>
          </>
        )}
      </div>

      {/* In Progress */}
      {analyzing.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-ghost-400 animate-spin" />
            Analyzing ({analyzing.length})
          </h2>
          <div className="space-y-3">
            {analyzing.map((d) => (
              <AnalysisProgress key={d} domain={d} onComplete={handleComplete} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Completed ({completed.length})
            </h2>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-green-400 hover:text-green-300 transition-all"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
          <div className="space-y-3">
            {completed.map((result) => (
              <Link
                key={result.domain}
                to={`/companies/${result.domain}`}
                className="block glass rounded-xl p-4 hover:bg-ghost-800/40 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {result.company_name || result.domain}
                    </p>
                    <p className="text-sm text-ghost-400">{result.domain}</p>
                  </div>
                  <div className="text-right">
                    {result.industry && (
                      <span className="px-2 py-1 rounded-md bg-ghost-700/50 text-xs text-ghost-300">
                        {result.industry}
                      </span>
                    )}
                    <div className="text-sm text-ghost-400 mt-1">
                      {Math.round(result.overall_confidence * 100)}% confidence
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-ghost-500 group-hover:text-ghost-300 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="glass-light rounded-2xl p-6">
        <h3 className="font-medium text-white mb-3">Tips for best results</h3>
        <ul className="space-y-2 text-sm text-ghost-400">
          <li className="flex items-start gap-2">
            <span className="text-ghost-500">•</span>
            Enter the main company domain (e.g., "microsoft.com" not "www.microsoft.com")
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ghost-500">•</span>
            Analysis works best on company websites with clear about/product pages
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ghost-500">•</span>
            Batch mode supports up to 150 domains at once
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ghost-500">•</span>
            Results include confidence scores and evidence for all extracted data
          </li>
        </ul>
      </div>
    </div>
  )
}
