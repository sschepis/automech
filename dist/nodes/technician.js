import { updateMaterialProfileFromFabrication } from '../profiles/materials.js';
const FREQUENCY_TOLERANCE_HZ = 5;
const IMPEDANCE_TOLERANCE = 50;
export function evaluateEmpiricalFeedback(testData, materialId) {
    updateMaterialProfileFromFabrication(materialId, testData.fabricationMetrics);
    const constraintUpdates = {
        feedback: '',
    };
    if (testData.performanceMetrics.type === 'acoustic_resonance') {
        const metrics = testData.performanceMetrics;
        const deltaHz = metrics.measuredFrequencyHz - metrics.targetFrequencyHz;
        if (Math.abs(deltaHz) > FREQUENCY_TOLERANCE_HZ) {
            const volumeModifier = calculateRequiredVolumeShift(deltaHz, metrics.measuredFrequencyHz);
            constraintUpdates.volumeModifier = volumeModifier;
            constraintUpdates.feedback =
                `Physical bench test yielded ${metrics.measuredFrequencyHz}Hz. Target is ${metrics.targetFrequencyHz}Hz. ` +
                    `Increase internal chamber volume by ${volumeModifier.toFixed(1)}%.`;
        }
        else {
            constraintUpdates.feedback =
                `Acoustic test passed within tolerance: measured ${metrics.measuredFrequencyHz}Hz (target ${metrics.targetFrequencyHz}Hz ± 5Hz).`;
        }
    }
    if (testData.performanceMetrics.type === 'contact_impedance') {
        const metrics = testData.performanceMetrics;
        if (metrics.measuredImpedanceKohms > metrics.targetImpedanceKohms + IMPEDANCE_TOLERANCE) {
            constraintUpdates.deflectionDepthModifier = 1.15;
            constraintUpdates.feedback =
                `Impedance failed at ${metrics.measuredImpedanceKohms} kOhms (target: ${metrics.targetImpedanceKohms} kOhms). ` +
                    `Increase cantilever deflection depth by 15% to increase contact pressure.`;
        }
        else {
            constraintUpdates.feedback =
                `Impedance test passed: ${metrics.measuredImpedanceKohms} kOhms (target: ${metrics.targetImpedanceKohms} kOhms).`;
        }
    }
    if (testData.performanceMetrics.type === 'kinetic_load') {
        const metrics = testData.performanceMetrics;
        if (metrics.measuredForceNewtons < metrics.targetForceNewtons * 0.9) {
            constraintUpdates.deflectionDepthModifier = 1.2;
            constraintUpdates.clearanceModifier = 0.9;
            constraintUpdates.feedback =
                `Load test failed: sustained ${metrics.measuredForceNewtons}N (target: ${metrics.targetForceNewtons}N). ` +
                    `Failure mode: ${metrics.failureMode ?? 'unknown'}. Increase structural reinforcement, reduce clearances.`;
        }
        else {
            constraintUpdates.feedback =
                `Load test passed: ${metrics.measuredForceNewtons}N sustained (target: ${metrics.targetForceNewtons}N).`;
        }
    }
    return constraintUpdates;
}
export function calculateRequiredVolumeShift(deltaHz, measuredFrequencyHz) {
    const relativeError = deltaHz / measuredFrequencyHz;
    const modifier = -relativeError * 100;
    return Math.max(-50, Math.min(100, modifier));
}
//# sourceMappingURL=technician.js.map