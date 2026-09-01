// Shared between lib/monitoring.ts (sets this) and useAlertStore.ts (checks
// it before syncing) -- lives in its own file with no other imports so
// both sides can reference the exact same string with zero circular-import
// risk (monitoring.ts already imports useAlertStore).
//
// Distinguishes a genuine analysis FAILURE (the vision call errored or
// returned nothing usable) from a legitimate "nothing to see" state
// (covered lens, backgrounded) -- only the former gets suppressed from a
// guardian's dashboard, since it carries zero information about the
// ward's actual situation and would otherwise show up looking exactly
// like a real "all clear" reading.
export const NO_ANALYSIS_SUMMARY = "No visual analysis available.";
