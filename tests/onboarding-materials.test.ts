import { describe, it, expect } from 'vitest';
import { nextGoalIndex } from '../src/domain/interview';
import { questions } from '../src/domain/questions';
import { onboardingVoiceScript } from '../src/domain/onboarding-voice';
import { onboardingMaterialContext } from '../src/domain/onboarding-materials';

describe('optional materials on adaptive onboarding', () => {
  it('keeps team context for optional answer links when existing team context skips resources', () => {
    const answers = Object.fromEntries(['j-scope', 'j-scope:followup', 'j-goal'].map(id => [id, {value: onboardingVoiceScript('john', id), skipped: false}]));
    const next = nextGoalIndex('john', answers, answers['j-goal'].value);
    const question = questions.john[next!];
    expect(question.id).toBe('j-constraints');
    expect(onboardingMaterialContext('john', question.id).membership).toBe(true);
    expect(onboardingMaterialContext('john', question.id + ':clarify').membership).toBe(true);
  });
  it('keeps link ownership contextual and leaves unrelated questions unchanged', () => {
    expect(onboardingMaterialContext('emma', 'e-evidence').personal).toBe(true);
    expect(onboardingMaterialContext('john', 'j-goal').business).toBe(true);
    expect(onboardingMaterialContext('emma', 'j-constraints').membership).toBe(false);
    expect(Object.values(onboardingMaterialContext('emma', 'e-time')).some(Boolean)).toBe(false);
  });
});
