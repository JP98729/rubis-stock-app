/**
 * Access-code helpers. Codes are always compared after trim + uppercase, and are
 * only ever stored as bcrypt hashes — never in plaintext.
 */

/** Simple per-store access code, e.g. RB004 — derived from the store id. */
export function storeCodeFor(id: number): string {
  return "RB" + String(id).padStart(3, "0");
}

/** Parse a branch code back to a store id, e.g. "rb4" / "RB004" -> 4. */
export function storeIdFromCode(code: string): number | null {
  const m = /^RB0*(\d+)$/i.exec((code || "").trim());
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

/** Alphabet with no 0/O/1/I, to avoid confusion when codes are read out loud. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Random individual code for a merchandiser, e.g. MC-4K7Q.
 * `isTaken` is checked against existing merchandiser codes only — matching the
 * original app, this deliberately does not cross-check role or branch codes.
 */
export async function genMerchCode(isTaken: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code =
      "MC-" +
      Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Could not generate a unique merchandiser code — try again.");
}

export function normalizeCode(code: string): string {
  return (code || "").trim().toUpperCase();
}
