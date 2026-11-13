import { beforeEach, describe, expect, it } from 'vitest';
import { representativeSoloSequence } from '../../fixtures/sequences';
import { clearSavedSequence, restoreSequence, saveSequence } from './persistence';

describe('tab local sequence persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('restores the last complete sequence for the current tab', () => {
    saveSequence(representativeSoloSequence);
    expect(restoreSequence()).toEqual(representativeSoloSequence);
  });

  it('keeps incomplete and invalid sequences without validation filtering', () => {
    const unfinished = { ...representativeSoloSequence, notation: [] };
    saveSequence(unfinished);
    expect(restoreSequence()).toEqual(unfinished);
  });

  it('clears only the current tab saved sequence', () => {
    saveSequence(representativeSoloSequence);
    clearSavedSequence();
    expect(restoreSequence()).toBeNull();
  });
});
