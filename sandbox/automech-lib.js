import pkg from '@jscad/modeling';
const { primitives, booleans, transforms } = pkg;
const { cuboid, cylinder } = primitives;
const { union, subtract, intersect } = booleans;
const { translate, rotate, scale, mirror, center } = transforms;

const HARDWARE = {
  // Bolts
  M2_SOCKET_CAP:   { type: 'bolt',           clearanceRadius: 1.1,  headRadius: 1.9,  headDepth: 2.0 },
  M3_SOCKET_CAP:   { type: 'bolt',           clearanceRadius: 1.65, headRadius: 2.85, headDepth: 3.0 },
  M4_SOCKET_CAP:   { type: 'bolt',           clearanceRadius: 2.2,  headRadius: 3.65, headDepth: 4.0 },
  M5_SOCKET_CAP:   { type: 'bolt',           clearanceRadius: 2.7,  headRadius: 4.35, headDepth: 5.0 },
  M6_SOCKET_CAP:   { type: 'bolt',           clearanceRadius: 3.3,  headRadius: 5.0,  headDepth: 6.0 },
  M8_SOCKET_CAP:   { type: 'bolt',           clearanceRadius: 4.3,  headRadius: 6.5,  headDepth: 8.0 },
  // Heat-set inserts
  M3_HEAT_SET_SHORT: { type: 'heat_set_insert', clearanceRadius: 2.0, insertDepth: 4.0,  insertTaperAngle: 4.0 },
  M3_HEAT_SET_LONG:  { type: 'heat_set_insert', clearanceRadius: 2.0, insertDepth: 6.0,  insertTaperAngle: 4.0 },
  M4_HEAT_SET_SHORT: { type: 'heat_set_insert', clearanceRadius: 2.7, insertDepth: 5.0,  insertTaperAngle: 4.0 },
  M5_HEAT_SET_SHORT: { type: 'heat_set_insert', clearanceRadius: 3.3, insertDepth: 5.5,  insertTaperAngle: 4.0 },
  M6_HEAT_SET_SHORT: { type: 'heat_set_insert', clearanceRadius: 4.1, insertDepth: 7.0,  insertTaperAngle: 4.0 },
  // Nuts
  M2_NUT: { type: 'nut', clearanceRadius: 2.2 },
  M3_NUT: { type: 'nut', clearanceRadius: 3.3 },
  M4_NUT: { type: 'nut', clearanceRadius: 3.8 },
  M5_NUT: { type: 'nut', clearanceRadius: 4.3 },
  M6_NUT: { type: 'nut', clearanceRadius: 5.3 },
  M8_NUT: { type: 'nut', clearanceRadius: 6.8 },
  // Washers
  M3_FLAT_WASHER:  { type: 'washer', clearanceRadius: 1.65, washerOD: 7.0,  washerThickness: 0.5 },
  M4_FLAT_WASHER:  { type: 'washer', clearanceRadius: 2.2,  washerOD: 9.0,  washerThickness: 0.8 },
  M5_FLAT_WASHER:  { type: 'washer', clearanceRadius: 2.7,  washerOD: 10.0, washerThickness: 1.0 },
  M6_FLAT_WASHER:  { type: 'washer', clearanceRadius: 3.3,  washerOD: 12.0, washerThickness: 1.6 },
  M3_LOCK_WASHER:  { type: 'washer', clearanceRadius: 1.65, washerOD: 6.5,  washerThickness: 0.5 },
  M4_LOCK_WASHER:  { type: 'washer', clearanceRadius: 2.2,  washerOD: 8.0,  washerThickness: 0.8 },
  // Threaded rods
  M3_THREADED_ROD: { type: 'threaded_rod', clearanceRadius: 1.65, rodLength: 120 },
  M4_THREADED_ROD: { type: 'threaded_rod', clearanceRadius: 2.2,  rodLength: 150 },
  M5_THREADED_ROD: { type: 'threaded_rod', clearanceRadius: 2.7,  rodLength: 200 },
  M8_THREADED_ROD: { type: 'threaded_rod', clearanceRadius: 4.3,  rodLength: 300 },
  // Self-tapping screws
  M2_SELF_TAP: { type: 'self_tapping', clearanceRadius: 1.1,  pilotHoleRadius: 0.8, headRadius: 2.0, headDepth: 1.5 },
  M3_SELF_TAP: { type: 'self_tapping', clearanceRadius: 1.65, pilotHoleRadius: 1.2, headRadius: 3.0, headDepth: 2.0 },
  M4_SELF_TAP: { type: 'self_tapping', clearanceRadius: 2.2,  pilotHoleRadius: 1.6, headRadius: 4.0, headDepth: 2.5 },
  // Dowel pins
  DOWEL_3MM: { type: 'dowel_pin', clearanceRadius: 1.6 },
  DOWEL_4MM: { type: 'dowel_pin', clearanceRadius: 2.1 },
  DOWEL_5MM: { type: 'dowel_pin', clearanceRadius: 2.6 },
  DOWEL_6MM: { type: 'dowel_pin', clearanceRadius: 3.1 },
  DOWEL_8MM: { type: 'dowel_pin', clearanceRadius: 4.1 },
  // Magnets
  MAGNET_6x3:  { type: 'magnet', clearanceRadius: 3.1, magnetDepth: 3.0 },
  MAGNET_8x3:  { type: 'magnet', clearanceRadius: 4.1, magnetDepth: 3.0 },
  MAGNET_10x3: { type: 'magnet', clearanceRadius: 5.1, magnetDepth: 3.0 },
  MAGNET_12x3: { type: 'magnet', clearanceRadius: 6.1, magnetDepth: 3.0 },
  // Bearings
  BEARING_608:  { type: 'bearing', clearanceRadius: 11.0, bearingOD: 22.0, bearingID: 8.0,  bearingWidth: 7.0 },
  BEARING_6001: { type: 'bearing', clearanceRadius: 14.0, bearingOD: 28.0, bearingID: 12.0, bearingWidth: 8.0 },
  BEARING_6202: { type: 'bearing', clearanceRadius: 17.5, bearingOD: 35.0, bearingID: 15.0, bearingWidth: 11.0 },
  BEARING_625:  { type: 'bearing', clearanceRadius: 8.0,  bearingOD: 16.0, bearingID: 5.0,  bearingWidth: 5.0 },
};

