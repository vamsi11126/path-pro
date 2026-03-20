'use client'

import { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  addEdge
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useTheme } from 'next-themes'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// Modern Neon/Dark Theme Colors (unchanged for status indicators)
const nodeColors = {
  locked: '#71717a',      // Zinc-500 (Neutral Gray)
  available: '#18181b',   // Zinc-900 (High contrast Black/Dark for availability)
  learning: '#0ea5e9',    // Sky-500
  reviewing: '#f97316',   // Orange-500
  mastered: '#10b981',    // Emerald-500
}

export default function GraphVisualizer({
  topics,
  dependencies,
  onNodeClick,
  onEdgeClick,
  onConnect,
  onPaneContextMenu,
  readOnly = false
}) {
  const { resolvedTheme } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [rfInstance, setRfInstance] = useState(null)
  
  const isDark = resolvedTheme === 'dark'

  // Heatmap State
  const [isHeatmapActive, setIsHeatmapActive] = useState(false)
  const [sliderDays, setSliderDays] = useState(0)

  // Retention Math
  const calculateRetention = useCallback((topic, daysOut) => {
    if (!['learning', 'reviewing', 'mastered'].includes(topic.status)) return null
    const lastDate = topic.updated_at ? new Date(topic.updated_at) : new Date(topic.created_at)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysOut)
    
    const t = Math.max(0, (futureDate - lastDate) / (1000 * 60 * 60 * 24))
    const interval = topic.interval_days > 0 ? topic.interval_days : 1
    const easeFactor = topic.difficulty_factor || 2.5
    
    // Scale S by 10 to make decay realistic (standard e^-t/S formula drops too aggressively without a scaling constant)
    const S = ((interval * easeFactor) / 2.5) * 10 
    
    // Retention score R = e^(-t/S)
    const R = Math.exp(-t / S) * 100
    return Math.max(0, Math.min(100, R)) // clamp 0-100
  }, [])

  const getRetentionColor = (r) => {
    if (r > 90) return '#22c55e' // Bright Green
    if (r > 70) return '#a3e635' // Yellow/Lime
    if (r > 50) return '#fbbf24' // Orange
    return '#ef4444'             // Deep Red
  }

  useEffect(() => {
    if (!topics || topics.length === 0) return

    // Create nodes from topics
    const newNodes = topics.map((topic, index) => {
      const color = nodeColors[topic.status] || nodeColors.locked
      
      const cols = Math.ceil(Math.sqrt(topics.length))
      const x = (index % cols) * 280
      const y = Math.floor(index / cols) * 180

      const isLocked = topic.status === 'locked'

      // Heatmap Overrides
      let currentR = null
      let heatmapColor = null
      if (isHeatmapActive) {
        currentR = calculateRetention(topic, sliderDays)
        if (currentR !== null) {
          heatmapColor = getRetentionColor(currentR)
        }
      }

      // Theme-aware styles
      const nodeBg = isHeatmapActive && heatmapColor ? `${heatmapColor}15` : (isDark ? '#18181b' : '#ffffff')
      
      // Node Color (Text)
      const nodeColor = isLocked 
        ? (isDark ? '#52525b' : '#a1a1aa') // Zinc-600 (Dark) / Zinc-400 (Light) - Faded for locked
        : (isDark ? '#fafafa' : '#000000') // White (Dark) / Pure Black (Light) - Sharp for active
      
      // Node Border
      let nodeBorder = isHeatmapActive && heatmapColor ? heatmapColor : color
      if (!isHeatmapActive) {
        if (isLocked) {
          nodeBorder = isDark ? '#27272a' : '#e4e4e7' // Subtle border for locked
        } else if (topic.status === 'available') {
          nodeBorder = isDark ? '#e4e4e7' : '#000000' // White border (Dark) / Pure Black border (Light) for available
        }
      }

      // Shadow logic
      const shadow = isLocked 
        ? 'none'
        : (isHeatmapActive && heatmapColor 
            ? `0 0 15px ${heatmapColor}20, inset 0 0 20px ${heatmapColor}10`
            : (isDark 
                ? `0 0 15px ${color === '#18181b' ? '#ffffff' : color}20, inset 0 0 20px ${color === '#18181b' ? '#ffffff' : color}05` // White glow for available in dark mode
                : `0 4px 12px -2px ${color === '#18181b' ? '#000000' : color}20, 0 2px 6px -1px rgba(0,0,0,0.05)`)) 

      // Label text color logic
      const labelColor = isLocked ? undefined : (isHeatmapActive && heatmapColor ? heatmapColor : (topic.status === 'available' ? (isDark ? '#e4e4e7' : '#18181b') : color))

      return {
        id: topic.id,
        type: 'default',
        position: { x, y },
        data: {
          ...topic, 
          label: (
            <div className="flex flex-col h-full justify-between">
              <div className="font-bold text-sm tracking-tight leading-snug line-clamp-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                {topic.title}
              </div>
              <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${isLocked ? 'text-zinc-400' : ''}`} style={{ color: labelColor }}>
                    {topic.status}
                  </span>
                  {topic.difficulty && (
                    <span className="text-[10px] text-zinc-400 font-medium">
                      Lvl {topic.difficulty}
                    </span>
                  )}
                </div>
                {!isHeatmapActive && topic.next_review_at && (topic.status === 'reviewing' || topic.status === 'mastered') && (
                  <div className="text-[10px] font-medium flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                    {new Date(topic.next_review_at) <= new Date() ? 'Review Due' : `Next: ${new Date(topic.next_review_at).toLocaleDateString('en-GB')}`}
                  </div>
                )}
                {isHeatmapActive && currentR !== null && (
                  <div className="text-[11px] font-bold mt-1 flex items-center gap-1.5" style={{ color: heatmapColor }}>
                    Ready: {Math.round(currentR)}%
                  </div>
                )}
              </div>
            </div>
          ),
        },
        style: {
          background: nodeBg,
          color: nodeColor,
          border: `1px ${isLocked ? 'dashed' : 'solid'} ${nodeBorder}`, // Dashed border for locked
          borderRadius: '12px',
          width: 220,
          padding: '16px',
          fontSize: '14px',
          fontWeight: isDark ? 'normal' : '500',
          boxShadow: shadow,
          transition: 'all 0.3s ease',
          opacity: isLocked ? (isDark ? 0.6 : 0.7) : 1, // Lower opacity for locked
        },
      }
    })

    // Create edges from dependencies
    const newEdges = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.depends_on_topic_id,
      target: dep.topic_id,
      type: 'smoothstep',
      animated: true,
      style: { stroke: isDark ? '#6b7280' : '#a1a1aa', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isDark ? '#6b7280' : '#a1a1aa',
      },
    }))

    setNodes(newNodes)
    setEdges(newEdges)

    if (rfInstance && newNodes.length > 0) {
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.3, duration: 800 })
      }, 100)
    }
  }, [topics, dependencies, rfInstance, isDark, isHeatmapActive, sliderDays, calculateRetention]) // Re-run when theme changes

  const onNodeClickHandler = useCallback(
    (event, node) => {
      if (onNodeClick) {
        onNodeClick(node)
      }
    },
    [onNodeClick]
  )

  const onEdgeClickHandler = useCallback(
    (event, edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge.id)
      }
    },
    [onEdgeClick]
  )

  // Heatmap Summary Computations
  const activeTopics = topics?.filter(t => ['learning', 'reviewing', 'mastered'].includes(t.status)) || []
  let avgRetention = 0
  if (activeTopics.length > 0) {
    const totalR = activeTopics.reduce((acc, t) => acc + (calculateRetention(t, sliderDays) || 0), 0)
    avgRetention = totalR / activeTopics.length
  }
  
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + sliderDays)
  const futureDateString = futureDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="w-full h-full bg-background rounded-lg relative overflow-hidden">
      {/* Heatmap Toggle */}
      <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur shadow-sm border border-border rounded-lg p-3 flex items-center gap-3">
        <Switch id="heatmap-mode" checked={isHeatmapActive} onCheckedChange={setIsHeatmapActive} />
        <Label htmlFor="heatmap-mode" className="text-sm font-medium cursor-pointer">
          Predictive Heatmap
        </Label>
      </div>

      {/* Heatmap Summary Widget */}
      {isHeatmapActive && (
        <div className="absolute top-4 right-4 z-10 w-80 bg-background/95 backdrop-blur shadow-lg border border-border rounded-xl p-4">
          <h3 className="font-bold text-sm mb-2 flex items-center justify-between">
            <span>Exam Readiness Heatmap</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {sliderDays} Days Out
            </span>
          </h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Based on current decay, you will be prepared for <strong className="text-foreground font-semibold">{Math.round(avgRetention)}%</strong> of this subject by {futureDateString}.
          </p>
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>Today</span>
              <span>+30 Days</span>
            </div>
            <Slider 
              value={[sliderDays]} 
              min={0} 
              max={30} 
              step={1} 
              onValueChange={(val) => setSliderDays(val[0])} 
              className="mt-1"
            />
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onEdgeClick={onEdgeClickHandler}
        onPaneContextMenu={onPaneContextMenu}
        onInit={setRfInstance}
        fitView
        minZoom={0.1}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color={isDark ? "#3f3f46" : "#a1a1aa"} // Zinc-400 for better visibility in light mode
          gap={16}
          size={1}
          style={{ backgroundColor: 'transparent' }} // Transparent to let parent bg-background show through
        />
      </ReactFlow>
    </div>
  )
}
