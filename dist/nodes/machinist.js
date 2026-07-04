import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
export async function executeMachinistNode(state, stlPath) {
    const flags = [];
    if (!existsSync(stlPath)) {
        flags.push('CRITICAL: STL file not found for manufacturing analysis.');
        return { manufacturingFlags: flags };
    }
    flags.push(...analyzeOverhangs(stlPath, state));
    flags.push(...checkWallThickness(stlPath, state));
    flags.push(...checkBuildVolume(state));
    flags.push(...runHeadlessSlicerCheck(stlPath, state));
    return { manufacturingFlags: flags };
}
function analyzeOverhangs(stlPath, state) {
    const flags = [];
    const maxAngle = state.globalConstraints.materialProfile.maxOverhangDeg;
    const threshold = Math.cos((90 - maxAngle) * (Math.PI / 180));
    try {
        const buffer = readFileSync(stlPath);
        const facets = parseSTLFacets(buffer);
        for (const facet of facets) {
            const [nx, ny, nz] = facet.normal;
            if (nz < -threshold) {
                flags.push(`OVERHANG_WARNING: Face normal [${nx.toFixed(2)}, ${ny.toFixed(2)}, ${nz.toFixed(2)}] exceeds ${maxAngle}° limit for ${state.globalConstraints.materialProfile.name}. Consider adding support or redesigning.`);
                break;
            }
        }
    }
    catch {
        flags.push('OVERHANG_CHECK_FAILED: Could not parse STL for face normal analysis.');
    }
    return flags;
}
function checkWallThickness(stlPath, state) {
    const minWall = state.globalConstraints.materialProfile.minWallThickness;
    return [];
}
function checkBuildVolume(state) {
    const flags = [];
    const [x, y, z] = state.globalConstraints.maxBoundingBox;
    const maxBuild = 256;
    if (x > maxBuild || y > maxBuild || z > maxBuild) {
        flags.push(`BUILD_VOLUME_EXCEEDED: Max dimension exceeds ${maxBuild}x${maxBuild}x${maxBuild}mm Bambu P2S build volume.`);
    }
    return flags;
}
function runHeadlessSlicerCheck(stlPath, state) {
    const flags = [];
    try {
        const workDir = join(tmpdir(), `machinist_${randomUUID()}`);
        execSync(`mkdir -p "${workDir}"`, { timeout: 5000 });
        try {
            execSync(`which bambu-cli 2>/dev/null`, { timeout: 5000 });
            try {
                const result = execSync(`bambu-cli validate --stl "${stlPath}" --material "${state.globalConstraints.materialProfile.id}"`, {
                    timeout: 30000,
                    encoding: 'utf-8',
                });
                const output = result.toLowerCase();
                if (output.includes('error') || output.includes('fail')) {
                    flags.push(`SLICER_VALIDATION: ${result.trim()}`);
                }
            }
            catch (slicerErr) {
                const stderr = slicerErr?.stderr?.toString() ?? slicerErr?.message ?? '';
                if (stderr)
                    flags.push(`SLICER_ERROR: ${stderr.trim()}`);
            }
        }
        catch {
            // bambu-cli not available, skip slicer check
        }
    }
    catch {
        // temp dir creation failed, skip
    }
    return flags;
}
function parseSTLFacets(buffer) {
    if (buffer.length < 84)
        return [];
    const isAscii = buffer.toString('utf-8', 0, 80).includes('solid');
    if (isAscii)
        return parseSTLAscii(buffer.toString('utf-8'));
    return parseSTLBinary(buffer);
}
function parseSTLAscii(content) {
    const facets = [];
    const lines = content.split('\n').map(l => l.trim());
    let currentFacet = null;
    let vertexIndex = 0;
    for (const line of lines) {
        if (line.startsWith('facet normal')) {
            const parts = line.split(/\s+/).slice(2).map(Number);
            currentFacet = { normal: parts, vertices: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
            vertexIndex = 0;
        }
        else if (line.startsWith('vertex') && currentFacet) {
            const parts = line.split(/\s+/).slice(1).map(Number);
            currentFacet.vertices[vertexIndex] = parts;
            vertexIndex++;
        }
        else if (line.startsWith('endfacet') && currentFacet) {
            facets.push(currentFacet);
            currentFacet = null;
        }
    }
    return facets;
}
function parseSTLBinary(buffer) {
    const facets = [];
    const count = buffer.readUInt32LE(80);
    let offset = 84;
    for (let i = 0; i < count; i++) {
        const nx = buffer.readFloatLE(offset);
        offset += 4;
        const ny = buffer.readFloatLE(offset);
        offset += 4;
        const nz = buffer.readFloatLE(offset);
        offset += 4;
        const v1 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
        offset += 12;
        const v2 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
        offset += 12;
        const v3 = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)];
        offset += 12;
        offset += 2;
        facets.push({ normal: [nx, ny, nz], vertices: [v1, v2, v3] });
    }
    return facets;
}
//# sourceMappingURL=machinist.js.map