const MATERIAL_CLEARANCES = {
  pla:   { pressFit: 0.04, slidingFit: 0.15, looseFit: 0.30, bearingFit: 0.06 },
  petg:  { pressFit: 0.08, slidingFit: 0.25, looseFit: 0.50, bearingFit: 0.12 },
  'pa-cf': { pressFit: 0.03, slidingFit: 0.12, looseFit: 0.25, bearingFit: 0.05 },
  tpu:   { pressFit: 0.15, slidingFit: 0.35, looseFit: 0.60, bearingFit: 0.20 },
  default: { pressFit: 0.05, slidingFit: 0.20, looseFit: 0.40, bearingFit: 0.08 },
};

export function fasteners() { return Object.keys(HARDWARE); }

export function getHardware(key) { return HARDWARE[key] || null; }

export function createFastenerVoid(fastenerKey, depth, holeOffset = 0.1) {
  const fastener = HARDWARE[fastenerKey];
  if (!fastener) throw new Error(`Unknown fastener: ${fastenerKey}. Available: ${Object.keys(HARDWARE).join(', ')}`);
  const r = fastener.clearanceRadius + holeOffset;

  switch (fastener.type) {
    case 'heat_set_insert':
      return cylinder({ radius: r, height: fastener.insertDepth || depth, segments: 32 });
    case 'bolt': {
      const shaft = cylinder({ radius: r, height: depth, segments: 32 });
      const headR = (fastener.headRadius || r * 1.5) + holeOffset;
      const headD = fastener.headDepth || depth * 0.5;
      const head = translate([0, 0, depth / 2], cylinder({ radius: headR, height: headD, segments: 32 }));
      try { return union(shaft, head); } catch { return shaft; }
    }
    case 'nut': {
      const nutR = fastener.clearanceRadius * 1.8 + holeOffset;
      const nutH = depth * 0.4;
      return translate([0, 0, depth - nutH / 2], cylinder({ radius: nutR, height: nutH, segments: 6 }));
    }
    case 'washer': {
      const od = (fastener.washerOD || 10) / 2 + holeOffset;
      const id = fastener.clearanceRadius + holeOffset;
      const t = fastener.washerThickness || 1;
      try {
        return subtract(
          cylinder({ radius: od, height: t, segments: 32 }),
          cylinder({ radius: id, height: t + 0.5, segments: 32, center: [0, 0, 0.25] }),
        );
      } catch { return cylinder({ radius: od, height: t, segments: 32 }); }
    }
    case 'threaded_rod':
      return cylinder({ radius: r, height: fastener.rodLength || depth, segments: 32 });
    case 'self_tapping': {
      const pilotR = (fastener.pilotHoleRadius || r * 0.75) + holeOffset;
      const shaft = cylinder({ radius: pilotR, height: depth, segments: 32 });
      const headR = (fastener.headRadius || pilotR * 2) + holeOffset;
      const headD = fastener.headDepth || 2;
      try {
        return union(shaft, translate([0, 0, depth / 2], cylinder({ radius: headR, height: headD, segments: 32 })));
      } catch { return shaft; }
    }
    case 'dowel_pin':
    case 'magnet':
      return cylinder({ radius: r, height: fastener.magnetDepth || depth, segments: 32 });
    case 'bearing': {
      const od = (fastener.bearingOD || 22) / 2 + holeOffset;
      const id = (fastener.bearingID || 8) / 2 + holeOffset;
      const w = fastener.bearingWidth || 7;
      try {
        return subtract(
          cylinder({ radius: od, height: w, segments: 32 }),
          cylinder({ radius: id, height: w + 0.5, segments: 32, center: [0, 0, 0.25] }),
        );
      } catch { return cylinder({ radius: od, height: w, segments: 32 }); }
    }
    default:
      return cylinder({ radius: r, height: depth, segments: 32 });
  }
}

