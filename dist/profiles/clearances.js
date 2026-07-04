export const STANDARD_CLEARANCES = {
    pressFit: 0.05,
    slidingFit: 0.20,
    looseFit: 0.40,
    bearingFit: 0.08,
};
export const PCLEARANCES = {
    pressFit: 0.04,
    slidingFit: 0.15,
    looseFit: 0.30,
    bearingFit: 0.06,
};
export const PETG_CLEARANCES = {
    pressFit: 0.08,
    slidingFit: 0.25,
    looseFit: 0.50,
    bearingFit: 0.12,
};
export const PACF_CLEARANCES = {
    pressFit: 0.03,
    slidingFit: 0.12,
    looseFit: 0.25,
    bearingFit: 0.05,
};
export const TPU_CLEARANCES = {
    pressFit: 0.15,
    slidingFit: 0.35,
    looseFit: 0.60,
    bearingFit: 0.20,
};
export const CLEARANCE_REGISTRY = {
    standard: STANDARD_CLEARANCES,
    pla: PCLEARANCES,
    petg: PETG_CLEARANCES,
    'pa-cf': PACF_CLEARANCES,
    tpu: TPU_CLEARANCES,
};
export function getClearanceProfile(materialId) {
    const normalized = materialId.toLowerCase().replace('_', '-');
    return CLEARANCE_REGISTRY[normalized] ?? STANDARD_CLEARANCES;
}
//# sourceMappingURL=clearances.js.map