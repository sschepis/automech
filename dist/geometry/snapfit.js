import pkg from '@jscad/modeling';
const { primitives, booleans, transforms } = pkg;
const { cuboid } = primitives;
const { translate } = transforms;
export function generateCantileverClip(constraints) {
    const minLength = Math.sqrt((3 * constraints.deflectionDepth * constraints.beamThickness) /
        (2 * constraints.maxStrain));
    const safeLength = minLength * 1.10;
    const beam = cuboid({
        size: [constraints.width, safeLength, constraints.beamThickness],
        center: [0, safeLength / 2, constraints.beamThickness / 2],
    });
    const hookBase = safeLength * 0.15;
    const hook = cuboid({
        size: [constraints.width, hookBase, constraints.beamThickness + constraints.deflectionDepth],
        center: [0, safeLength + hookBase / 2, (constraints.beamThickness + constraints.deflectionDepth) / 2],
    });
    const upperCatch = cuboid({
        size: [constraints.width, hookBase, constraints.deflectionDepth * 0.8],
        center: [0, safeLength + hookBase / 2 + hookBase * 0.1, constraints.beamThickness + constraints.deflectionDepth * 0.6],
    });
    try {
        const body = booleans.union(beam, hook);
        return booleans.union(body, upperCatch);
    }
    catch {
        return beam;
    }
}
export function calculateRequiredLength(deflectionDepth, beamThickness, maxStrain) {
    return Math.sqrt((3 * deflectionDepth * beamThickness) / (2 * maxStrain)) * 1.10;
}
//# sourceMappingURL=snapfit.js.map