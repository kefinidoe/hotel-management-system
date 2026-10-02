import { describe, it, expect } from 'vitest';
import {
  cleanupMode,
  formatImpact,
  hasRealActivity,
  isDestructiveCleanupAllowed,
  type CleanupImpact,
} from '@/lib/seed-guard';

/**
 * The placeholder-room cleanup in prisma/seed.ts deletes reservations, folios,
 * orders and payments. These tests lock in the rule that stops it from running
 * against a database that holds real activity.
 */

const empty: CleanupImpact = {
  rooms: 0,
  reservations: 0,
  folios: 0,
  payments: 0,
  orders: 0,
  folioItems: 0,
  housekeepingTasks: 0,
  maintenanceTickets: 0,
  paidTotal: 0,
};

const impact = (overrides: Partial<CleanupImpact> = {}): CleanupImpact => ({ ...empty, ...overrides });

describe('placeholder-room cleanup guard', () => {
  describe('hasRealActivity', () => {
    it('is false for rooms with nothing attached', () => {
      expect(hasRealActivity(impact({ rooms: 2 }))).toBe(false);
    });

    it('is false for housekeeping and maintenance alone', () => {
      expect(hasRealActivity(impact({ rooms: 2, housekeepingTasks: 3, maintenanceTickets: 1 }))).toBe(false);
    });

    it.each([
      ['a reservation', { reservations: 1 }],
      ['a folio', { folios: 1 }],
      ['a payment', { payments: 1 }],
      ['an order', { orders: 1 }],
      ['a folio item', { folioItems: 1 }],
    ])('is true when there is %s', (_label, partial) => {
      expect(hasRealActivity(impact(partial as Partial<CleanupImpact>))).toBe(true);
    });
  });

  describe('cleanupMode', () => {
    it('cleans up placeholder rooms that were never used', () => {
      expect(cleanupMode(impact({ rooms: 2 }), false)).toBe('clean');
    });

    it('blocks the cleanup once money or bookings are attached', () => {
      const used = impact({ rooms: 2, reservations: 1, folios: 1, payments: 1, paidTotal: 12000 });
      expect(cleanupMode(used, false)).toBe('blocked');
    });

    it('blocks the cleanup on a single payment alone', () => {
      expect(cleanupMode(impact({ rooms: 1, payments: 1 }), false)).toBe('blocked');
    });

    it('proceeds when the operator sets the override', () => {
      const used = impact({ rooms: 2, payments: 5, paidTotal: 45000 });
      expect(cleanupMode(used, true)).toBe('overridden');
    });
  });

  describe('isDestructiveCleanupAllowed', () => {
    it.each(['true', 'TRUE', '1', 'yes', ' true '])('accepts %s', (value) => {
      expect(isDestructiveCleanupAllowed(value)).toBe(true);
    });

    it.each([undefined, '', 'false', 'no', '0', 'tru'])('rejects %s', (value) => {
      expect(isDestructiveCleanupAllowed(value)).toBe(false);
    });
  });

  describe('formatImpact', () => {
    it('reports what would be deleted, in plain language', () => {
      const report = formatImpact(
        impact({ rooms: 2, reservations: 3, folios: 3, payments: 5, orders: 2, folioItems: 4, paidTotal: 45000 }),
        ['101', '102']
      );
      const text = report.join('\n');

      expect(text).toContain('2 rooms on the placeholder tariffs: 101, 102');
      expect(text).toContain('3 reservations');
      expect(text).toContain('5 payments');
      expect(text).toContain('45,000');
    });

    it('uses singular wording for one of something', () => {
      const text = formatImpact(impact({ rooms: 1, payments: 1, paidTotal: 3500 }), ['101']).join('\n');
      expect(text).toContain('1 room on the placeholder tariffs');
      expect(text).toContain('1 payment');
      expect(text).not.toContain('1 payments');
    });
  });
});