export function createBoltHole(threadSize, passThroughDepth, counterboreDepth = 0, holeOffset = 0.1) {
  const sizes = { 'M2': 1.1, 'M3': 1.65, 'M4': 2.2, 'M5': 2.7, 'M6': 3.3, 'M8': 4.3 };
  const headRadii = { 'M2': 1.9, 'M3': 2.85, 'M4': 3.65, 'M5': 4.35, 'M6': 5.0, 'M8': 6.5 };
  const headDepths = { 'M2': 2.0, 'M3': 3.0, 'M4': 4.0, 'M5': 5.0, 'M6': 6.0, 'M8': 8.0 };
  const r = (sizes[threadSize] || 2.0) + holeOffset;
  const shaft = cylinder({ radius: r, height: passThroughDepth, segments: 32 });
  if (counterboreDepth > 0) {
    const headR = (headRadii[threadSize] || r * 1.5) + holeOffset;
    const counterbore = translate([0, 0, passThroughDepth / 2],
      cylinder({ radius: headR, height: counterboreDepth, segments: 32 }));
    try { return union(shaft, counterbore); } catch { return shaft; }
  }
  return shaft;
}

export function createCantileverClip({
  width = 10, deflectionDepth = 1, beamThickness = 2, maxStrain = 0.03,
} = {}) {
  const minLength = Math.sqrt((3 * deflectionDepth * beamThickness) / (2 * maxStrain));
  const safeLength = minLength * 1.10;
  const beam = cuboid({ size: [width, safeLength, beamThickness], center: [0, safeLength / 2, beamThickness / 2] });
  const hookBase = safeLength * 0.15;
  const hook = cuboid({ size: [width, hookBase, beamThickness + deflectionDepth], center: [0, safeLength + hookBase / 2, (beamThickness + deflectionDepth) / 2] });
  const upper = cuboid({ size: [width, hookBase, deflectionDepth * 0.8], center: [0, safeLength + hookBase / 2 + hookBase * 0.1, beamThickness + deflectionDepth * 0.6] });
  try { return union(upper, union(beam, hook)); } catch { return beam; }
}

export function calcSnapFitLength(deflectionDepth, beamThickness, maxStrain) {
  return Math.sqrt((3 * deflectionDepth * beamThickness) / (2 * maxStrain)) * 1.10;
}

export function createMatingVoid({ width = 10, length = 10, depth = 10 } = {}, clearance = 0.25, holeOffset = 0.1) {
  const totalOffset = clearance + holeOffset;
  return cuboid({ size: [width + totalOffset * 2, length + totalOffset * 2, depth + totalOffset * 2], center: [0, 0, depth / 2] });
}

export function createClearanceVoid({ width = 10, length = 10, depth = 10 } = {}, materialId = 'petg', fitType = 'slidingFit', holeOffset = 0.1) {
  const profile = MATERIAL_CLEARANCES[materialId] || MATERIAL_CLEARANCES.default;
  const clearance = profile[fitType] || profile.slidingFit;
  return createMatingVoid({ width, length, depth }, clearance, holeOffset);
}

export function getClearance(materialId = 'petg', fitType = 'slidingFit') {
  const p = MATERIAL_CLEARANCES[materialId] || MATERIAL_CLEARANCES.default;
  return p[fitType] || p.slidingFit;
}

export function createDowelPinVoid(diameter, depth, holeOffset = 0.1) {
  const r = diameter / 2 + holeOffset;
  return cylinder({ radius: r, height: depth, segments: 32 });
}

export function createMagnetPocket(diameter, depth, holeOffset = 0.1) {
  const r = diameter / 2 + holeOffset;
  return cylinder({ radius: r, height: depth, segments: 32 });
}

export function createBearingPocket(od, id, width, holeOffset = 0.1) {
  const rOuter = od / 2 + holeOffset;
  const rInner = id / 2 + holeOffset;
  try {
    return subtract(
      cylinder({ radius: rOuter, height: width, segments: 32 }),
      cylinder({ radius: rInner, height: width + 0.5, segments: 32, center: [0, 0, 0.25] }),
    );
  } catch { return cylinder({ radius: rOuter, height: width, segments: 32 }); }
}
