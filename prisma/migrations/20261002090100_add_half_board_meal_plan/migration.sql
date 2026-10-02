-- Adds Half Board to the meal plans the hotel can sell.
-- Safe to run on a live database: it only widens the allowed values. The
-- existing rows and tariffs are untouched.
ALTER TYPE "MealPlan" ADD VALUE 'HALF_BOARD';
