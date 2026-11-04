import { describe, expect, it } from 'vitest';
import {
  plannerMonthGridNavOffsetPx,
  plannerWeekGridNavOffsetPx,
} from './planner-grid-layout';

describe('planner grid layout offsets', () => {
  it('matches the fixed month and week navigation heights', () => {
    expect(plannerWeekGridNavOffsetPx()).toBe(97);
    expect(plannerMonthGridNavOffsetPx()).toBe(56);
  });
});
