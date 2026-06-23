/**
 * Orchestrator: Hybrid Advisor + User Intelligence feedback loop
 */

import {
  DEFAULT_HYBRID_WEIGHTS,
  getHybridTimingAdvice,
  KARTIKAY_PROFILE,
  type HybridAdvisorInput,
} from '../hybridTimingAdvisor';
import { getDefaultJyotishOptions } from '../jyotishConfig';
import { KARTIKAY_DOCTRINE, resolveDoctrineWeights } from '../kartikayDoctrine';
import { applyPatternAdjustments, buildPatternContext, type EnrichedAdvisorResponse } from './feedbackBridge';
import type { IntelligenceStore } from './memoryStore';
import { defaultIntelligenceStore } from './memoryStore';
import { userProfileToHybridInput } from './profileFactory';
import type { UserProfile } from './types';

function resolveAdvisorDoctrine(profile?: UserProfile) {
  if (!profile) return null;
  if (profile.id === 'kartikay-default' || profile.preferences.conviction_sensitivity === 'conservative') {
    return KARTIKAY_DOCTRINE;
  }
  return null;
}

function resolveAdvisorWeights(profile?: UserProfile, inputWeights?: HybridAdvisorInput['weights']) {
  if (inputWeights) return inputWeights;
  const doctrine = resolveAdvisorDoctrine(profile);
  if (!doctrine) return undefined;
  return resolveDoctrineWeights(
    DEFAULT_HYBRID_WEIGHTS,
    doctrine,
    profile?.preferences.hybrid_weights_override
  );
}

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

  const doctrine = resolveAdvisorDoctrine(profile);
  const advice = await getHybridTimingAdvice({
    ...input,
    user: hybridUser,
    weights: resolveAdvisorWeights(profile, input.weights),
    doctrine,
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