"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculationError = void 0;
exports.estimateRunTimeDays = estimateRunTimeDays;
class CalculationError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = "CalculationError";
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, CalculationError.prototype);
    }
}
exports.CalculationError = CalculationError;
function estimateRunTimeDays(BCR, MDE, sigLevel, numVariations, dailyVisitors) {
    // Validate input parameters
    if (typeof BCR !== 'number' || isNaN(BCR) || BCR <= 0 || BCR >= 1) {
        throw new CalculationError(`Baseline Conversion Rate (BCR) must be a number between 0 and 1 (exclusive). Received: ${BCR}. For example, use 0.05 for a 5% conversion rate.`, 'INVALID_BCR', `BCR should be a decimal like 0.05 (5%) or 0.23 (23%), not a percentage like 5 or 23`);
    }
    if (typeof MDE !== 'number' || isNaN(MDE) || MDE <= 0) {
        throw new CalculationError(`Minimum Detectable Effect (MDE) must be a positive number. Received: ${MDE}. For example, use 0.05 to detect a 5% relative improvement.`, 'INVALID_MDE', `MDE should be a decimal like 0.05 (5% relative change) or 0.10 (10% relative change)`);
    }
    if (typeof sigLevel !== 'number' || isNaN(sigLevel) || sigLevel <= 0 || sigLevel >= 100) {
        throw new CalculationError(`Significance Level must be a number between 0 and 100 (exclusive). Received: ${sigLevel}. Common values are 90, 95, or 99.`, 'INVALID_SIGNIFICANCE_LEVEL', `Use values like 95 for 95% confidence level, not 0.95`);
    }
    if (typeof numVariations !== 'number' || isNaN(numVariations) || numVariations < 2 || !Number.isInteger(numVariations)) {
        throw new CalculationError(`Number of Variations must be an integer of 2 or more. Received: ${numVariations}. This includes the control plus all test variations.`, 'INVALID_NUM_VARIATIONS', `For an A/B test use 2 (control + 1 variation), for A/B/C test use 3, etc.`);
    }
    if (typeof dailyVisitors !== 'number' || isNaN(dailyVisitors) || dailyVisitors <= 0) {
        throw new CalculationError(`Daily Visitors must be a positive number. Received: ${dailyVisitors}. This should be the number of visitors per day that will be included in the experiment.`, 'INVALID_DAILY_VISITORS', `Use the actual number of daily visitors, like 1000 or 5000`);
    }
    try {
        // Compute absolute MDE
        const absoluteMDE = BCR * MDE;
        // c1 is baseline, c2 = c1 - absoluteMDE, c3 = c1 + absoluteMDE
        const c1 = BCR;
        const c2 = c1 - absoluteMDE;
        const c3 = c1 + absoluteMDE;
        // Check if c2 is negative (which would be invalid)
        if (c2 < 0) {
            throw new CalculationError(`The Minimum Detectable Effect (${MDE}) is too large relative to the Baseline Conversion Rate (${BCR}). This would result in a negative conversion rate. Please use a smaller MDE or check your BCR value.`, 'MDE_TOO_LARGE', `MDE of ${MDE} on BCR of ${BCR} would create a negative conversion rate of ${c2.toFixed(4)}`);
        }
        // alpha is a decimal
        const alpha = 1 - sigLevel / 100;
        // variance estimates
        const variance1 = c1 * (1 - c1) + c2 * (1 - c2);
        const variance2 = c1 * (1 - c1) + c3 * (1 - c3);
        // theta is the absolute difference
        const theta = Math.abs(absoluteMDE);
        if (theta === 0) {
            throw new CalculationError(`The Minimum Detectable Effect cannot be zero. Please specify a meaningful effect size to detect.`, 'ZERO_MDE', `MDE must be greater than 0 to calculate statistical power`);
        }
        // sample estimates
        const sampleEstimate1 = (2 * (1 - alpha) * variance1 * Math.log(1 + Math.sqrt(variance1) / theta)) /
            (theta * theta);
        const sampleEstimate2 = (2 * (1 - alpha) * variance2 * Math.log(1 + Math.sqrt(variance2) / theta)) /
            (theta * theta);
        // final sample size is the max of these two
        let sampleEstimate;
        if (Math.abs(sampleEstimate1) >= Math.abs(sampleEstimate2)) {
            sampleEstimate = sampleEstimate1;
        }
        else {
            sampleEstimate = sampleEstimate2;
        }
        // Check for invalid calculations
        if (!isFinite(sampleEstimate) || isNaN(sampleEstimate)) {
            throw new CalculationError(`Statistical calculation resulted in invalid values. This could be due to extreme parameter values. Please check your inputs and try with more moderate values.`, 'CALCULATION_OVERFLOW', `Parameters: BCR=${BCR}, MDE=${MDE}, sigLevel=${sigLevel}, numVariations=${numVariations}, dailyVisitors=${dailyVisitors}`);
        }
        if (sampleEstimate < 0) {
            throw new CalculationError(`Statistical calculation resulted in negative sample size. This typically indicates incompatible parameter values. Please review your BCR, MDE, and significance level.`, 'NEGATIVE_SAMPLE_SIZE', `Calculated sample estimate: ${sampleEstimate}`);
        }
        // Multiply by numVariations, then divide by dailyVisitors to get days
        const totalSampleSize = sampleEstimate * numVariations;
        const days = totalSampleSize / dailyVisitors;
        // Round up to nearest integer
        const estimatedDays = Math.ceil(days);
        // Sanity check for extremely long experiments
        if (estimatedDays > 365) {
            throw new CalculationError(`Calculated experiment duration is ${estimatedDays} days (over 1 year). This suggests the effect size is too small to detect with the given traffic, or the parameters need adjustment. Consider increasing the MDE, lowering the significance level, or increasing daily visitors.`, 'DURATION_TOO_LONG', `With ${dailyVisitors} daily visitors, detecting a ${(MDE * 100).toFixed(1)}% relative change at ${sigLevel}% confidence would take ${estimatedDays} days`);
        }
        return estimatedDays;
    }
    catch (error) {
        if (error instanceof CalculationError) {
            throw error;
        }
        throw new CalculationError(`Unexpected error during runtime calculation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CALCULATION_ERROR', `Parameters: BCR=${BCR}, MDE=${MDE}, sigLevel=${sigLevel}, numVariations=${numVariations}, dailyVisitors=${dailyVisitors}`);
    }
}
