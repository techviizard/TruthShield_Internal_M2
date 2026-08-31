'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface TrustScoreGaugeProps {
  score: number
  size?: number
  label?: string
  showValue?: boolean
}

export function TrustScoreGauge({ score, size = 180, label = 'Trust Score', showValue = true }: TrustScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [displayScore, setDisplayScore] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  // Smooth count-up animation
  useEffect(() => {
    const duration = 1500
    const startTime = Date.now()
    const startVal = displayScore

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + (animatedScore - startVal) * eased)
      setDisplayScore(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animatedScore, displayScore])

  const radius = (size - 20) / 2
  const circumference = radius * Math.PI
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 75) return '#22c55e'
    if (s >= 50) return '#eab308'
    if (s >= 25) return '#f97316'
    return '#ef4444'
  }

  const color = getColor(score)
  const isCritical = score <= 25

  // Generate tick marks
  const tickCount = 24
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = (i / tickCount) * 360
    const isActive = (i / tickCount) * 100 <= score
    return { angle, isActive }
  })

  const getGlowFilter = () => {
    if (isCritical) return `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}40)`
    if (score < 50) return `drop-shadow(0 0 6px ${color}60)`
    return `drop-shadow(0 0 4px ${color}40)`
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ filter: getGlowFilter() }}>
          {/* Tick marks */}
          {ticks.map((tick, i) => {
            const rad = (tick.angle * Math.PI) / 180
            const innerR = radius - 8
            const outerR = radius - 3
            const x1 = size / 2 + innerR * Math.cos(rad)
            const y1 = size / 2 + innerR * Math.sin(rad)
            const x2 = size / 2 + outerR * Math.cos(rad)
            const y2 = size / 2 + outerR * Math.sin(rad)
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tick.isActive ? color : 'currentColor'}
                strokeWidth={tick.isActive ? 2 : 1}
                strokeLinecap="round"
                className={tick.isActive ? 'transition-all duration-500' : 'text-muted/20'}
                opacity={tick.isActive ? 1 : 0.3}
              />
            )
          })}
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className={`text-3xl font-bold ${isCritical ? 'animate-glow-pulse' : ''}`}
              style={{ color }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              {displayScore}
            </motion.span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        )}
        {/* Critical pulse ring */}
        {isCritical && (
          <motion.div
            className="absolute inset-2 rounded-full border-2"
            style={{ borderColor: color }}
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.98, 1.02, 0.98] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
      {label && <span className="text-sm font-medium text-muted-foreground">{label}</span>}
    </div>
  )
}
