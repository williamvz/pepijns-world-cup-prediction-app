import React from 'react'
import Avatar from '../common/Avatar'

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_BG = [
  'bg-yellow-500/20 border-yellow-500/30',
  'bg-gray-400/20 border-gray-400/30',
  'bg-amber-700/20 border-amber-700/30',
]

// One badge per bonus category (champion/topscorer). Hidden entirely when the
// player never submitted a pick; otherwise colored by outcome so "pending" is
// visually distinct from "wrong" — green = correct, dim = wrong, gold = not
// evaluated yet.
function BonusBadge({ icon, pick, correct }) {
  if (pick == null) return null
  const colorClass = correct === 1 ? 'text-green-400' : correct === 0 ? 'text-white/25' : 'text-gold-400/80'
  const stateLabel = correct === 1 ? '✓ correct' : correct === 0 ? '✗ fout' : 'nog niet beoordeeld'
  return (
    <span className={`text-xs ${colorClass}`} title={`${pick} — ${stateLabel}`}>
      {icon}
    </span>
  )
}

export default function LeaderboardTable({ entries = [], currentUserId, onCompare }) {
  if (!entries.length) {
    return (
      <div className="text-center text-white/40 py-12 font-heading">
        Nog geen scores beschikbaar
      </div>
    )
  }

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div>
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 mb-6 px-2">
        {[1, 0, 2].map((i) => {
          const entry = podium[i]
          if (!entry) return <div key={i} className="w-24" />
          const isMe = entry.user_id === currentUserId || entry.id === currentUserId
          const canCompare = onCompare && !isMe

          return (
            <div
              key={entry.user_id || entry.id}
              className={`flex flex-col items-center ${i === 0 ? 'order-2 scale-105' : i === 1 ? 'order-1' : 'order-3'}`}
            >
              <div className="text-2xl mb-1">{MEDALS[i]}</div>
              <Avatar avatar={entry.avatar} size={i === 0 ? 'lg' : 'md'} />
              <button
                type="button"
                disabled={!canCompare}
                onClick={canCompare ? () => onCompare(entry) : undefined}
                className={`mt-2 rounded-xl border p-3 text-center ${PODIUM_BG[i]} ${isMe ? 'ring-2 ring-gold-400' : ''} ${canCompare ? 'cursor-pointer hover:brightness-125 transition-all active:scale-95' : 'cursor-default'}`}
                style={{ minWidth: 72 }}
                title={canCompare ? 'Vergelijk' : ''}
              >
                <div className="font-heading font-bold text-xs text-white truncate max-w-[72px]">
                  {entry.username}
                </div>
                <div className="font-heading font-black text-lg text-gold-400">
                  {entry.total_points ?? entry.points ?? 0}
                </div>
                <div className="text-white/40 text-xs">{canCompare ? 'vergelijk ⚖️' : 'punten'}</div>
                {(entry.champion_pick != null || entry.topscorer_pick != null) && (
                  <div className="flex gap-1 justify-center mt-1">
                    <BonusBadge icon="🏆" pick={entry.champion_pick} correct={entry.champion_correct} />
                    <BonusBadge icon="⚽" pick={entry.topscorer_pick} correct={entry.topscorer_correct} />
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Rest of the table (ranks 4+; top 3 are shown on the podium above) */}
      <div className="space-y-2">
        {rest.map((entry, idx) => {
          const rank = idx + 4
          const isMe = entry.user_id === currentUserId || entry.id === currentUserId
          const change = entry.rank_change || 0

          return (
            <div
              key={entry.user_id || entry.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isMe
                  ? 'bg-gold-500/15 border-gold-500/30'
                  : 'bg-pitch-800/60 border-white/10 hover:bg-white/5'
              }`}
            >
              {/* Rank */}
              <div className="w-7 text-center font-heading font-bold text-sm text-white/60">
                {rank <= 3 ? MEDALS[rank - 1] : <span className="text-white/40">#{rank}</span>}
              </div>

              {/* Avatar */}
              <Avatar avatar={entry.avatar} size="sm" />

              {/* Name + team */}
              <div className="flex-1 min-w-0">
                <div className={`font-heading font-bold text-sm truncate ${isMe ? 'text-gold-400' : 'text-white'}`}>
                  {entry.username} {isMe && <span className="text-xs font-medium">(jij)</span>}
                </div>
                {entry.favorite_team && (
                  <div className="text-white/30 text-xs">{entry.favorite_team}</div>
                )}
              </div>

              {/* Rank change */}
              <div className="text-sm w-5 text-center">
                {change > 0 && <span className="text-green-400">▲</span>}
                {change < 0 && <span className="text-red-400">▼</span>}
                {change === 0 && <span className="text-white/20">—</span>}
              </div>

              {/* Stats */}
              <div className="text-right">
                <div className={`font-heading font-black text-base ${isMe ? 'text-gold-400' : 'text-white'}`}>
                  {entry.total_points ?? entry.points ?? 0}
                </div>
                <div className="text-white/40 text-xs flex items-center gap-1 justify-end">
                  <span>{entry.exact_count ?? 0}✓ {entry.winner_count ?? 0}⚽</span>
                  <BonusBadge icon="🏆" pick={entry.champion_pick} correct={entry.champion_correct} />
                  <BonusBadge icon="⚽" pick={entry.topscorer_pick} correct={entry.topscorer_correct} />
                </div>
              </div>

              {/* Compare button */}
              {onCompare && !isMe && (
                <button
                  className="text-white/30 hover:text-gold-400 transition-colors ml-1 text-lg"
                  onClick={() => onCompare(entry)}
                  title="Vergelijk"
                >
                  ⚖️
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
