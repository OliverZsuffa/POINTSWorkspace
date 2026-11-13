import type { Sequence, SequenceDecodeResult } from '../../domain/model';
import type { SequenceCodec } from '../../contracts';

const PREFIX = 'P1.';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid code characters');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function compress(input: string): Uint8Array {
  const bytes = new TextEncoder().encode(input);
  if (!bytes.length) return new Uint8Array();
  const dictionary = new Map<string, number>();
  let next = 256;
  let phrase = String.fromCharCode(bytes[0]!);
  const codes: number[] = [];
  for (let index = 1; index < bytes.length; index += 1) {
    const character = String.fromCharCode(bytes[index]!);
    const combined = phrase + character;
    if (dictionary.has(combined)) phrase = combined;
    else {
      codes.push(phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase)!);
      if (next < 65535) dictionary.set(combined, next++);
      phrase = character;
    }
  }
  codes.push(phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase)!);
  const output = new Uint8Array(codes.length * 2);
  codes.forEach((code, index) => {
    output[index * 2] = code >>> 8;
    output[index * 2 + 1] = code & 255;
  });
  return output;
}

function decompress(bytes: Uint8Array): string {
  if (bytes.length % 2 !== 0) throw new Error('Invalid compressed payload');
  const codes = Array.from({ length: bytes.length / 2 }, (_, index) => bytes[index * 2]! * 256 + bytes[index * 2 + 1]!);
  if (!codes.length) return '';
  const dictionary = new Map<number, Uint8Array>();
  for (let index = 0; index < 256; index += 1) dictionary.set(index, Uint8Array.of(index));
  let next = 256;
  let previous = dictionary.get(codes[0]!);
  if (!previous) throw new Error('Invalid compressed payload');
  const output: number[] = [...previous];
  for (const code of codes.slice(1)) {
    const entry = dictionary.get(code) ?? (code === next ? Uint8Array.from([...previous, previous[0]!]) : undefined);
    if (!entry) throw new Error('Invalid compressed payload');
    output.push(...entry);
    if (next < 65535) dictionary.set(next++, Uint8Array.from([...previous, entry[0]!]));
    previous = entry;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(output));
}

function isSequence(value: unknown): value is Sequence {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Sequence>;
  return typeof item.id === 'string'
    && ['solo', 'circle-passing', 'individual-passing'].includes(String(item.sequenceType))
    && typeof item.bpm === 'number'
    && !!item.timeSignature && Array.isArray(item.beats)
    && Array.isArray(item.performers) && Array.isArray(item.positions)
    && Array.isArray(item.balls) && !!item.initialState
    && Array.isArray(item.initialState.placements)
    && Array.isArray(item.notation) && !!item.tableLayout
    && Array.isArray(item.seatAssignments);
}

export const sequenceCodec: SequenceCodec = {
  encode(sequence) {
    const payload = JSON.stringify(sequence);
    return PREFIX + toBase64Url(compress(payload));
  },
  decode(code): SequenceDecodeResult {
    const trimmed = code.trim();
    if (!trimmed.startsWith('P')) return { ok: false, code: 'malformed', message: 'This is not a POINTS sequence code.' };
    if (!trimmed.startsWith(PREFIX)) return { ok: false, code: 'unsupported-version', message: 'This sequence code uses an unsupported format version.' };
    try {
      const payload = decompress(fromBase64Url(trimmed.slice(PREFIX.length)));
      const parsed: unknown = JSON.parse(payload);
      if (!isSequence(parsed)) return { ok: false, code: 'invalid-data', message: 'The code does not contain a complete POINTS sequence.' };
      return { ok: true, sequence: parsed };
    } catch {
      return { ok: false, code: 'malformed', message: 'The sequence code is damaged or incomplete.' };
    }
  },
};

export function isSequenceCode(value: string): boolean {
  return value.trim().startsWith(PREFIX);
}
