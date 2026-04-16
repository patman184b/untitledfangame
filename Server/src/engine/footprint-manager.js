/**
 * Manages the geometric footprints of multi-hex structures on the axial grid.
 */
export class FootprintManager {
  /**
   * Returns a list of axial coordinates (q, r) part of a structure.
   */
  static getFootprint(type, anchorQ, anchorR) {
    const coords = [];

    switch (type.toLowerCase()) {
      case 'city': // 5x5 equivalent (Radius 2)
        return this.getHexRadius(anchorQ, anchorR, 2);
      
      case 'base': // 3x3 equivalent (Radius 1)
        return this.getHexRadius(anchorQ, anchorR, 1);
      
      case 'fortress': // 2x2 cluster
      case 'resource_cluster':
        // Bottom-left anchor based (q, r), (q+1, r), (q, r+1), (q+1, r-1) etc.
        // On a pointy-topped hex grid, a 2x2 cluster is usually a rhombus.
        return [
          { q: anchorQ, r: anchorR },
          { q: anchorQ + 1, r: anchorR },
          { q: anchorQ, r: anchorR + 1 },
          { q: anchorQ + 1, r: anchorR - 1 }
        ];

      case 'fort':
      case 'tile':
      default:
        return [{ q: anchorQ, r: anchorR }];
    }
  }

  /**
   * Standard hex distance radius.
   */
  static getHexRadius(q, r, radius) {
    const results = [];
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
        results.push({ q: q + dq, r: r + dr });
      }
    }
    return results;
  }
}
