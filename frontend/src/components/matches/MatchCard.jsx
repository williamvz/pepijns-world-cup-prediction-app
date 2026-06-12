import React from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import CountdownTimer from '../common/CountdownTimer'

function pointsBadge(points) {
  if (points === null || points === undefined) return null
  if (points >= 5) return { label: `+${points} exact!`, cls: 'bg-green-600 text-white' }
  if (points >= 3) return { label: `+${points} goed`, cls: 'bg-teal-600 text-white' }
  if (points >= 2) return { label: `+${points} winnaar`, cls: 'bg-blue-600 text-white' }
  if (points === 1) return { label: '+1 pt', cls: 'bg-indigo-600 text-white' }
  return { label: '0 pt', cls: 'bg-gray-600 text-white' }
}

function scoreResultBg(match, prediction) {
  if (!prediction || match.status !== 'finished') return ''
  const pts = prediction.points
  if (pts >= 5) return 'border-green-500/50 bg-green-500/10'
  if (pts >= 2) return 'border-blue-500/50 bg-blue-500/10'
  return 'border-red-500/20 bg-red-500/5'
}

export default function MatchCard({ match, prediction, onPredict }) {
  const matchDate = new Date(match.match_datetime)
  const isLocked = match.is_locked || match.locked
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live' || match.status === 'bezig'
  const hasPrediction = prediction && (prediction.predicted_home !== null && prediction.predicted_home !== undefined)

  const badge = hasPrediction && isFinished ? pointsBadge(prediction.points) : null

  const homeFlag = match.home_flag || ''
  const awayFlag = match.away_flag || ''

  return (
    <div
      className={`card p-4 transition-all ${isFinished && hasPrediction ? scoreResultBg(match, prediction) : ''} ${isLive ? 'border-gold-500/50 bg-gold-500/5' : ''}`}
    >
      {/* Header: phase/group + date */}
      <div className="flex items-center justify-between mb-3 text-xs text-white/40 font-heading">
        <span>{match.phase || match.round || 'Groepsfase'} {match.group ? `· Groep ${match.group}` : ''}</span>
        <span>{format(matchDate, 'EEE d MMM · HH:mm', { locale: nl })}</span>
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-3xl leading-none">{homeFlag}</span>
          <span className="font-heading font-bold text-sm text-white text-center leading-tight">
            {match.home_team}
          </span>
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center min-w-[80px]">
          {isFinished ? (
            <div className="flex items-center gap-1">
              <span className="text-2xl font-heading font-black text-white">{match.home_score}</span>
              <span className="text-white/40 font-heading font-bold text-lg">-</span>
              <span className="text-2xl font-heading font-black text-white">{match.away_score}</span>
            </div>
          ) : isLive ? (
            <div className="flex items-center gap-1">
              <span className="text-xl font-heading font-black text-gold-400">{match.home_score ?? 0}</span>
              <span className="text-gold-400/60 font-heading font-bold">-</span>
              <span className="text-xl font-heading font-black text-gold-400">{match.away_score ?? 0}</span>
            </div>
          ) : (
            <span className="text-white/40 font-heading font-bold text-xl">VS</span>
          )}

          {isLive && (
            <span className="text-xs font-heading font-bold text-gold-400 animate-pulse mt-0.5">LIVE</span>
          )}

          {!isFinished && !isLive && (
            <CountdownTimer targetDate={match.match_datetime} className="text-xs mt-0.5" />
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-3xl leading-none">{awayFlag}</span>
          <span className="font-heading font-bold text-sm text-white text-center leading-tight">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Venue */}
      {match.venue && (
        <div className="text-center text-xs text-white/30 mt-2">{match.venue}</div>
      )}

      {/* Prediction row */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
        {hasPrediction ? (
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs font-heading">Jouw voorspelling:</span>
            <span className="font-heading font-bold text-sm text-white">
              {prediction.predicted_home} - {prediction.predicted_away}
            </span>
            {badge && (
              <span className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
        ) : isLocked ? (
          <div className="flex items-center gap-2 text-white/30 text-xs font-heading">
            <span>🔒</span>
            <span>{isFinished ? 'Geen voorspelling' : 'Gesloten'}</span>
          </div>
        ) : (
          <span className="text-white/30 text-xs font-heading">Nog geen voorspelling</span>
        )}

        {!isLocked && !isFinished && !isLive && onPredict && (
          <button
            className="btn-primary text-sm py-1.5 px-4 ml-auto"
            onClick={() => onPredict(match)}
          >
            {hasPrediction ? 'Aanpassen' : 'Voorspel'}
          </button>
        )}

        {isLocked && !isFinished && !hasPrediction && !isLive && (
          <span className="text-white/20 text-lg ml-auto">❓</span>
        )}
      </div>
    </div>
  )
}
