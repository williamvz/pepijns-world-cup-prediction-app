import React from 'react'

// A horizontally scrollable segmented pill control. Each option may carry an
// optional `count` shown as a subtle badge.
export function PillGroup({ options, value, onChange, size = 'md', className = '' }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {options.map((o) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`flex-shrink-0 rounded-xl font-heading font-bold transition-all active:scale-95 ${pad} ${
              active ? 'bg-gold-500 text-pitch-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {o.label}
            {o.count != null && (
              <span className={`ml-1.5 ${active ? 'text-pitch-900/60' : 'text-white/40'}`}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// A standalone toggle pill, e.g. "Verberg voorspelde".
export function TogglePill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-heading font-bold text-sm transition-all active:scale-95 border-2 ${
        active
          ? 'bg-pitch-700 text-white border-gold-400'
          : 'bg-white/10 text-white/70 hover:bg-white/20 border-transparent'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// A small leading label for a control row.
export function ControlLabel({ children }) {
  return (
    <span className="text-white/40 text-xs font-heading flex-shrink-0 uppercase tracking-wide">
      {children}
    </span>
  )
}

// Section header rendered above each group of matches.
export function GroupHeader({ label, count }) {
  return (
    <div className="flex items-center gap-3 mt-5 mb-2 first:mt-0">
      <h3 className="font-heading font-bold text-white/70 text-xs uppercase tracking-wider flex-shrink-0">
        {label}
      </h3>
      {count != null && <span className="text-white/30 text-xs font-heading">{count}</span>}
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}
