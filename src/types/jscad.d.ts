declare module '@jscad/modeling' {
  const pkg: {
    primitives: {
      cuboid: (params: Record<string, unknown>) => unknown;
      cylinder: (params: Record<string, unknown>) => unknown;
      sphere: (params: Record<string, unknown>) => unknown;
    };
    booleans: {
      union: (...geoms: unknown[]) => unknown;
      subtract: (...geoms: unknown[]) => unknown;
      intersect: (...geoms: unknown[]) => unknown;
    };
    transforms: {
      translate: (offset: [number, number, number], geom: unknown) => unknown;
      rotate: (angles: [number, number, number], geom: unknown) => unknown;
      scale: (factors: [number, number, number], geom: unknown) => unknown;
      mirror: (geom: unknown) => unknown;
    };
  };
  export default pkg;
}

declare module '@jscad/io' {
  export function solidsAsBlob(geometry: unknown, options: { format: string }): ArrayBuffer;
  export function makeBlob(geometry: unknown): Blob;
  export const stlSerializer: Record<string, unknown>;
  export const deserializers: Record<string, unknown>;
}
