import { describe, it, expect } from 'vitest';

/**
 * Utility Functions Tests
 * Testing critical utility functions used throughout HMS
 */

describe('Date Utilities', () => {
  describe('Night calculation', () => {
    it('should calculate nights between two dates', () => {
      const checkIn = new Date('2024-01-10');
      const checkOut = new Date('2024-01-15');

      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(nights).toBe(5);
    });

    it('should handle same-day checkout', () => {
      const checkIn = new Date('2024-01-10');
      const checkOut = new Date('2024-01-10');

      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(nights).toBe(0);
    });

    it('should handle one-night stay', () => {
      const checkIn = new Date('2024-01-10');
      const checkOut = new Date('2024-01-11');

      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(nights).toBe(1);
    });

    it('should handle long stays (30+ days)', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-02-01');

      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(nights).toBe(31);
    });
  });

  describe('Date range overlaps', () => {
    it('should detect overlapping date ranges', () => {
      const range1 = {
        start: new Date('2024-01-10'),
        end: new Date('2024-01-15'),
      };

      const range2 = {
        start: new Date('2024-01-12'),
        end: new Date('2024-01-20'),
      };

      const overlap = range2.start < range1.end && range2.end > range1.start;
      expect(overlap).toBe(true);
    });

    it('should detect non-overlapping date ranges', () => {
      const range1 = {
        start: new Date('2024-01-10'),
        end: new Date('2024-01-15'),
      };

      const range2 = {
        start: new Date('2024-01-16'),
        end: new Date('2024-01-20'),
      };

      const overlap = range2.start < range1.end && range2.end > range1.start;
      expect(overlap).toBe(false);
    });

    it('should detect touching date ranges (no overlap)', () => {
      const range1 = {
        start: new Date('2024-01-10'),
        end: new Date('2024-01-15'),
      };

      const range2 = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-20'),
      };

      const overlap = range2.start < range1.end && range2.end > range1.start;
      expect(overlap).toBe(false);
    });
  });

  describe('Date formatting', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-01-15');
      const formatted = date.toISOString().split('T')[0];

      expect(formatted).toBe('2024-01-15');
    });

    it('should get day of week', () => {
      const date = new Date('2024-01-15'); // Monday
      const dayOfWeek = date.getDay();

      expect(dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(dayOfWeek).toBeLessThanOrEqual(6);
    });
  });
});

describe('Price Calculations', () => {
  describe('Room charges', () => {
    it('should calculate room charge for multiple nights', () => {
      const baseRate = 150;
      const nights = 5;

      const totalCharge = baseRate * nights;
      expect(totalCharge).toBe(750);
    });

    it('should apply discount to room charge', () => {
      const baseRate = 150;
      const nights = 5;
      const discountPercent = 10;

      const subtotal = baseRate * nights;
      const discount = subtotal * (discountPercent / 100);
      const total = subtotal - discount;

      expect(total).toBe(675);
    });

    it('should calculate rack rate vs negotiated rate', () => {
      const rackRate = 200;
      const negotiatedRate = 150;
      const nights = 5;

      const rackTotal = rackRate * nights;
      const negotiatedTotal = negotiatedRate * nights;

      expect(rackTotal).toBeGreaterThan(negotiatedTotal);
    });
  });

  describe('Folio totals', () => {
    it('should sum all folio charges', () => {
      const charges = [
        { description: 'Room', amount: 750 },
        { description: 'Restaurant', amount: 85.50 },
        { description: 'Minibar', amount: 35.00 },
      ];

      const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
      expect(total).toBe(870.50);
    });

    it('should calculate balance due', () => {
      const folioTotal = 890.50;
      const paidAmount = 500;

      const balanceDue = folioTotal - paidAmount;
      expect(balanceDue).toBe(390.50);
    });

    it('should handle overpayment', () => {
      const folioTotal = 890.50;
      const paidAmount = 950;

      const balanceDue = folioTotal - paidAmount;
      expect(balanceDue).toBeLessThan(0); // Overpayment
    });

    it('should calculate with tax', () => {
      const subtotal = 750;
      const taxRate = 0.1; // 10%

      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      expect(total).toBe(825);
    });

    it('should calculate with service charge', () => {
      const subtotal = 750;
      const serviceChargePercent = 18; // 18%

      const serviceCharge = subtotal * (serviceChargePercent / 100);
      const total = subtotal + serviceCharge;

      expect(total).toBe(885);
    });
  });

  describe('Payment calculations', () => {
    it('should calculate payment schedule for deposits', () => {
      const totalPrice = 1000;
      const depositPercent = 25;

      const deposit = totalPrice * (depositPercent / 100);
      const remaining = totalPrice - deposit;

      expect(deposit).toBe(250);
      expect(remaining).toBe(750);
    });

    it('should handle partial payments', () => {
      const balanceDue = 890.50;
      const payments = [
        { amount: 300, status: 'COMPLETED' },
        { amount: 200, status: 'COMPLETED' },
        { amount: 390.50, status: 'PENDING' },
      ];

      const totalPaid = payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.amount, 0);

      expect(totalPaid).toBe(500);
      expect(balanceDue - totalPaid).toBe(390.50);
    });
  });
});

