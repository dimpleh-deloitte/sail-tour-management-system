// Tour Request No. / Control No. generation.
// SSoT §25: the exact format is explicitly TBD ("do not invent"). This
// module isolates the placeholder format behind one function per identifier
// so the real format can be substituted later without touching any caller.
// The placeholder format is clearly non-final and logged as such.

export function generateRequestNumber(sequenceValue: number, financialYear: string): string {
  // Placeholder format: TR-<FY>-<seq>. NOT a confirmed business format.
  return `TR-${financialYear}-${String(sequenceValue).padStart(6, "0")}`;
}

export function generateControlNumber(sequenceValue: number, financialYear: string): string {
  // Placeholder format: CN-<FY>-<seq>. NOT a confirmed business format.
  return `CN-${financialYear}-${String(sequenceValue).padStart(6, "0")}`;
}

export function currentFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed; April = 3
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}
