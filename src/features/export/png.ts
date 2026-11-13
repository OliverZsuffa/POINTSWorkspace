import type { Sequence, NotationEntry } from '../../domain/model';
import { simulateSequence } from '../../domain/state';
import { sequenceCodec } from '../data/codec';

const CELL = 54;
const ROW = 34;
const HEADER = 150;
const FOOTER = 72;
const MAX_HEIGHT = 7600;

export interface PNGExportOptions {
  readonly includeSettings: boolean;
  readonly includePerformerNames: boolean;
  readonly includeCode: boolean;
  readonly includeObjectState: boolean;
}

function targetLabel(entry: NotationEntry, sequence: Sequence): string {
  const action = entry.action;
  if (!('target' in action)) return action.type === 'SPECIAL' ? action.text : action.type;
  const target = action.target;
  if (target.kind === 'position') return sequence.positions.find((position) => position.id === target.positionId)?.name ?? '?';
  if (target.kind === 'circle-position') return target.position + (target.direction ? (target.distance && target.distance > 1 ? target.distance : '') + (target.direction === 'left' ? 'L' : 'R') : '');
  if (target.kind === 'pass-source') return 'X' + (sequence.performers.find((person) => person.id === target.performerId)?.identifier ?? '?');
  return (target.hand === 'left' ? 'L' : 'R') + (sequence.performers.find((person) => person.id === target.performerId)?.identifier ?? '?');
}

