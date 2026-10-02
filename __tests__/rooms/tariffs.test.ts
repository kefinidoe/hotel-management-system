import { describe, it, expect } from 'vitest';
import {
  findTariff,
  MEAL_PLANS,
  OCCUPANCIES,
  tariffCategory,
  tariffMatches,
} from '@/lib/tariffs';

/**
 * Twin is now an occupancy any room can be sold at, and Half Board is a meal
 * plan the hotel sells. These tests pin the rules that price a booking, because
 * the API refuses anything that does not match.
 */

// The nine tariffs the seed creates.
const TARIFFS = [
  { id: 'tariff-single-bo', name: 'Single — Bed Only', mealPlan: 'BED_ONLY' },
  { id: 'tariff-single-bb', name: 'Single — B&B', mealPlan: 'BED_AND_BREAKFAST' },
  { id: 'tariff-single-hb', name: 'Single — Half Board', mealPlan: 'HALF_BOARD' },
  { id: 'tariff-double-bo', name: 'Double — Bed Only', mealPlan: 'BED_ONLY' },
  { id: 'tariff-double-bb', name: 'Double — B&B', mealPlan: 'BED_AND_BREAKFAST' },
  { id: 'tariff-double-hb', name: 'Double — Half Board', mealPlan: 'HALF_BOARD' },
  { id: 'tariff-triple-bo', name: 'Twin — Bed Only', mealPlan: 'BED_ONLY' },
  { id: 'tariff-triple-bb', name: 'Twin — B&B', mealPlan: 'BED_AND_BREAKFAST' },
  { id: 'tariff-triple-hb', name: 'Twin — Half Board', mealPlan: 'HALF_BOARD' },
];

describe('occupancy and meal plans', () => {
  it('offers twin as an occupancy alongside single and double', () => {
    expect(OCCUPANCIES).toEqual(['SINGLE', 'DOUBLE', 'TWIN']);
  });

  it('offers half board alongside bed only and bed & breakfast', () => {
    expect(MEAL_PLANS).toEqual(['BED_ONLY', 'BED_AND_BREAKFAST', 'HALF_BOARD']);
  });

  it.each([
    ['SINGLE', 'Single'],
    ['DOUBLE', 'Double'],
    ['TWIN', 'Twin'],
  ] as const)('prices %s bookings from the %s tariff family', (occupancy, category) => {
    expect(tariffCategory(occupancy)).toBe(category);
  });
});

describe('tariff matching', () => {
  it('matches every occupancy and meal plan to exactly one tariff', () => {
    for (const occupancy of OCCUPANCIES) {
      for (const mealPlan of MEAL_PLANS) {
        const matches = TARIFFS.filter((tariff) =>
          tariffMatches(tariff.name, tariff.mealPlan, occupancy, mealPlan)
        );
        expect(matches).toHaveLength(1);
      }
    }
  });

  it('prices a twin half-board booking from the twin half-board tariff', () => {
    expect(findTariff(TARIFFS, 'TWIN', 'HALF_BOARD')?.id).toBe('tariff-triple-hb');
  });

  it('prices a single half-board booking from the single half-board tariff', () => {
    expect(findTariff(TARIFFS, 'SINGLE', 'HALF_BOARD')?.id).toBe('tariff-single-hb');
  });

  it('refuses a tariff whose meal plan is wrong for the booking', () => {
    expect(tariffMatches('Double — Bed Only', 'BED_ONLY', 'DOUBLE', 'HALF_BOARD')).toBe(false);
  });

  it('refuses a tariff from the wrong occupancy family', () => {
    expect(tariffMatches('Single — Half Board', 'HALF_BOARD', 'DOUBLE', 'HALF_BOARD')).toBe(false);
  });

  it('does not accept a tariff that has no meal plan set', () => {
    // A room type added from the Rooms screen with no meal plan can never price
    // a booking; matching must not fall back to it silently.
    expect(tariffMatches('Single', null, 'SINGLE', 'BED_ONLY')).toBe(false);
  });

  it('finds nothing when the hotel has not set up that combination', () => {
    const onlyBedOnly = TARIFFS.filter((tariff) => tariff.mealPlan === 'BED_ONLY');
    expect(findTariff(onlyBedOnly, 'DOUBLE', 'HALF_BOARD')).toBeUndefined();
  });
});
