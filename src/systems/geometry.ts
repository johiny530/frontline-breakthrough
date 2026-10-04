/** True if segment (x0,z0)->(x1,z1) passes within r of (cx,cz). */
export function segmentHitsCircle(
  x0: number, z0: number, x1: number, z1: number,
  cx: number, cz: number, r: number,
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((cx - x0) * dx + (cz - z0) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + dx * t - cx;
  const pz = z0 + dz * t - cz;
  return px * px + pz * pz <= r * r;
}
