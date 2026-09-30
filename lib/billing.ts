const MAX_MONEY = 99_999_999.99;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseMoney(
  raw: unknown,
  label: string,
  { allowZero = false }: { allowZero?: boolean } = {}
): number {
  if (
    (typeof raw !== "number" && typeof raw !== "string") ||
    (typeof raw === "string" && raw.trim() === "")
  ) {
    throw new Error(`${label} must be a valid amount.`);
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label} must be ${allowZero ? "zero or a positive amount" : "greater than zero"}.`);
  }
  if (value > MAX_MONEY) {
    throw new Error(`${label} is too large.`);
  }

  const rounded = roundMoney(value);
  if (Math.abs(value - rounded) > 0.000001) {
    throw new Error(`${label} cannot have more than two decimal places.`);
  }
  return rounded;
}

export function folioTotals(itemTotals: readonly number[], completedPayments: readonly number[]) {
  const required = roundMoney(itemTotals.reduce((sum, amount) => sum + amount, 0));
  const paid = roundMoney(completedPayments.reduce((sum, amount) => sum + amount, 0));
  return { required, paid, balance: roundMoney(required - paid) };
}

export function stayNights(checkIn: Date, checkOut: Date): number {
  const milliseconds = checkOut.getTime() - checkIn.getTime();
  const nights = milliseconds / 86_400_000;
  if (!Number.isFinite(milliseconds) || !Number.isInteger(nights) || nights < 1) {
    throw new Error("Check-in and check-out must define one or more whole nights.");
  }
  return nights;
}

export function accommodationRequired(
  nightlyRates: readonly number[],
  nights: number,
  discount = 0
): number {
  if (
    !Number.isInteger(nights) ||
    nights < 1 ||
    nightlyRates.length === 0 ||
    nightlyRates.some((rate) => !Number.isFinite(rate) || rate < 0)
  ) {
    throw new Error("The reservation accommodation charges are invalid.");
  }

  const roomCharges = roundMoney(
    nightlyRates.reduce((sum, rate) => sum + roundMoney(rate * nights), 0)
  );
  const safeDiscount = roundMoney(discount);
  if (!Number.isFinite(safeDiscount) || safeDiscount < 0) {
    throw new Error("The reservation discount is invalid.");
  }
  if (safeDiscount > roomCharges) {
    throw new Error("The reservation discount cannot exceed the accommodation charge.");
  }
  return roundMoney(roomCharges - safeDiscount);
}
