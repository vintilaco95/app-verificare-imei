/**
 * Configuration for risk score weighting.
 * Adjust the penalty values to control how much each risk factor impacts the score.
 */
const riskWeights = {
  baseScore: 100,
  penalties: {
    blacklist: 80,
    lostMode: 70,
    iCloudOn: 50,
    knoxActive: 5,
    mdmLocked: 80,
    networkLocked: 4,
    networkLockedOrange: 1
  }
};

module.exports = riskWeights;

