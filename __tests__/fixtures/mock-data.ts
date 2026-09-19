// Mock data for testing
export const mockGuest = {
  id: 'guest-1',
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  address: '123 Main St',
  city: 'New York',
  country: 'USA',
  zipCode: '10001',
  idNumber: 'ID123456',
  createdAt: new Date('2024-01-01'),
};

export const mockRoom = {
  id: 'room-1',
  number: '101',
  floor: 1,
  status: 'AVAILABLE',
  notes: '',
  roomTypeId: 'rt-1',
  createdAt: new Date('2024-01-01'),
  roomType: {
    id: 'rt-1',
    name: 'Deluxe',
    baseRate: 150.0,
    maxOccupancy: 2,
    description: 'Luxury room',
    amenities: [],
    createdAt: new Date('2024-01-01'),
  },
};

export const mockReservation = {
  id: 'res-1',
  code: 'RES001',
  guestId: 'guest-1',
  checkInDate: new Date('2024-01-10'),
  checkOutDate: new Date('2024-01-15'),
  numberOfGuests: 2,
  numberOfRooms: 1,
  status: 'CONFIRMED',
  notes: '',
  createdAt: new Date('2024-01-01'),
  guest: mockGuest,
  rooms: [
    {
      id: 'res-room-1',
      reservationId: 'res-1',
      roomId: 'room-1',
      room: mockRoom,
    },
  ],
  folios: [],
};

export const mockFolio = {
  id: 'folio-1',
  reservationId: 'res-1',
  guestId: 'guest-1',
  isClosed: false,
  total: 0,
  paidAmount: 0,
  balanceDue: 0,
  createdAt: new Date('2024-01-10'),
  lineItems: [],
  payments: [],
};

export const mockUser = {
  id: 'user-1',
  name: 'Staff Member',
  email: 'staff@example.com',
  role: 'STAFF',
  isActive: true,
  createdAt: new Date('2024-01-01'),
};

export const mockCheckIn = {
  guestId: 'guest-1',
  reservationId: 'res-1',
  roomId: 'room-1',
  checkInTime: new Date(),
};

export const mockCheckOut = {
  reservationId: 'res-1',
  checkOutTime: new Date(),
  folioId: 'folio-1',
};

export const mockPayment = {
  id: 'pay-1',
  folioId: 'folio-1',
  amount: 750.0,
  paymentMethod: 'CREDIT_CARD',
  reference: 'TXN123',
  status: 'COMPLETED',
  createdAt: new Date(),
};

export const mockHousekeepingTask = {
  id: 'task-1',
  roomId: 'room-1',
  status: 'PENDING',
  priority: 'NORMAL',
  notes: 'Clean room',
  assigneeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  room: mockRoom,
  assignee: null,
};

export const mockMaintenanceTicket = {
  id: 'ticket-1',
  roomId: 'room-1',
  title: 'Fix AC',
  description: 'Air conditioner not working',
  priority: 'HIGH',
  status: 'OPEN',
  cost: 150.0,
  assigneeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  room: mockRoom,
  assignee: null,
};
