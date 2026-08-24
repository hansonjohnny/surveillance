// Connectivity detection — a single source of truth for "can we reach the
// network right now," used to decide whether to send alerts live or queue
// them for retry.

import NetInfo from "@react-native-community/netinfo";

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
}

// Fires onOnline() only on the transition from offline to online — not on
// every network event — so the offline queue is processed once per outage
// rather than repeatedly while the connection is already up.
export function subscribeToConnectivity(onOnline: () => void): () => void {
  let wasOnline: boolean | null = null;

  return NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    if (online && wasOnline === false) {
      onOnline();
    }
    wasOnline = online;
  });
}
