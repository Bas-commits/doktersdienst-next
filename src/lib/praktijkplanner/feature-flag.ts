/**
 * Keep the new module deployable before all groups are ready. It is enabled by
 * default outside production so development and test environments remain usable;
 * production requires an explicit public opt-in.
 */
export function isPraktijkplannerEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_PRAKTIJKPLANNER_ENABLED === 'true' ||
    process.env.NODE_ENV !== 'production'
  );
}
