/*
Single Source of Truth for Experiment Duration
------------------------------------------------------
BCR = Baseline Conversion Rate (decimal, e.g., 0.23 means 23%)
MDE = relative effect (decimal, e.g., 0.06 means 6% relative to BCR)
sigLevel = desired significance level as number (number, 90 for 90%, 95 for 95%, etc.)
numVariations = number of variations being tested
dailyVisitors = number of daily visitors
returns: estimated days for experiment to reach statsig
*/

export function estimateRunTimeDays(
  BCR: number,
  MDE: number,
  sigLevel: number,
  numVariations: number,
  dailyVisitors: number
): number | null {
  // Compute absolute MDE
  const absoluteMDE = BCR * MDE;

  // c1 is baseline, c2 = c1 - absoluteMDE, c3 = c1 + absoluteMDE
  const c1 = BCR;
  const c2 = c1 - absoluteMDE;
  const c3 = c1 + absoluteMDE;

  // alpha is a decimal
  const alpha = 1 - sigLevel / 100;

  // variance estimates
  const variance1 = c1 * (1 - c1) + c2 * (1 - c2);
  const variance2 = c1 * (1 - c1) + c3 * (1 - c3);

  // theta is the absolute difference
  const theta = Math.abs(absoluteMDE);

  // sample estimates
  const sampleEstimate1 =
    (2 * (1 - alpha) * variance1 * Math.log(1 + Math.sqrt(variance1) / theta)) /
    (theta * theta);

  const sampleEstimate2 =
    (2 * (1 - alpha) * variance2 * Math.log(1 + Math.sqrt(variance2) / theta)) /
    (theta * theta);

  // final sample size is the max of these two
  let sampleEstimate;
  if (Math.abs(sampleEstimate1) >= Math.abs(sampleEstimate2)) {
    sampleEstimate = sampleEstimate1;
  } else {
    sampleEstimate = sampleEstimate2;
  }

  // return null if invalid
  if (!isFinite(sampleEstimate) || sampleEstimate < 0) {
    return null;
  }

  // Multiply by numVariations, then divide by dailyVisitors to get days
  // Round up to nearest integer
  return Math.ceil((sampleEstimate * numVariations) / dailyVisitors);
}
