import { useMemo, useState } from 'react';
import type { Sequence } from '../../domain/model';
import { sequenceCodec } from '../data/codec';
import { searchPresets } from '../presets/presets';
import { exportSequencePng } from './png';

interface Props {
  readonly sequence: Sequence;
  readonly onReplace: (sequence: Sequence) => void;
}

export default function SequenceDataTools({ sequence, onReplace }: Props) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const presets = useMemo(() => searchPresets(query), [query]);
  const currentCode = useMemo(() => sequenceCodec.encode(sequence), [sequence]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setMessage('Sequence code copied.');
    } catch {
      setCode(currentCode);
      setMessage('Select and copy the code below.');
    }
  };

  const importCode = () => {
    const result = sequenceCodec.decode(code);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (!window.confirm('Replace the current sequence with the imported sequence?')) return;
    onReplace(result.sequence);
    setCode('');
    setMessage('Sequence imported.');
  };

  const loadPreset = (presetSequence: Sequence) => {
    if (!window.confirm('Replace the current sequence with this preset?')) return;
    onReplace(presetSequence);
    setMessage('Preset loaded.');
    setOpen(false);
  };

  return (
    <section className="sequence-data-tools" aria-label="Sequence data">
      <div className="data-tools-heading">
        <strong>Sequence</strong>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>Code, presets and export {open ? '−' : '+'}</button>
      </div>
      {open && <div className="data-tools-content">
        <div className="data-tools-row">
          <button type="button" onClick={copyCode}>Copy sequence code</button>
          <button type="button" onClick={() => void exportSequencePng(sequence).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Image export failed.'))}>Export PNG</button>
        </div>
        <label>Import sequence code
          <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={3} spellCheck={false} placeholder="Paste a POINTS sequence code" />
        </label>
        <div className="data-tools-row">
          <button type="button" onClick={importCode} disabled={!code.trim()}>Import</button>
          <button type="button" onClick={() => setCode(currentCode)}>Show current code</button>
        </div>
        <label>Find a preset
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search presets" />
        </label>
        <div className="preset-list">
          {presets.map((preset) => <button type="button" key={preset.id} onClick={() => loadPreset(preset.sequence)}>
            <strong>{preset.name}</strong><span>{preset.description}</span>
          </button>)}
          {presets.length === 0 && <span>No matching presets.</span>}
        </div>
        {message && <p role="status">{message}</p>}
      </div>}
    </section>
  );
}