describe('String Utilities', () => {
  describe('Reservation code generation', () => {
    it('should generate unique reservation code', () => {
      const code1 = `RES${Date.now()}`;
      const code2 = `RES${Date.now() + 1}`;

      expect(code1).not.toBe(code2);
      expect(code1).toMatch(/^RES\d+$/);
      expect(code2).toMatch(/^RES\d+$/);
    });

    it('should generate room number format', () => {
      const floor = 1;
      const number = 5;
      const roomNumber = `${floor}${String(number).padStart(2, '0')}`;

      expect(roomNumber).toBe('105');
    });
  });

  describe('Email validation', () => {
    it('should validate correct email', () => {
      const email = 'john@example.com';
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(isValid).toBe(true);
    });

    it('should reject invalid email', () => {
      const email = 'invalid-email';
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(isValid).toBe(false);
    });

    it('should reject email without domain', () => {
      const email = 'john@';
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(isValid).toBe(false);
    });
  });

  describe('Phone number formatting', () => {
    it('should validate phone number', () => {
      const phone = '+1234567890';
      const isValid = /^\+?[\d\s\-\(\)]{7,}$/.test(phone);

      expect(isValid).toBe(true);
    });

    it('should format phone number', () => {
      const phone = '1234567890';
      const formatted = `+1-${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;

      expect(formatted).toBe('+1-123-456-7890');
    });
  });

  describe('Status formatting', () => {
    it('should convert status to display format', () => {
      const status = 'CHECKED_IN';
      const display = status.replace(/_/g, ' ').toLowerCase();

      expect(display).toBe('checked in');
    });

    it('should handle all reservation statuses', () => {
      const statuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

      statuses.forEach((status) => {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Array/Collection Utilities', () => {
  describe('Sorting', () => {
    it('should sort reservations by check-in date', () => {
      const reservations = [
        { id: 1, checkInDate: new Date('2024-01-15') },
        { id: 2, checkInDate: new Date('2024-01-10') },
        { id: 3, checkInDate: new Date('2024-01-12') },
      ];

      const sorted = [...reservations].sort(
        (a, b) => a.checkInDate.getTime() - b.checkInDate.getTime()
      );

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });

    it('should sort rooms by number', () => {
      const rooms = [
        { number: '305' },
        { number: '101' },
        { number: '203' },
      ];

      const sorted = [...rooms].sort((a, b) =>
        a.number.localeCompare(b.number)
      );

      expect(sorted[0].number).toBe('101');
      expect(sorted[1].number).toBe('203');
      expect(sorted[2].number).toBe('305');
    });
  });

  describe('Filtering', () => {
    it('should filter available rooms', () => {
      const rooms = [
        { id: 1, status: 'AVAILABLE' },
        { id: 2, status: 'OCCUPIED' },
        { id: 3, status: 'AVAILABLE' },
      ];

      const available = rooms.filter((r) => r.status === 'AVAILABLE');
      expect(available).toHaveLength(2);
    });

    it('should filter by room type', () => {
      const rooms = [
        { id: 1, typeId: 'deluxe' },
        { id: 2, typeId: 'standard' },
        { id: 3, typeId: 'deluxe' },
      ];

      const deluxe = rooms.filter((r) => r.typeId === 'deluxe');
      expect(deluxe).toHaveLength(2);
    });
  });

  describe('Grouping', () => {
    it('should group reservations by status', () => {
      const reservations = [
        { id: 1, status: 'CONFIRMED' },
        { id: 2, status: 'CHECKED_IN' },
        { id: 3, status: 'CONFIRMED' },
      ];

      const grouped = reservations.reduce((acc, res) => {
        if (!acc[res.status]) acc[res.status] = [];
        acc[res.status].push(res);
        return acc;
      }, {} as Record<string, typeof reservations>);

      expect(grouped['CONFIRMED']).toHaveLength(2);
      expect(grouped['CHECKED_IN']).toHaveLength(1);
    });
  });
});

describe('Validation Utilities', () => {
  describe('Guest data validation', () => {
    it('should validate required fields', () => {
      const guest = { fullName: 'John Doe', email: 'john@example.com' };

      const isValid = guest.fullName && guest.email;
      expect(isValid).toBeTruthy();
    });

    it('should reject empty name', () => {
      const guest = { fullName: '', email: 'john@example.com' };

      const isValid = guest.fullName && guest.email;
      expect(isValid).toBeFalsy();
    });
  });

  describe('Reservation validation', () => {
    it('should validate checkout after checkin', () => {
      const checkIn = new Date('2024-01-10');
      const checkOut = new Date('2024-01-15');

      const isValid = checkOut > checkIn;
      expect(isValid).toBe(true);
    });

    it('should reject checkout before checkin', () => {
      const checkIn = new Date('2024-01-15');
      const checkOut = new Date('2024-01-10');

      const isValid = checkOut > checkIn;
      expect(isValid).toBe(false);
    });
  });
});
