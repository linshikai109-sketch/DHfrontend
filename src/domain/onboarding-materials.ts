import type { Role } from './types';

/** Optional material prompts follow the current question, including adaptive paths that skip resources. */
export function onboardingMaterialContext(role: Role, questionId: string) {
  const anchor = questionId.split(':')[0];
  return {
    personal: role === 'emma' && ['e-experience', 'e-evidence'].includes(anchor),
    business: role === 'john' && ['j-goal', 'j-stage'].includes(anchor),
    membership: role === 'john' && ['j-resources', 'j-constraints'].includes(anchor),
  };
}
