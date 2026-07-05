export interface FastenerProfile {
  id: string;
  type: 'bolt' | 'heat_set_insert' | 'nut' | 'washer' | 'threaded_rod' | 'self_tapping' | 'dowel_pin' | 'magnet' | 'bearing';
  threadSize: string;
  clearanceRadius: number;
  headRadius?: number;
  headDepth?: number;
  insertTaperAngle?: number;
  insertDepth?: number;
  washerOD?: number;
  washerThickness?: number;
  rodLength?: number;
  pilotHoleRadius?: number;
  magnetDepth?: number;
  bearingOD?: number;
  bearingID?: number;
  bearingWidth?: number;
}

export const HARDWARE_REGISTRY: Record<string, FastenerProfile> = {
  // === BOLTS ===
  M2_SOCKET_CAP: {
    id: 'm2_shcs',
    type: 'bolt',
    threadSize: 'M2',
    clearanceRadius: 1.1,
    headRadius: 1.9,
    headDepth: 2.0,
  },
  M3_SOCKET_CAP: {
    id: 'm3_shcs',
    type: 'bolt',
    threadSize: 'M3',
    clearanceRadius: 1.65,
    headRadius: 2.85,
    headDepth: 3.0,
  },
  M4_SOCKET_CAP: {
    id: 'm4_shcs',
    type: 'bolt',
    threadSize: 'M4',
    clearanceRadius: 2.2,
    headRadius: 3.65,
    headDepth: 4.0,
  },
  M5_SOCKET_CAP: {
    id: 'm5_shcs',
    type: 'bolt',
    threadSize: 'M5',
    clearanceRadius: 2.7,
    headRadius: 4.35,
    headDepth: 5.0,
  },
  M6_SOCKET_CAP: {
    id: 'm6_shcs',
    type: 'bolt',
    threadSize: 'M6',
    clearanceRadius: 3.3,
    headRadius: 5.0,
    headDepth: 6.0,
  },
  M8_SOCKET_CAP: {
    id: 'm8_shcs',
    type: 'bolt',
    threadSize: 'M8',
    clearanceRadius: 4.3,
    headRadius: 6.5,
    headDepth: 8.0,
  },

  // === HEAT-SET INSERTS ===
  M3_HEAT_SET_SHORT: {
    id: 'm3_insert_short',
    type: 'heat_set_insert',
    threadSize: 'M3',
    clearanceRadius: 2.0,
    insertDepth: 4.0,
    insertTaperAngle: 4.0,
  },
  M3_HEAT_SET_LONG: {
    id: 'm3_insert_long',
    type: 'heat_set_insert',
    threadSize: 'M3',
    clearanceRadius: 2.0,
    insertDepth: 6.0,
    insertTaperAngle: 4.0,
  },
  M4_HEAT_SET_SHORT: {
    id: 'm4_insert_short',
    type: 'heat_set_insert',
    threadSize: 'M4',
    clearanceRadius: 2.7,
    insertDepth: 5.0,
    insertTaperAngle: 4.0,
  },
  M5_HEAT_SET_SHORT: {
    id: 'm5_insert_short',
    type: 'heat_set_insert',
    threadSize: 'M5',
    clearanceRadius: 3.3,
    insertDepth: 5.5,
    insertTaperAngle: 4.0,
  },
  M6_HEAT_SET_SHORT: {
    id: 'm6_insert_short',
    type: 'heat_set_insert',
    threadSize: 'M6',
    clearanceRadius: 4.1,
    insertDepth: 7.0,
    insertTaperAngle: 4.0,
  },

  // === NUTS ===
  M2_NUT: {
    id: 'm2_hex_nut',
    type: 'nut',
    threadSize: 'M2',
    clearanceRadius: 2.2,
  },
  M3_NUT: {
    id: 'm3_hex_nut',
    type: 'nut',
    threadSize: 'M3',
    clearanceRadius: 3.3,
  },
  M4_NUT: {
    id: 'm4_hex_nut',
    type: 'nut',
    threadSize: 'M4',
    clearanceRadius: 3.8,
  },
  M5_NUT: {
    id: 'm5_hex_nut',
    type: 'nut',
    threadSize: 'M5',
    clearanceRadius: 4.3,
  },
  M6_NUT: {
    id: 'm6_hex_nut',
    type: 'nut',
    threadSize: 'M6',
    clearanceRadius: 5.3,
  },
  M8_NUT: {
    id: 'm8_hex_nut',
    type: 'nut',
    threadSize: 'M8',
    clearanceRadius: 6.8,
  },

  // === WASHERS ===
  M3_FLAT_WASHER: {
    id: 'm3_washer_flat',
    type: 'washer',
    threadSize: 'M3',
    clearanceRadius: 1.65,
    washerOD: 7.0,
    washerThickness: 0.5,
  },
  M4_FLAT_WASHER: {
    id: 'm4_washer_flat',
    type: 'washer',
    threadSize: 'M4',
    clearanceRadius: 2.2,
    washerOD: 9.0,
    washerThickness: 0.8,
  },
  M5_FLAT_WASHER: {
    id: 'm5_washer_flat',
    type: 'washer',
    threadSize: 'M5',
    clearanceRadius: 2.7,
    washerOD: 10.0,
    washerThickness: 1.0,
  },
  M6_FLAT_WASHER: {
    id: 'm6_washer_flat',
    type: 'washer',
    threadSize: 'M6',
    clearanceRadius: 3.3,
    washerOD: 12.0,
    washerThickness: 1.6,
  },
  M3_LOCK_WASHER: {
    id: 'm3_washer_lock',
    type: 'washer',
    threadSize: 'M3',
    clearanceRadius: 1.65,
    washerOD: 6.5,
    washerThickness: 0.5,
  },
  M4_LOCK_WASHER: {
    id: 'm4_washer_lock',
    type: 'washer',
    threadSize: 'M4',
    clearanceRadius: 2.2,
    washerOD: 8.0,
    washerThickness: 0.8,
  },
  M5_LOCK_WASHER: {
    id: 'm5_washer_lock',
    type: 'washer',
    threadSize: 'M5',
    clearanceRadius: 2.7,
    washerOD: 9.0,
    washerThickness: 1.0,
  },

  // === THREADED RODS ===
  M3_THREADED_ROD: {
    id: 'm3_rod',
    type: 'threaded_rod',
    threadSize: 'M3',
    clearanceRadius: 1.65,
    rodLength: 120,
  },
  M4_THREADED_ROD: {
    id: 'm4_rod',
    type: 'threaded_rod',
    threadSize: 'M4',
    clearanceRadius: 2.2,
    rodLength: 150,
  },
  M5_THREADED_ROD: {
    id: 'm5_rod',
    type: 'threaded_rod',
    threadSize: 'M5',
    clearanceRadius: 2.7,
    rodLength: 200,
  },
  M8_THREADED_ROD: {
    id: 'm8_rod',
    type: 'threaded_rod',
    threadSize: 'M8',
    clearanceRadius: 4.3,
    rodLength: 300,
  },

  // === SELF-TAPPING SCREWS (for plastic, no insert needed) ===
  M2_SELF_TAP: {
    id: 'm2_self_tap',
    type: 'self_tapping',
    threadSize: 'M2',
    clearanceRadius: 1.1,
    pilotHoleRadius: 0.8,
    headRadius: 2.0,
    headDepth: 1.5,
  },
  M3_SELF_TAP: {
    id: 'm3_self_tap',
    type: 'self_tapping',
    threadSize: 'M3',
    clearanceRadius: 1.65,
    pilotHoleRadius: 1.2,
    headRadius: 3.0,
    headDepth: 2.0,
  },
  M4_SELF_TAP: {
    id: 'm4_self_tap',
    type: 'self_tapping',
    threadSize: 'M4',
    clearanceRadius: 2.2,
    pilotHoleRadius: 1.6,
    headRadius: 4.0,
    headDepth: 2.5,
  },

  // === DOWEL PINS (alignment) ===
  DOWEL_3MM: {
    id: 'dowel_3',
    type: 'dowel_pin',
    threadSize: 'D3',
    clearanceRadius: 1.6,
  },
  DOWEL_4MM: {
    id: 'dowel_4',
    type: 'dowel_pin',
    threadSize: 'D4',
    clearanceRadius: 2.1,
  },
  DOWEL_5MM: {
    id: 'dowel_5',
    type: 'dowel_pin',
    threadSize: 'D5',
    clearanceRadius: 2.6,
  },
  DOWEL_6MM: {
    id: 'dowel_6',
    type: 'dowel_pin',
    threadSize: 'D6',
    clearanceRadius: 3.1,
  },
  DOWEL_8MM: {
    id: 'dowel_8',
    type: 'dowel_pin',
    threadSize: 'D8',
    clearanceRadius: 4.1,
  },

  // === MAGNETS ===
  MAGNET_6x3: {
    id: 'mag_6x3',
    type: 'magnet',
    threadSize: 'MAG6x3',
    clearanceRadius: 3.1,
    magnetDepth: 3.0,
  },
  MAGNET_8x3: {
    id: 'mag_8x3',
    type: 'magnet',
    threadSize: 'MAG8x3',
    clearanceRadius: 4.1,
    magnetDepth: 3.0,
  },
  MAGNET_10x3: {
    id: 'mag_10x3',
    type: 'magnet',
    threadSize: 'MAG10x3',
    clearanceRadius: 5.1,
    magnetDepth: 3.0,
  },
  MAGNET_10x5: {
    id: 'mag_10x5',
    type: 'magnet',
    threadSize: 'MAG10x5',
    clearanceRadius: 5.1,
    magnetDepth: 5.0,
  },
  MAGNET_12x3: {
    id: 'mag_12x3',
    type: 'magnet',
    threadSize: 'MAG12x3',
    clearanceRadius: 6.1,
    magnetDepth: 3.0,
  },

  // === BALL BEARINGS ===
  BEARING_608: {
    id: 'bearing_608',
    type: 'bearing',
    threadSize: '608',
    clearanceRadius: 11.0,
    bearingOD: 22.0,
    bearingID: 8.0,
    bearingWidth: 7.0,
  },
  BEARING_6001: {
    id: 'bearing_6001',
    type: 'bearing',
    threadSize: '6001',
    clearanceRadius: 14.0,
    bearingOD: 28.0,
    bearingID: 12.0,
    bearingWidth: 8.0,
  },
  BEARING_6202: {
    id: 'bearing_6202',
    type: 'bearing',
    threadSize: '6202',
    clearanceRadius: 17.5,
    bearingOD: 35.0,
    bearingID: 15.0,
    bearingWidth: 11.0,
  },
  BEARING_6003: {
    id: 'bearing_6003',
    type: 'bearing',
    threadSize: '6003',
    clearanceRadius: 17.5,
    bearingOD: 35.0,
    bearingID: 17.0,
    bearingWidth: 10.0,
  },
  BEARING_625: {
    id: 'bearing_625',
    type: 'bearing',
    threadSize: '625',
    clearanceRadius: 8.0,
    bearingOD: 16.0,
    bearingID: 5.0,
    bearingWidth: 5.0,
  },
  BEARING_624: {
    id: 'bearing_624',
    type: 'bearing',
    threadSize: '624',
    clearanceRadius: 6.5,
    bearingOD: 13.0,
    bearingID: 4.0,
    bearingWidth: 5.0,
  },
};
