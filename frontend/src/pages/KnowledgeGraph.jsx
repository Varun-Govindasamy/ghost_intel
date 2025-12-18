import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Filter,
  Download,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { getGraph, getGraphStatistics } from '../api'

// Enhanced force-directed graph visualization
function ForceGraph({ nodes, edges, onNodeClick }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const positionsRef = useRef({})
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)

  const nodeColors = {
    company: { primary: '#ef4444', glow: '#f87171', gradient: ['#dc2626', '#b91c1c'] },
    industry: { primary: '#ffffff', glow: '#ffffff', gradient: ['#ffffff', '#ffffff'] },
    sector: { primary: '#fca5a5', glow: '#fecaca', gradient: ['#f87171', '#fca5a5'] },
    sub_industry: { primary: '#fee2e2', glow: '#fef2f2', gradient: ['#fecaca', '#fee2e2'] },
    technology: { primary: '#ffffff', glow: '#fef2f2', gradient: ['#fecaca', '#ffffff'] },
    product: { primary: '#b91c1c', glow: '#dc2626', gradient: ['#991b1b', '#b91c1c'] },
    location: { primary: '#ffffff', glow: '#f5f5f5', gradient: ['#e5e5e5', '#ffffff'] },
  }

  // Identify clusters: each company and its connected nodes form a cluster
  const getCompanyClusters = useCallback(() => {
    const companies = nodes.filter(n => n.type === 'company')
    const clusters = {}
    const nodeToCluster = {}

    // Each company is a cluster center
    companies.forEach((company, idx) => {
      clusters[company.id] = {
        center: company.id,
        nodes: [company.id],
        index: idx
      }
      nodeToCluster[company.id] = company.id
    })

    // Assign other nodes to the company they're connected to
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      
      if (sourceNode?.type === 'company' && targetNode && !nodeToCluster[targetNode.id]) {
        clusters[sourceNode.id].nodes.push(targetNode.id)
        nodeToCluster[targetNode.id] = sourceNode.id
      } else if (targetNode?.type === 'company' && sourceNode && !nodeToCluster[sourceNode.id]) {
        clusters[targetNode.id].nodes.push(sourceNode.id)
        nodeToCluster[sourceNode.id] = targetNode.id
      }
    })

    // Assign orphan nodes to nearest company or create "other" cluster
    nodes.forEach(node => {
      if (!nodeToCluster[node.id]) {
        // Find if connected to any clustered node
        const connectedEdge = edges.find(e => 
          (e.source === node.id && nodeToCluster[e.target]) ||
          (e.target === node.id && nodeToCluster[e.source])
        )
        if (connectedEdge) {
          const clusterId = nodeToCluster[connectedEdge.source === node.id ? connectedEdge.target : connectedEdge.source]
          clusters[clusterId].nodes.push(node.id)
          nodeToCluster[node.id] = clusterId
        }
      }
    })

    return { clusters, nodeToCluster, companyCount: companies.length }
  }, [nodes, edges])

  // Initialize positions with cluster-aware layout
  useEffect(() => {
    if (nodes.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    const { clusters, nodeToCluster, companyCount } = getCompanyClusters()
    const newPositions = {}
    
    // Calculate cluster center positions in a circle around the canvas center
    const clusterCenters = {}
    const clusterIds = Object.keys(clusters)
    // Scale cluster radius based on number of companies - more companies = larger spread
    const baseRadius = Math.min(centerX, centerY) * 0.7
    const clusterRadius = clusterIds.length <= 2 
      ? baseRadius * 0.6 
      : clusterIds.length <= 4 
        ? baseRadius * 0.8 
        : baseRadius * 1.0
    
    clusterIds.forEach((clusterId, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(clusterIds.length, 1) - Math.PI / 2
      clusterCenters[clusterId] = {
        x: centerX + clusterRadius * Math.cos(angle),
        y: centerY + clusterRadius * Math.sin(angle)
      }
    })

    // Position nodes around their cluster center
    nodes.forEach((node) => {
      const clusterId = nodeToCluster[node.id]
      let x, y
      
      if (clusterId && clusterCenters[clusterId]) {
        const cluster = clusters[clusterId]
        const clusterCenter = clusterCenters[clusterId]
        const nodeIndex = cluster.nodes.indexOf(node.id)
        const totalInCluster = cluster.nodes.length
        
        if (node.type === 'company') {
          // Company at cluster center
          x = clusterCenter.x
          y = clusterCenter.y
        } else {
          // Other nodes in a spiral around the company
          const goldenAngle = Math.PI * (3 - Math.sqrt(5))
          const angle = (nodeIndex + 1) * goldenAngle
          const radius = Math.sqrt((nodeIndex + 1) / totalInCluster) * 150 + 60
          x = clusterCenter.x + radius * Math.cos(angle)
          y = clusterCenter.y + radius * Math.sin(angle)
        }
      } else {
        // Orphan nodes - place at center
        x = centerX + (Math.random() - 0.5) * 100
        y = centerY + (Math.random() - 0.5) * 100
      }
      
      newPositions[node.id] = {
        x,
        y,
        vx: 0,
        vy: 0,
        clusterId: clusterId || null
      }
    })

    positionsRef.current = newPositions
  }, [nodes, getCompanyClusters])

  // Cluster-aware force simulation
  useEffect(() => {
    if (Object.keys(positionsRef.current).length === 0 || nodes.length === 0) return

    const positions = positionsRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    const { clusters, nodeToCluster, companyCount } = getCompanyClusters()
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const k = 30
    const repulsion = 15000 // Increased repulsion
    const clusterRepulsion = 150000 // Much stronger repulsion between clusters
    const damping = 0.85

    // Calculate cluster centers for cluster-level forces
    const getClusterCenter = (clusterId) => {
      const cluster = clusters[clusterId]
      if (!cluster) return { x: centerX, y: centerY }
      
      let sumX = 0, sumY = 0, count = 0
      cluster.nodes.forEach(nodeId => {
        if (positions[nodeId]) {
          sumX += positions[nodeId].x
          sumY += positions[nodeId].y
          count++
        }
      })
      return count > 0 ? { x: sumX / count, y: sumY / count } : { x: centerX, y: centerY }
    }

    // Run simulation for fixed iterations to settle positions
    for (let iter = 0; iter < 150; iter++) {
      // First pass: apply cluster-level repulsion between company nodes
      const companyNodes = nodes.filter(n => n.type === 'company')
      companyNodes.forEach((company) => {
        if (!positions[company.id]) return
        
        companyNodes.forEach((other) => {
          if (company.id === other.id || !positions[other.id]) return
          
          const dx = positions[company.id].x - positions[other.id].x
          const dy = positions[company.id].y - positions[other.id].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          
          // Strong repulsion between company clusters
          const minDist = 500 // Minimum distance between companies (increased)
          if (dist < minDist * 2) {
            const force = clusterRepulsion / (dist * dist)
            // Stronger push when too close
            const pushFactor = dist < minDist ? 0.3 : 0.15
            positions[company.id].vx += (force * dx) / dist * pushFactor
            positions[company.id].vy += (force * dy) / dist * pushFactor
          }
        })
      })

      nodes.forEach((node) => {
        if (!positions[node.id]) return

        let fx = 0
        let fy = 0
        const myCluster = nodeToCluster[node.id]

        // Repulsion from other nodes (stronger within cluster, weaker across clusters)
        nodes.forEach((other) => {
          if (node.id === other.id || !positions[other.id]) return

          const dx = positions[node.id].x - positions[other.id].x
          const dy = positions[node.id].y - positions[other.id].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          
          const otherCluster = nodeToCluster[other.id]
          const sameCluster = myCluster && myCluster === otherCluster
          
          // Different repulsion based on cluster membership
          const effectiveRepulsion = sameCluster ? repulsion * 0.6 : repulsion * 2.0
          const maxDist = sameCluster ? 180 : 600

          if (dist < maxDist) {
            const force = effectiveRepulsion / (dist * dist)
            fx += (force * dx) / dist
            fy += (force * dy) / dist
          }
        })

        // Attraction along edges (stronger for intra-cluster edges)
        edges.forEach((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.target === node.id ? edge.source : null
          if (!otherId || !positions[otherId]) return

          const dx = positions[otherId].x - positions[node.id].x
          const dy = positions[otherId].y - positions[node.id].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const targetDist = 100 // Tighter clustering

          if (dist > 0) {
            const force = k * (dist - targetDist) / dist
            fx += force * dx * 0.15
            fy += force * dy * 0.15
          }
        })

        // Pull non-company nodes toward their cluster center (their company)
        if (node.type !== 'company' && myCluster) {
          const companyPos = positions[myCluster]
          if (companyPos) {
            const dx = companyPos.x - positions[node.id].x
            const dy = companyPos.y - positions[node.id].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            
            // Keep nodes within reasonable distance of their company (tighter clustering)
            const maxDistFromCompany = 150
            if (dist > maxDistFromCompany) {
              const pullStrength = 0.03 * (dist / maxDistFromCompany)
              fx += dx * pullStrength
              fy += dy * pullStrength
            }
          }
        }

        // Gentle center gravity for companies only (keeps the whole graph centered)
        if (node.type === 'company') {
          fx += (centerX - positions[node.id].x) * 0.001
          fy += (centerY - positions[node.id].y) * 0.001
        }

        // Boundary forces
        const margin = 100
        if (positions[node.id].x < margin) fx += (margin - positions[node.id].x) * 0.15
        if (positions[node.id].x > canvas.width - margin) fx += (canvas.width - margin - positions[node.id].x) * 0.15
        if (positions[node.id].y < margin) fy += (margin - positions[node.id].y) * 0.15
        if (positions[node.id].y > canvas.height - margin) fy += (canvas.height - margin - positions[node.id].y) * 0.15

        // Apply velocity with damping
        positions[node.id].vx = (positions[node.id].vx + fx * 0.1) * damping
        positions[node.id].vy = (positions[node.id].vy + fy * 0.1) * damping

        // Limit velocity
        const speed = Math.sqrt(positions[node.id].vx ** 2 + positions[node.id].vy ** 2)
        if (speed > 12) {
          positions[node.id].vx = (positions[node.id].vx / speed) * 12
          positions[node.id].vy = (positions[node.id].vy / speed) * 12
        }

        positions[node.id].x += positions[node.id].vx
        positions[node.id].y += positions[node.id].vy
      })
    }

    positionsRef.current = { ...positions }
  }, [nodes, edges, getCompanyClusters])

  // Main draw function (static render)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const positions = positionsRef.current

    const draw = () => {
      const { width, height } = canvas

      // Clear with gradient background
      const bgGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2)
      bgGradient.addColorStop(0, '#000000')
      bgGradient.addColorStop(0.5, '#000000')
      bgGradient.addColorStop(1, '#000000')
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      // Draw subtle grid
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.03)'
      ctx.lineWidth = 1
      const gridSize = 50
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      ctx.save()
      ctx.translate(offset.x + width/2, offset.y + height/2)
      ctx.scale(zoom, zoom)
      ctx.translate(-width/2, -height/2)

      // Draw edges with gradients
      edges.forEach((edge) => {
        const source = positions[edge.source]
        const target = positions[edge.target]
        if (!source || !target) return

        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        const sourceColor = nodeColors[sourceNode?.node_type]?.primary || '#ef4444'
        const targetColor = nodeColors[targetNode?.node_type]?.primary || '#ef4444'

        // Edge glow
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)'
        ctx.lineWidth = 4
        ctx.stroke()

        // Edge gradient line
        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y)
        gradient.addColorStop(0, sourceColor + '80')
        gradient.addColorStop(1, targetColor + '80')
        
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.5
        ctx.stroke()
      })

      // Draw nodes
      nodes.forEach((node) => {
        const pos = positions[node.id]
        if (!pos) return

        const colors = nodeColors[node.node_type] || nodeColors.company
        const isCompany = node.node_type === 'company'
        const baseRadius = isCompany ? 20 : 12
        const isHovered = hoveredNode === node.id
        const isSelected = selectedNode === node.id
        const radius = baseRadius * (isHovered || isSelected ? 1.3 : 1)

        // Outer glow (static)
        const glowSize = radius + 15
        const glowGradient = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, glowSize)
        glowGradient.addColorStop(0, colors.glow + '40')
        glowGradient.addColorStop(1, colors.glow + '00')
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()

        // Highlight ring for hovered/selected
        if (isHovered || isSelected) {
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2)
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Main node gradient
        const nodeGradient = ctx.createRadialGradient(
          pos.x - radius * 0.3, pos.y - radius * 0.3, 0,
          pos.x, pos.y, radius
        )
        nodeGradient.addColorStop(0, colors.gradient[1])
        nodeGradient.addColorStop(1, colors.gradient[0])

        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = nodeGradient
        ctx.fill()

        // Inner highlight
        ctx.beginPath()
        ctx.arc(pos.x - radius * 0.25, pos.y - radius * 0.25, radius * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fill()

        // Border
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Icon for companies
        if (isCompany) {
          ctx.font = 'bold 12px Inter, sans-serif'
          ctx.fillStyle = '#fff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('◆', pos.x, pos.y)
        }

        // Label with background
        const label = node.label.length > 18 ? node.label.slice(0, 16) + '...' : node.label
        ctx.font = `${isHovered || isSelected ? 'bold ' : ''}11px Inter, sans-serif`
        const textWidth = ctx.measureText(label).width
        
        // Label background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.beginPath()
        ctx.roundRect(pos.x - textWidth/2 - 6, pos.y + radius + 6, textWidth + 12, 18, 4)
        ctx.fill()

        // Label text
        ctx.fillStyle = isHovered || isSelected ? '#fff' : '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(label, pos.x, pos.y + radius + 10)
      })

      ctx.restore()
    }

    draw()
  }, [nodes, edges, zoom, offset, hoveredNode, selectedNode])

  // Mouse handlers
  const handleMouseDown = (e) => {
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    // Transform to graph coordinates
    const x = (canvasX - offset.x - canvas.width/2) / zoom + canvas.width/2
    const y = (canvasY - offset.y - canvas.height/2) / zoom + canvas.height/2

    // Check for hovered node
    let found = null
    nodes.forEach((node) => {
      const pos = positionsRef.current[node.id]
      if (!pos) return
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
      const radius = node.node_type === 'company' ? 25 : 18
      if (dist < radius) found = node.id
    })
    setHoveredNode(found)

    if (dragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }, [dragging, dragStart, offset, zoom, nodes])

  const handleMouseUp = () => setDragging(false)

  const handleClick = () => {
    if (hoveredNode) {
      setSelectedNode(selectedNode === hoveredNode ? null : hoveredNode)
      if (onNodeClick) {
        const node = nodes.find(n => n.id === hoveredNode)
        onNodeClick(node)
      }
    }
  }

  const resetView = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setSelectedNode(null)
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={1200}
        height={700}
        className="w-full h-full rounded-xl cursor-grab active:cursor-grabbing"
        style={{ background: '#000000' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={(e) => {
          e.preventDefault()
          const delta = e.deltaY > 0 ? 0.9 : 1.1
          setZoom((z) => Math.max(0.3, Math.min(4, z * delta)))
        }}
      />
      
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setZoom(z => Math.min(4, z * 1.2))}
          className="p-2 bg-ghost-800/80 hover:bg-ghost-700 rounded-lg backdrop-blur-sm transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
          className="p-2 bg-ghost-800/80 hover:bg-ghost-700 rounded-lg backdrop-blur-sm transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={resetView}
          className="p-2 bg-ghost-800/80 hover:bg-ghost-700 rounded-lg backdrop-blur-sm transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Node info tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 bg-ghost-900/90 backdrop-blur-sm rounded-xl p-4 border border-ghost-700/50 max-w-xs">
          {(() => {
            const node = nodes.find(n => n.id === hoveredNode)
            if (!node) return null
            const colors = nodeColors[node.node_type] || nodeColors.company
            return (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <span className="text-xs text-ghost-400 uppercase tracking-wider">
                    {node.node_type}
                  </span>
                </div>
                <h4 className="font-semibold text-white">{node.label}</h4>
                {node.node_type === 'company' && (
                  <p className="text-sm text-ghost-400 mt-1">
                    Click to view details
                  </p>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default function KnowledgeGraph() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [graphData, statsData] = await Promise.all([
          getGraph(),
          getGraphStatistics(),
        ])
        setGraph(graphData)
        setStats(statsData)
      } catch (error) {
        console.error('Failed to fetch graph:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredGraph = {
    nodes: filter === 'all'
      ? graph.nodes
      : graph.nodes.filter((n) => n.node_type === filter),
    edges: filter === 'all'
      ? graph.edges
      : graph.edges.filter((e) => {
          const sourceNode = graph.nodes.find((n) => n.id === e.source)
          const targetNode = graph.nodes.find((n) => n.id === e.target)
          return (
            sourceNode?.node_type === filter ||
            targetNode?.node_type === filter
          )
        }),
  }

  const nodeTypes = [
    { id: 'all', label: 'All Nodes', color: '#ef4444', icon: '◉' },
    { id: 'company', label: 'Companies', color: '#ef4444', icon: '◆' },
    { id: 'industry', label: 'Industries', color: '#ffffff', icon: '●' },
    { id: 'sector', label: 'Sectors', color: '#fca5a5', icon: '●' },
    { id: 'technology', label: 'Technologies', color: '#fee2e2', icon: '●' },
    { id: 'product', label: 'Products', color: '#b91c1c', icon: '●' },
    { id: 'location', label: 'Locations', color: '#ffffff', icon: '●' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-ghost-700 border-t-ghost-400 animate-spin mx-auto" />
            <Sparkles className="w-8 h-8 text-ghost-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-ghost-400 text-lg">Loading knowledge graph...</p>
          <p className="text-ghost-500 text-sm mt-1">Preparing visualization</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Network className="w-8 h-8 text-ghost-400" />
            Knowledge Graph
          </h1>
          <p className="text-ghost-400 mt-1">
            Interactive visualization of company relationships and connections
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-ghost-800 hover:bg-ghost-700 rounded-lg text-ghost-300 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative overflow-hidden glass rounded-xl p-5 group hover:scale-[1.02] transition-transform">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
            <p className="text-3xl font-bold text-white relative">{stats.total_nodes}</p>
            <p className="text-sm text-ghost-400 relative">Total Nodes</p>
            <Network className="absolute right-3 bottom-3 w-8 h-8 text-ghost-700 group-hover:text-ghost-600 transition-colors" />
          </div>
          <div className="relative overflow-hidden glass rounded-xl p-5 group hover:scale-[1.02] transition-transform">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
            <p className="text-3xl font-bold text-white relative">{stats.total_edges}</p>
            <p className="text-sm text-ghost-400 relative">Connections</p>
            <Sparkles className="absolute right-3 bottom-3 w-8 h-8 text-ghost-700 group-hover:text-ghost-600 transition-colors" />
          </div>
          <div className="relative overflow-hidden glass rounded-xl p-5 group hover:scale-[1.02] transition-transform">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
            <p className="text-3xl font-bold text-white relative">
              {stats.node_types?.company || 0}
            </p>
            <p className="text-sm text-ghost-400 relative">Companies</p>
          </div>
          <div className="relative overflow-hidden glass rounded-xl p-5 group hover:scale-[1.02] transition-transform">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
            <p className="text-3xl font-bold text-white relative">
              {Object.keys(stats.node_types || {}).length}
            </p>
            <p className="text-sm text-ghost-400 relative">Entity Types</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-ghost-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter by type:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {nodeTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setFilter(type.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  filter === type.id
                    ? 'text-white shadow-lg scale-105'
                    : 'text-ghost-400 hover:text-white hover:bg-ghost-800'
                }`}
                style={{
                  backgroundColor: filter === type.id ? type.color + '30' : 'transparent',
                  borderColor: filter === type.id ? type.color : 'transparent',
                  borderWidth: '1px',
                  boxShadow: filter === type.id ? `0 0 20px ${type.color}30` : 'none',
                }}
              >
                <span style={{ color: type.color }}>{type.icon}</span>
                {type.label}
                {stats?.node_types?.[type.id] !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 bg-ghost-800 rounded text-xs">
                    {stats.node_types[type.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div className="glass rounded-2xl p-2 overflow-hidden" style={{ minHeight: '700px' }}>
        {graph.nodes.length > 0 ? (
          <ForceGraph 
            nodes={filteredGraph.nodes} 
            edges={filteredGraph.edges}
            onNodeClick={setSelectedNodeInfo}
          />
        ) : (
          <div className="h-[700px] flex items-center justify-center">
            <div className="text-center">
              <div className="relative inline-block">
                <Network className="w-24 h-24 text-ghost-700 mx-auto" />
                <div className="absolute inset-0 animate-ping">
                  <Network className="w-24 h-24 text-ghost-700/30 mx-auto" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-white mt-6 mb-3">No Graph Data Yet</h2>
              <p className="text-ghost-400 mb-8 max-w-md mx-auto">
                Start analyzing companies to build your knowledge graph. 
                Each company analysis adds nodes and relationships.
              </p>
              <Link
                to="/analyze"
                className="px-8 py-4 bg-gradient-to-r from-ghost-600 to-indigo-600 hover:from-ghost-500 hover:to-indigo-500 rounded-xl font-medium text-white transition-all inline-flex items-center gap-3 shadow-lg shadow-ghost-900/50 hover:shadow-ghost-800/50 hover:scale-105"
              >
                <Sparkles className="w-5 h-5" />
                Analyze Your First Company
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-ghost-400 rounded-full" />
          Node Types Legend
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {nodeTypes.slice(1).map((type) => (
            <div 
              key={type.id} 
              className="flex items-center gap-3 p-3 rounded-lg bg-ghost-800/30 hover:bg-ghost-800/50 transition-colors"
            >
              <div
                className="w-4 h-4 rounded-full shadow-lg"
                style={{ 
                  backgroundColor: type.color,
                  boxShadow: `0 0 10px ${type.color}50`
                }}
              />
              <span className="text-sm text-ghost-300">{type.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="glass-light rounded-xl p-5">
        <h3 className="font-semibold text-white mb-3">🎮 Navigation Controls</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-ghost-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ghost-800 flex items-center justify-center">
              <span className="text-lg">🖱️</span>
            </div>
            <div>
              <p className="text-ghost-300 font-medium">Drag</p>
              <p>Pan the view</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ghost-800 flex items-center justify-center">
              <span className="text-lg">🔍</span>
            </div>
            <div>
              <p className="text-ghost-300 font-medium">Scroll</p>
              <p>Zoom in/out</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ghost-800 flex items-center justify-center">
              <span className="text-lg">👆</span>
            </div>
            <div>
              <p className="text-ghost-300 font-medium">Hover</p>
              <p>View node details</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ghost-800 flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <div>
              <p className="text-ghost-300 font-medium">Click</p>
              <p>Select nodes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
