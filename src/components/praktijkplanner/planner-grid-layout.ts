export const PLANNER_MONTH_NAV_HEIGHT_PX = 40;
export const PLANNER_WEEK_IN_MONTH_NAV_HEIGHT_PX = 33;
export const PLANNER_GRID_NAV_GAP_PX = 8;
export const PLANNER_GRID_NAV_MARGIN_PX = 16;
export const PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX = 56;

export function plannerWeekGridNavOffsetPx() {
  return (
    PLANNER_MONTH_NAV_HEIGHT_PX +
    PLANNER_WEEK_IN_MONTH_NAV_HEIGHT_PX +
    PLANNER_GRID_NAV_GAP_PX +
    PLANNER_GRID_NAV_MARGIN_PX
  );
}

export function plannerMonthGridNavOffsetPx() {
  return PLANNER_MONTH_NAV_HEIGHT_PX + PLANNER_GRID_NAV_MARGIN_PX;
}
