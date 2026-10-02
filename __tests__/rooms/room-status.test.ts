import { describe, it, expect } from 'vitest';
import type { RoomStatus } from '@prisma/client';
import {
  isBookableToday,
  notBookableReason,
  ROOM_STATUSES,
  ROOM_STATUS_LABELS,
  roomStatusClasses,
  roomStatusRank,
  summariseRooms,
} from '@/lib/room-status';

/**
 * The receptionist decides which room to give a guest from what this module
 * says. Two rules matter more than the rest:
 *
 *   1. Every status is shown as a word, never as a colour alone.
 *   2. A room that is dirty, occupied or broken is never offered as bookable.
 */

const ALL: RoomStatus[] = [
  'AVAILABLE',
  'RESERVED',
  'OCCUPIED',
  'DIRTY',
  'CLEANING',
  'READY',
  'MAINTENANCE',
  'OUT_OF_ORDER',
];

describe('room status', () => {
  it('knows about every status the database can hold', () => {
    expect([...ROOM_STATUSES].sort()).toEqual([...ALL].sort());
  });

  it('describes every status in words, not enum codes', () => {
    for (const status of ALL) {
      const label = ROOM_STATUS_LABELS[status];
      expect(label).toBeTruthy();
      expect(label).not.toContain('_');
      expect(label).not.toBe(status);
    }
  });

  it('says why a room cannot be used, in plain words', () => {
    expect(notBookableReason('DIRTY')).toBe('Needs cleaning first.');
    expect(notBookableReason('OCCUPIED')).toBe('A guest is in this room.');
    expect(notBookableReason('MAINTENANCE')).toBe('Under maintenance.');
    expect(notBookableReason('OUT_OF_ORDER')).toBe('Out of order.');
    expect(notBookableReason('AVAILABLE')).toBe('');
  });

  describe('isBookableToday', () => {
    it('offers only free and clean rooms', () => {
      expect(isBookableToday('AVAILABLE')).toBe(true);
      expect(isBookableToday('READY')).toBe(true);
    });

    it.each<RoomStatus>(['RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_ORDER'])(
      'never offers a %s room',
      (status) => {
        expect(isBookableToday(status)).toBe(false);
      }
    );
  });

  it('gives every status a colour class, so the words always have a second cue', () => {
    for (const status of ALL) {
      expect(roomStatusClasses(status)).toMatch(/bg-/);
    }
  });

  it('sorts bookable rooms first and out-of-service rooms last', () => {
    expect(roomStatusRank('AVAILABLE')).toBeLessThan(roomStatusRank('DIRTY'));
    expect(roomStatusRank('DIRTY')).toBeLessThan(roomStatusRank('MAINTENANCE'));
    expect(roomStatusRank('OUT_OF_ORDER')).toBeGreaterThan(roomStatusRank('MAINTENANCE'));
  });

  describe('summariseRooms', () => {
    it('counts what is free and clean for the board summary', () => {
      const summary = summariseRooms([
        { status: 'AVAILABLE' as RoomStatus },
        { status: 'READY' as RoomStatus },
        { status: 'DIRTY' as RoomStatus },
        { status: 'OCCUPIED' as RoomStatus },
        { status: 'DIRTY' as RoomStatus },
      ]);

      expect(summary.total).toBe(5);
      expect(summary.bookable).toBe(2);
      expect(summary.counts.get('DIRTY')).toBe(2);
      expect(summary.counts.get('AVAILABLE')).toBe(1);
    });
  });
});
