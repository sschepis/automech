export interface EmpiricalTestEvent {
    partId: string;
    iteration: number;
    fabricationMetrics: FabricationMetrics;
    performanceMetrics: AcousticTest | ImpedanceTest | KineticTest;
}
export interface FabricationMetrics {
    ambientTemp: number;
    ambientHumidity: number;
    measuredXY: number;
    measuredZ: number;
    measuredHoleRadius: number;
}
export interface AcousticTest {
    type: 'acoustic_resonance';
    targetFrequencyHz: number;
    measuredFrequencyHz: number;
    measuredAmplitudeDb: number;
    resonancePeakWidthHz: number;
}
export interface ImpedanceTest {
    type: 'contact_impedance';
    targetImpedanceKohms: number;
    measuredImpedanceKohms: number;
    appliedPressureNewtons: number;
    surfaceAreaContactMm2: number;
}
export interface KineticTest {
    type: 'kinetic_load';
    targetForceNewtons: number;
    measuredForceNewtons: number;
    displacementMm: number;
    failureMode?: 'yield' | 'fracture' | 'delamination';
}
export interface ConstraintUpdates {
    volumeModifier?: number;
    deflectionDepthModifier?: number;
    clearanceModifier?: number;
    feedback: string;
}
//# sourceMappingURL=technician.d.ts.map