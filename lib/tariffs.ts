/**
 * Occupancy and meal-plan rules, shared by the reservation screens and the
 * reservation API so the two cannot drift apart.
 *
 * A booking is priced by picking a room and then choosing who is staying
 * (occupancy) and what meals are included (meal plan). The matching tariff --
 * the RoomType row named "Single — Half Board", for example -- supplies the
 * nightly rate. Rooms themselves carry no tariff restriction.
 */

export const OCCUPANCIES = ["SINGLE", "DOUBLE", "TWIN"] as const;
export type Occupancy = (typeof OCCUPANCIES)[number];

export const MEAL_PLANS = ["BED_ONLY", "BED_AND_BREAKFAST", "HALF_BOARD"] as const;
export type MealPlanCode = (typeof MEAL_PLANS)[number];

export const OCCUPANCY_LABELS: Record<Occupancy, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TWIN: "Twin",
};

export const MEAL_PLAN_LABELS: Record<MealPlanCode, string> = {
  BED_ONLY: "Bed Only",
  BED_AND_BREAKFAST: "Bed & Breakfast",
  HALF_BOARD: "Half Board",
};

export function isOccupancy(value: unknown): value is Occupancy {
  return OCCUPANCIES.includes(value as Occupancy);
}

export function isMealPlan(value: unknown): value is MealPlanCode {
  return MEAL_PLANS.includes(value as MealPlanCode);
}

/**
 * The tariff category a booking falls into: "Single", "Double" or "Twin".
 * The seeded tariff names all start with one of these words.
 */
export function tariffCategory(occupancy: Occupancy): string {
  return OCCUPANCY_LABELS[occupancy];
}

/**
 * Does this tariff belong to the chosen occupancy and meal plan?
 *
 * This is the rule the API enforces, so a tampered request cannot price a Twin
 * booking at the Single rate. It is deliberately name-based because the tariff
 * names are what the hotel maintains.
 */
export function tariffMatches(
  tariffName: string,
  tariffMealPlan: string | null,
  occupancy: Occupancy,
  mealPlan: MealPlanCode
): boolean {
  const category = tariffCategory(occupancy).toLowerCase();
  return tariffName.trim().toLowerCase().startsWith(category) && tariffMealPlan === mealPlan;
}

/** Find the tariff for a booking, or undefined when the hotel has not set one up. */
export function findTariff<T extends { name: string; mealPlan: string | null }>(
  tariffs: T[],
  occupancy: Occupancy,
  mealPlan: MealPlanCode
): T | undefined {
  return tariffs.find((tariff) => tariffMatches(tariff.name, tariff.mealPlan, occupancy, mealPlan));
}
