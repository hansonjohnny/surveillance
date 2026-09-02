// Builds a Google Maps "get directions" deep link that traces a recorded
// path, using the first/last points as origin/destination and a handful of
// evenly-sampled points in between as waypoints — opening in the real Google
// Maps app gives a much clearer, familiar view than the custom in-app map.

type LatLng = { lat: number; lng: number };

// Google's directions deep link only reliably supports a small number of
// waypoints — sample down rather than passing every recorded point.
const MAX_WAYPOINTS = 8;

function sampleWaypoints(points: LatLng[]): LatLng[] {
  const middle = points.slice(1, -1);
  if (middle.length <= MAX_WAYPOINTS) return middle;
  const step = middle.length / MAX_WAYPOINTS;
  const sampled: LatLng[] = [];
  for (let i = 0; i < MAX_WAYPOINTS; i++) {
    sampled.push(middle[Math.floor(i * step)]);
  }
  return sampled;
}

export function buildDirectionsUrl(
  points: LatLng[],
  travelMode: "walking" | "driving" = "walking",
): string | null {
  if (points.length < 2) return null;

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = sampleWaypoints(points);

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode,
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((p) => `${p.lat},${p.lng}`).join("|"),
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
