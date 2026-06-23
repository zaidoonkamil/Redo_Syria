const { PricingSetting } = require("../models");

const DEFAULT_PRICING = {
  normal: {
    baseFare: 10,
    pricePerKm: 20,
    pricePerMinute: 4,
    minimumFare: 70,
    roundingTo: 5,
  },
  vip: {
    baseFare: 10,
    pricePerKm: 20,
    pricePerMinute: 4,
    minimumFare: 70,
    roundingTo: 5,
  },
};

const parseAmount = (value, fallback) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseDistance = (value) => {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
};

const parseDuration = (value) => {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
};

const roundFareToNearest = (amount, nearest = 5) => {
  const num = parseFloat(amount);
  if (!Number.isFinite(num)) return null;
  const step = parseFloat(nearest);
  if (!Number.isFinite(step) || step <= 0) return num;
  return Math.round(num / step) * step;
};

const calculateTierFare = (distanceKm, tiers) => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  if (!Array.isArray(tiers) || !tiers.length) return null;
  if (distanceKm === 0) return 0;

  let total = 0;

  for (const tier of tiers) {
    const start = parseFloat(tier.fromKm);
    const end = tier.toKm == null ? null : parseFloat(tier.toKm);
    const rate = parseFloat(tier.pricePerKm);

    if (!Number.isFinite(start) || (!Number.isFinite(end) && end !== null) || !Number.isFinite(rate)) {
      return null;
    }

    if (distanceKm <= start) break;

    const upperBound = end == null ? distanceKm : Math.min(distanceKm, end);
    const covered = Math.max(0, upperBound - start);

    if (covered <= 0) continue;

    total += covered * rate;

    if (end == null || distanceKm <= end) break;
  }

  return Number.isFinite(total) ? total : null;
};

const applyFinalAdjustments = (amount, minimumFare, roundingTo = 5) => {
  const beforeRound = Math.max(minimumFare, amount);
  const rounded = roundFareToNearest(beforeRound, roundingTo);
  return rounded != null ? String(rounded) : null;
};

const fallbackFare = (defaults, distance, duration) => {
  const total =
    defaults.baseFare +
    distance * defaults.pricePerKm +
    duration * defaults.pricePerMinute;
  return applyFinalAdjustments(total, defaults.minimumFare, defaults.roundingTo);
};

const buildEstimatedFare = async ({ serviceType = "normal", distanceKm, durationMin, transaction } = {}) => {
  const distance = parseDistance(distanceKm);
  if (distance === null) return null;
  const duration = parseDuration(durationMin);

  const defaults = DEFAULT_PRICING[serviceType] || DEFAULT_PRICING.normal;

  try {
    const pricing = await PricingSetting.findOne({
      where: { serviceType },
      order: [["createdAt", "DESC"]],
      transaction,
    });

    const baseFare = parseAmount(pricing?.baseFare, defaults.baseFare);
    const perKm = parseAmount(pricing?.pricePerKm, defaults.pricePerKm);
    const perMinute = parseAmount(pricing?.pricePerMinute, defaults.pricePerMinute);
    const minimumFare = parseAmount(pricing?.minimumFare, defaults.minimumFare);
    const roundingTo = parseAmount(pricing?.roundingTo, defaults.roundingTo);

    let total = baseFare + distance * perKm + duration * perMinute;

    if (pricing?.surgeEnabled) {
      const surgeMultiplier = parseAmount(pricing?.surgeMultiplier, 1);
      if (surgeMultiplier && surgeMultiplier > 0) {
        total *= surgeMultiplier;
      }
    }

    return applyFinalAdjustments(total, minimumFare, roundingTo);
  } catch (err) {
    console.error("[fareCalculator] buildEstimatedFare error", err.message);
    return fallbackFare(defaults, distance, duration);
  }
};

module.exports = {
  DEFAULT_PRICING,
  roundFareToNearest,
  calculateTierFare,
  buildEstimatedFare,
};
