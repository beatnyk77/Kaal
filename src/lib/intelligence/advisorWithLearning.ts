/**
 * Orchestrator: Hybrid Advisor + User Intelligence feedback loop
 */

import { getHybridTimingAdvice, KARTIKAY_PROFILE, type HybridAdvisorInput } from '../hybridTimingAdvisor';
import { getDefaultJyotishOptions } from '../jyotishConfig';
import { applyPatternAdjustments, buildPatternContext, type EnrichedAdvisorResponse } from './feedbackBridge';
import type { IntelligenceStore } from './memoryStore';
import { defaultIntelligenceStore } from './memoryStore';
import { userProfileToHybridInput } from './profileFactory';
import type { UserProfile } from './types';

export interface AdvisorWithLearningInput extends HybridAdvisorInput {
  userProfile?: UserProfile;
  store?: IntelligenceStore;
}

export async function getHybridTimingAdviceWithLearning(
  input: AdvisorWithLearningInput
): Promise<EnrichedAdvisorResponse> {
  const store = input.store ?? defaultIntelligenceStore;
  const profile = input.userProfile ?? store.getProfile('kartikay-default');

  const hybridUser = profile
    ? userProfileToHybridInput(profile)
    : input.user ?? KARTIKAY_PROFILE;

  const advice = await getHybridTimingAdvice({
    ...input,
    user: hybridUser,
    jyotishOptions: { ...getDefaultJyotishOptions(), ...input.jyotishOptions },
  });

  if (!profile) {
    return applyPatternAdjustments(advice, {
      score_delta: 0,
      messages: ['No user profile — log actions to enable learning.'],
      matched_rules: [],
      phase: 'cold_start',
      sample_size: 0,
    });
  }

  const logs = store.getLogs(profile.id);
  const rules = store.getRules(profile.id);
  const adjustments = buildPatternContext(advice, profile, logs, rules);

  return applyPatternAdjustments(advice, adjustments);
}