function entryText(entry: NotationEntry, sequence: Sequence): string {
  if (entry.action.type === 'ZIP') return 'ZIP';
  if (entry.action.type === 'SPECIAL') return entry.action.text || 'SPECIAL';
  if (entry.action.type === 'HOLD' || entry.action.type === 'EMPTY') return entry.action.type;
  return entry.action.type + ' ' + targetLabel(entry, sequence);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function makeSvg(sequence: Sequence, performers: readonly Sequence['performers'][number][], page: number, pageCount: number, invalidEntries: ReadonlySet<string>, options: PNGExportOptions): string {
  const width = 180 + sequence.beats.length * CELL;
  const code = sequenceCodec.encode(sequence);
  const codeLines = options.includeCode ? code.match(/.{1,110}/g) ?? [code] : [];
  const footerHeight = (options.includeObjectState ? 28 : 0) + codeLines.length * 12 + 16;
  const height = HEADER + performers.length * 2 * ROW + footerHeight;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    '<g font-family="Arial,sans-serif" fill="#172033">',
    `<text x="24" y="36" font-size="23" font-weight="700">POINTS</text>`,
    ...(options.includeSettings ? [`<text x="24" y="64" font-size="15">${escapeXml(sequence.sequenceType)} · ${sequence.bpm} BPM · ${sequence.timeSignature.numerator}/${sequence.timeSignature.denominator}</text>`] : []),
    `<text x="24" y="88" font-size="12">Page ${page} of ${pageCount} · ${sequence.beats.length} beats</text>`,
  ];
  const x0 = 150;
  sequence.beats.forEach((_, index) => {
    const x = x0 + index * CELL;
    parts.push(`<text x="${x + CELL / 2}" y="124" font-size="12" text-anchor="middle">${index + 1}</text>`);
    parts.push(`<path d="M${x} 132v${performers.length * 2 * ROW}" stroke="#d4dbe5" stroke-width="1"/>`);
  });
  performers.forEach((performer, performerIndex) => {
    const y = HEADER + performerIndex * 2 * ROW;
    if (options.includePerformerNames) parts.push(`<text x="24" y="${y + 22}" font-size="14" font-weight="700">${escapeXml(performer.name)}</text>`);
    (['left', 'right'] as const).forEach((hand, handIndex) => {
      const rowY = y + handIndex * ROW;
      parts.push(`<text x="110" y="${rowY + 22}" font-size="12">${hand === 'left' ? 'L' : 'R'}</text>`);
      parts.push(`<path d="M${x0} ${rowY}h${sequence.beats.length * CELL} M${x0} ${rowY + ROW}h${sequence.beats.length * CELL}" stroke="#d4dbe5" stroke-width="1"/>`);
      sequence.beats.forEach((beat, beatIndex) => {
        const entries = sequence.notation.filter((entry) => entry.performerId === performer.id && entry.hand === hand && entry.time.beatId === beat.id);
        entries.forEach((entry) => {
          const x = x0 + beatIndex * CELL;
          const label = entryText(entry, sequence);
          const special = entry.action.type === 'SPECIAL';
          const invalid = invalidEntries.has(entry.id);
          const color = invalid ? '#dc2626' : special ? '#8b5cf6' : entry.action.type === 'ZIP' ? '#0f766e' : '#172033';
          if (entry.action.type === 'HOLD') {
            parts.push(`<path d="M${x + 4} ${rowY + 5}h${CELL - 8} M${x + 4} ${rowY + ROW - 5}h${CELL - 8}" stroke="${color}" stroke-width="3"/>`);
          } else {
            parts.push(`<rect x="${x + 2}" y="${rowY + 2}" width="${CELL - 4}" height="${ROW - 4}" rx="3" fill="${special ? '#f3e8ff' : '#f1f5f9'}" stroke="${color}" stroke-width="1.3"/>`);
            parts.push(`<text x="${x + CELL / 2}" y="${rowY + 21}" font-size="9" font-weight="700" text-anchor="middle">${escapeXml(label.length > 11 ? label.slice(0, 10) + '…' : label)}</text>`);
          }
        });
      });
    });
  });
  const state = sequence.initialState.placements.map((placement) => {
    const ball = sequence.balls.find((item) => item.id === placement.ballId);
    const objectLocation = placement.location;
    let location = '?';
    if (objectLocation.kind === 'position') {
      location = sequence.positions.find((item) => item.id === objectLocation.positionId)?.name ?? '?';
    } else if (objectLocation.kind === 'hand-held') {
      location = (objectLocation.hand === 'left' ? 'L' : 'R') + ' held';
    } else {
      location = (objectLocation.hand === 'left' ? 'L' : 'R') + ' back';
    }
    return (ball?.id ?? '?') + ' at ' + location;
  }).join(' · ');
  if (options.includeObjectState) parts.push(`<text x="24" y="${height - 16 - codeLines.length * 12}" font-size="11">Initial objects: ${escapeXml(state || 'None')}</text>`);
  codeLines.forEach((line, index) => parts.push(`<text x="24" y="${height - 18 - (codeLines.length - index - 1) * 12}" font-size="8" fill="#64748b">Code: ${escapeXml(line)}</text>`));
  if (invalidEntries.size) parts.push(`<text x="${width - 12}" y="36" text-anchor="end" font-size="10" fill="#dc2626">Red marks invalid notation</text>`);
  parts.push('</g></svg>');
  return parts.join('');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function svgToPng(svg: string): Promise<Blob> {
  const source = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight * 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is unavailable in this browser.');
    context.scale(2, 2);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create PNG image.')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportSequencePng(sequence: Sequence, options: PNGExportOptions): Promise<void> {
  const invalidEntries = new Set(simulateSequence(sequence).validation.issues.flatMap((issue) => issue.affectedEntries));
  const groups: Sequence['performers'][number][][] = [];
  let current: Sequence['performers'][number][] = [];
  for (const performer of sequence.performers) {
    const projectedHeight = HEADER + (current.length + 1) * 2 * ROW + FOOTER;
    if (current.length && projectedHeight > MAX_HEIGHT) {
      groups.push(current);
      current = [];
    }
    current.push(performer);
  }
  if (current.length || groups.length === 0) groups.push(current);
  const segmented = groups.length > 1;
  for (let index = 0; index < groups.length; index += 1) {
    const svg = makeSvg(sequence, groups[index]!, index + 1, groups.length, invalidEntries, options);
    const blob = await svgToPng(svg);
    downloadBlob(blob, segmented ? `points-sequence-${index + 1}.png` : 'points-sequence.png');
  }
}
