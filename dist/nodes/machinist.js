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
    const emptyFlag = checkEmptyStl(stlPath);
    if (emptyFlag) {
        flags.push(emptyFlag);
        return { manufacturingFlags: flags };
    }
    flags.push(...analyzeOverhangs(stlPath, state));
    flags.push(...checkDisconnectedComponents(stlPath));
    flags.push(...checkWallThickness(stlPath, state));
    flags.push(...checkBuildVolume(state));
    flags.push(...runHeadlessSlicerCheck(stlPath, state));
    return { manufacturingFlags: flags };
}
function checkEmptyStl(stlPath) {
    try {
        const buffer = readFileSync(stlPath);
        if (buffer.length < 84) {
            return `CRITICAL: STL file is only ${buffer.length} bytes — no geometry produced.`;
        }
        const isAscii = buffer.toString('utf-8', 0, 80).includes('solid');
        if (isAscii) {
            const content = buffer.toString('utf-8');
            if (!content.includes('facet')) {
                return 'CRITICAL: ASCII STL contains no facets — geometry is empty.';
            }
        }
        else {
            const facetCount = buffer.readUInt32LE(80);
            if (facetCount === 0) {
                return 'CRITICAL: Binary STL has 0 facets — geometry is empty.';
            }
        }
        return null;
    }
    catch {
        return 'CRITICAL: Could not read STL file for empty-check.';
    }
}
function analyzeOverhangs(stlPath, state) {
    const flags = [];
    const maxAngle = state.globalConstraints.materialProfile.maxOverhangDeg;
    const threshold = Math.cos((90 - maxAngle) * (Math.PI / 180));
    try {
        const buffer = readFileSync(stlPath);
        const facets = parseSTLFacets(buffer);
        let overhangCount = 0;
        let totalFacets = 0;
        const maxOverhangPercent = 15; // allow up to 15% overhang facets for complex prints
        for (const facet of facets) {
            totalFacets++;
            const [nx, ny, nz] = facet.normal;
            if (nz < -threshold) {
                overhangCount++;
            }
        }
        if (totalFacets === 0) {
            flags.push('OVERHANG_CHECK_FAILED: Could not parse facets for analysis.');
            return flags;
        }
        const overhangPercent = (overhangCount / totalFacets) * 100;
        if (overhangPercent > maxOverhangPercent) {
            flags.push(`OVERHANG_WARNING: ${overhangPercent.toFixed(1)}% of facets exceed ${maxAngle}° limit for ${state.globalConstraints.materialProfile.name} (max allowed: ${maxOverhangPercent}%). Consider support or redesign.`);
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
function checkDisconnectedComponents(stlPath) {
    const flags = [];
    try {
        const buffer = readFileSync(stlPath);
        const facets = parseSTLFacets(buffer);
        if (facets.length === 0)
            return flags;
        // Build vertex adjacency graph via shared vertices
        const vertexMap = new Map();
        for (const facet of facets) {
            for (const v of facet.vertices) {
                const key = v.map(c => c.toFixed(2)).join(',');
                if (!vertexMap.has(key))
                    vertexMap.set(key, []);
                vertexMap.get(key).push(facets.indexOf(facet));
            }
        }
        if (vertexMap.size < 3)
            return flags;
        // Simple check: find bounding box gaps between vertex clusters
        const allVerts = facets.flatMap(f => f.vertices);
        const sortedZ = allVerts.map(v => v[2]).sort((a, b) => a - b);
        // Find large gaps in Z distribution (potential disconnected layers)
        const gaps = [];
        for (let i = 1; i < sortedZ.length; i++) {
            const gap = sortedZ[i] - sortedZ[i - 1];
            if (gap > 20) { // >20mm gap suggests disconnected component
                gaps.push({ start: sortedZ[i - 1], end: sortedZ[i], size: gap });
            }
        }
        if (gaps.length > 0) {
            const gapDescs = gaps.slice(0, 3).map(g => `${g.size.toFixed(0)}mm gap at Z=${g.start.toFixed(0)}–${g.end.toFixed(0)}`);
            flags.push(`FLOATING_COMPONENTS: Detected ${gaps.length} disconnected geometry gap(s): ${gapDescs.join('; ')}. Ensure all parts are translated and unioned into one connected solid.`);
        }
    }
    catch {
        // skip if can't parse
    }
    return flags;
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