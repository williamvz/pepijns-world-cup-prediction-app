// Normalize API match objects to a flat structure all components expect
export function normalizeMatch(m) {
  if (!m) return m
  const homeTeam = m.home_team
  const awayTeam = m.away_team
  return {
    ...m,
    // Flat team fields (components use these directly)
    home_team: typeof homeTeam === 'object' ? homeTeam?.name : homeTeam,
    home_flag: typeof homeTeam === 'object' ? homeTeam?.flag_emoji : (m.home_flag || ''),
    home_code: typeof homeTeam === 'object' ? homeTeam?.code : m.home_code,
    away_team: typeof awayTeam === 'object' ? awayTeam?.name : awayTeam,
    away_flag: typeof awayTeam === 'object' ? awayTeam?.flag_emoji : (m.away_flag || ''),
    away_code: typeof awayTeam === 'object' ? awayTeam?.code : m.away_code,
    // Consistent date field
    match_datetime: m.match_datetime || m.match_date || m.datetime,
    // Flat phase / group fields
    phase: m.phase_name || m.phase || 'Groepsfase',
    group: m.group_name || m.group || '',
    // Locked flag
    locked: m.is_locked ?? m.locked ?? false,
  }
}

export function normalizeMatches(data) {
  if (!data) return data
  // data can be { matches: [{phase_name, groups: [{matches: [...]}]}] } or flat array
  if (Array.isArray(data)) return data.map(normalizeMatch)
  if (data.matches) {
    return {
      ...data,
      matches: data.matches.map(phase => ({
        ...phase,
        groups: phase.groups?.map(group => ({
          ...group,
          matches: group.matches?.map(normalizeMatch),
        })),
      })),
    }
  }
  return data
}
