import pkg from '@jscad/modeling';
const { primitives, booleans } = pkg;
export function generateMatingVoid(node, clearance, material) {
    const totalOffset = clearance + material.holeOffset;
    const voidBody = primitives.cuboid({
        size: [
            node.width + totalOffset * 2,
            node.length + totalOffset * 2,
            node.depth + totalOffset * 2,
        ],
        center: [0, 0, node.depth / 2],
    });
    return voidBody;
}
export function generateClearanceVoid(node, clearanceProfile, material, fitType = 'slidingFit') {
    return generateMatingVoid(node, clearanceProfile[fitType], material);
}
//# sourceMappingURL=clearances.js.map