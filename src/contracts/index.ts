import type {
  GeneratedCandidate,
  GeneratorRequest,
  Sequence,
  SequenceDecodeResult,
  SimulationResult,
  ValidationResult,
} from '../domain/model';

export interface SequenceSimulator {
  simulate(sequence: Sequence): SimulationResult;
}

export interface SequenceValidator {
  validate(sequence: Sequence): ValidationResult;
}

export interface SequenceCodec {
  encode(sequence: Sequence): string;
  decode(code: string): SequenceDecodeResult;
}

export interface SequenceGenerator {
  generate(
    request: GeneratorRequest,
    signal?: AbortSignal,
  ): AsyncIterable<GeneratedCandidate>;
}

export interface SequenceRendererInput {
  readonly sequence: Sequence;
  readonly simulation: SimulationResult;
}
