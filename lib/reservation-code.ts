export function nextReservationCode(year: number, existingCodes: readonly string[]): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Reservation year is invalid.");
  }

  const prefix = `RES-${year}-`;
  let highestSequence = 0;

  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;

    const suffix = code.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;

    const sequence = Number(suffix);
    if (Number.isSafeInteger(sequence) && sequence > highestSequence) {
      highestSequence = sequence;
    }
  }

  const nextSequence = highestSequence + 1;
  if (!Number.isSafeInteger(nextSequence)) {
    throw new Error("Reservation code sequence is exhausted.");
  }

  return `${prefix}${String(nextSequence).padStart(5, "0")}`;
}
