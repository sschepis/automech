import pkg from '@jscad/modeling';
const { primitives, booleans, transforms } = pkg;
const { cylinder } = primitives;
const { translate } = transforms;
export function generateFastenerVoid(fastener, depth, material) {
    const compensatedRadius = fastener.clearanceRadius + material.holeOffset;
    if (fastener.type === 'heat_set_insert') {
        return cylinder({
            radius: compensatedRadius,
            height: fastener.insertDepth ?? depth,
            segments: 32,
        });
    }
    if (fastener.type === 'bolt') {
        const shaft = cylinder({ radius: compensatedRadius, height: depth, segments: 32 });
        const headRadius = (fastener.headRadius ?? compensatedRadius * 1.5) + material.holeOffset;
        const headDep = fastener.headDepth ?? depth * 0.5;
        const head = translate([0, 0, depth / 2], cylinder({ radius: headRadius, height: headDep, segments: 32 }));
        try {
            return booleans.union(shaft, head);
        }
        catch {
            return shaft;
        }
    }
    if (fastener.type === 'nut') {
        const nutRadius = fastener.clearanceRadius * 1.8 + material.holeOffset;
        const nutHeight = depth * 0.4;
        return translate([0, 0, depth - nutHeight / 2], cylinder({ radius: nutRadius, height: nutHeight, segments: 6 }));
    }
    return cylinder({ radius: compensatedRadius, height: depth, segments: 32 });
}
//# sourceMappingURL=voids.js.map