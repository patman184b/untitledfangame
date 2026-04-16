export class HexPathfinding {
  /**
   * Neighbors for an Axial (q, r) hex.
   */
  static getNeighbors(q, r) {
    return [
      { q: q + 1, r: r }, { q: q + 1, r: r - 1 }, { q: q, r: r - 1 },
      { q: q - 1, r: r }, { q: q - 1, r: r + 1 }, { q: q, r: r + 1 }
    ];
  }

  /**
   * Simple A* implementation for Hex Grid.
   * @param {Object} start {q, r}
   * @param {Object} goal {q, r}
   * @param {Function} isPassable function(q, r) => boolean
   */
  static findPath(start, goal, isPassable) {
    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const key = (p) => `${p.q},${p.r}`;
    
    gScore.set(key(start), 0);
    fScore.set(key(start), this.heuristic(start, goal));

    while (openSet.length > 0) {
      // Sort by fScore
      openSet.sort((a, b) => (fScore.get(key(a)) || Infinity) - (fScore.get(key(b)) || Infinity));
      const current = openSet.shift();

      if (current.q === goal.q && current.r === goal.r) {
        return this.reconstructPath(cameFrom, current);
      }

      const neighbors = this.getNeighbors(current.q, current.r);
      for (const neighbor of neighbors) {
        if (!isPassable(neighbor.q, neighbor.r)) continue;

        const tentativeGScore = gScore.get(key(current)) + 1; // All hexes move cost 1 for now

        if (tentativeGScore < (gScore.get(key(neighbor)) || Infinity)) {
          cameFrom.set(key(neighbor), current);
          gScore.set(key(neighbor), tentativeGScore);
          fScore.set(key(neighbor), tentativeGScore + this.heuristic(neighbor, goal));
          
          if (!openSet.some(p => p.q === neighbor.q && p.r === neighbor.r)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    return null; // No path found
  }

  static heuristic(a, b) {
    // Hex distance
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  }

  static reconstructPath(cameFrom, current) {
    const totalPath = [current];
    const key = (p) => `${p.q},${p.r}`;
    while (cameFrom.has(key(current))) {
      current = cameFrom.get(key(current));
      totalPath.unshift(current);
    }
    return totalPath;
  }
}
