/**
 * Configuration for risk score weighting.
 * Adjust the penalty values to control how much each risk factor impacts the score.
 */
const riskWeights = {
  baseScore: 100,
  penalties: {
    blacklist: 80,
    lostMode: 80,
    iCloudOn: 40,
    knoxActive: 80,
    mdmLocked: 80,
    networkLocked: 30,
    networkLockedOrange: 10
  }
};

module.exports = riskWeights;

