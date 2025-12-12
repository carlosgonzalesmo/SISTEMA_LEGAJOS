"use strict";
// Backend legajo helpers for code normalization and DNI/CE validation.
// Must remain aligned with frontend version (applegajos/src/lib/legajo.ts).
// Padding rationale: storing codes as Letter-#### guarantees lexicographic
// order equals numeric order for simple ORDER BY queries and predictable
// pagination without casting.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCodigo = normalizeCodigo;
exports.paddedCodigo = paddedCodigo;
exports.validateCodigo = validateCodigo;
exports.validateDniCe = validateDniCe;
function normalizeCodigo(raw) {
    if (!raw)
        return '';
    const upper = raw.toUpperCase().trim();
    const m = upper.match(/^([A-Z])-(\d+)$/);
    if (!m)
        return upper;
    const letter = m[1];
    const number = m[2].replace(/^0+/, '') || '0';
    return `${letter}-${number}`;
}
function paddedCodigo(raw) {
    const normalized = normalizeCodigo(raw);
    const m = normalized.match(/^([A-Z])-(\d+)$/);
    if (!m)
        return normalized;
    const letter = m[1];
    const num = parseInt(m[2], 10);
    return `${letter}-${num.toString().padStart(4, '0')}`;
}
function validateCodigo(raw) {
    const normalized = normalizeCodigo(raw);
    const m = normalized.match(/^([A-Z])-(\d+)$/);
    if (!m)
        return { valid: false, error: 'INVALID_FORMAT' };
    return { valid: true, normalized, padded: paddedCodigo(normalized) };
}
function validateDniCe(value) {
    if (!value)
        return { valid: true }; // optional field
    const v = value.trim();
    if (/^\d{8}$/.test(v) || /^\d{12}$/.test(v))
        return { valid: true };
    return { valid: false, error: 'INVALID_DNI_CE_FORMAT' };
}
