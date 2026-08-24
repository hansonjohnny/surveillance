// Tags a session's dense GPS breadcrumb trail with the AI risk level known at
// each point in time. Monitoring-cycle events are much sparser than the
// continuous GPS watcher, so each breadcrumb inherits the most recent score.

import type { Event, LocationPoint, RiskPathPoint } from "../types";

export function buildRiskTaggedPath(
  locationHistory: LocationPoint[],
  events: Event[],
  sessionId: string | null,
): RiskPathPoint[] {
  if (locationHistory.length === 0) return [];

  const sessionEvents = events
    .filter((e) => e.sessionId === sessionId)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  let eventIdx = 0;
  let currentRisk: RiskPathPoint["riskLevel"] = null;

  return locationHistory.map((point) => {
    while (
      eventIdx < sessionEvents.length &&
      sessionEvents[eventIdx].timestamp <= point.timestamp
    ) {
      currentRisk = sessionEvents[eventIdx].riskLevel;
      eventIdx++;
    }
    return { ...point, riskLevel: currentRisk };
  });
}

export function countRisks(path: RiskPathPoint[]) {
  const counts = { low: 0, medium: 0, high: 0 };
  for (const p of path) {
    if (p.riskLevel) counts[p.riskLevel]++;
  }
  return counts;
}
