// The streets and paths simulated members keep to, so that none of them walks through a building,
// across a river or along a motorway. Built from the lines a map gives (the base map's roads and
// paths), joined where they meet, and searched for the shortest way between two points. Only its
// largest connected part is kept: every point of it can be reached from every other.
//
// Work is done on a plane fitted at the network's first point, in metres: exact enough for the
// kilometre or two around a practice.

import { eastNorthMeters, offsetMeters, simplifyLine } from '@tesel/core';
import { SHAPE_MAX_POINTS, type LatLon } from '@tesel/protocol';

import type { Scenario, ScenarioAction, ScenarioMember, ScenarioPlace } from './scenario.ts';

/** Points of two lines this close are one: the same corner, drawn in two tiles of the map. */
const JOIN_M = 1.5;
/**
 * A line that ends this close to another, without sharing a point with it, meets it there: a
 * street cut at a tile's edge, or a side street drawn up to the kerb of a main one.
 */
const SPLICE_M = 4;

interface Plane {
  readonly east: number;
  readonly north: number;
}

interface Edge {
  readonly a: number;
  readonly b: number;
  readonly length: number;
}

/** Where a point meets the network: on an edge, a fraction `along` it from its end `a`. */
interface Meeting {
  readonly edge: number;
  readonly along: number;
  readonly at: Plane;
}

export class WalkNetwork {
  readonly #origin: LatLon;
  readonly #nodes: readonly Plane[];
  readonly #edges: readonly Edge[];
  /** The edges at each node. */
  readonly #at: readonly (readonly number[])[];

  private constructor(origin: LatLon, nodes: readonly Plane[], edges: readonly Edge[]) {
    this.#origin = origin;
    this.#nodes = nodes;
    this.#edges = edges;
    const at: number[][] = nodes.map(() => []);
    edges.forEach((edge, index) => {
      at[edge.a]?.push(index);
      at[edge.b]?.push(index);
    });
    this.#at = at;
  }

  /** The network the lines make; null if they make none, as where the map has no streets. */
  static from(lines: readonly (readonly LatLon[])[]): WalkNetwork | null {
    const origin = lines.find((line) => line.length > 1)?.[0];
    if (origin === undefined) return null;
    const builder = new NetworkBuilder();
    for (const line of lines) {
      const points = line.map((point) => eastNorthMeters(origin, point));
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        if (from !== undefined && to !== undefined) builder.addSegment(from, to);
      }
    }
    builder.spliceLooseEnds();
    const { nodes, edges } = builder.largestPart();
    return edges.length === 0 ? null : new WalkNetwork(origin, nodes, edges);
  }

  /** Metres of street and path in the network. */
  get length(): number {
    return this.#edges.reduce((sum, edge) => sum + edge.length, 0);
  }

  /** The point of the network nearest to `at`: where someone standing there would step onto it. */
  snap(at: LatLon): LatLon {
    return this.#latLon(this.#meet(at).at);
  }

  /**
   * The way along the network through each of `points` in turn, from where each meets it: the
   * nearest point of the network for a single one.
   */
  through(points: readonly LatLon[]): LatLon[] {
    const [first, ...rest] = points.map((point) => this.snap(point));
    if (first === undefined) return [];
    const way = [first];
    for (const next of rest) way.push(...this.way(way.at(-1) ?? first, next).slice(1));
    return way;
  }

  /**
   * The shortest way along the network from where `from` meets it to where `to` does, as the
   * points to walk through, both ends included.
   */
  way(from: LatLon, to: LatLon): LatLon[] {
    const start = this.#meet(from);
    const end = this.#meet(to);
    if (start.edge === end.edge) return [start.at, end.at].map((point) => this.#latLon(point));
    const startEdge = this.#edge(start.edge);
    const endEdge = this.#edge(end.edge);
    const { cost, previous } = this.#shortestFrom([
      [startEdge.a, start.along * startEdge.length],
      [startEdge.b, (1 - start.along) * startEdge.length],
    ]);
    // Into the last edge by whichever of its ends is reached for less, all the way to the point.
    const viaA = (cost[endEdge.a] ?? Infinity) + end.along * endEdge.length;
    const viaB = (cost[endEdge.b] ?? Infinity) + (1 - end.along) * endEdge.length;
    const nodes: number[] = [];
    for (let node = viaA <= viaB ? endEdge.a : endEdge.b; node !== -1;) {
      nodes.push(node);
      node = previous[node] ?? -1;
    }
    nodes.reverse();
    const points = [start.at, ...nodes.map((node) => this.#node(node)), end.at];
    return points.map((point) => this.#latLon(point));
  }

  /** Dijkstra's search from several nodes at once, each with the cost of getting to it. */
  #shortestFrom(sources: readonly (readonly [number, number])[]): {
    cost: number[];
    previous: number[];
  } {
    const cost = this.#nodes.map(() => Infinity);
    const previous = this.#nodes.map(() => -1);
    const queue = new MinQueue();
    for (const [node, start] of sources) {
      if (start < (cost[node] ?? Infinity)) {
        cost[node] = start;
        queue.push(node, start);
      }
    }
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
      const [node, reached] = next;
      if (reached > (cost[node] ?? Infinity)) continue;
      for (const index of this.#at[node] ?? []) {
        const edge = this.#edge(index);
        const other = edge.a === node ? edge.b : edge.a;
        const through = reached + edge.length;
        if (through < (cost[other] ?? Infinity)) {
          cost[other] = through;
          previous[other] = node;
          queue.push(other, through);
        }
      }
    }
    return { cost, previous };
  }

  #meet(at: LatLon): Meeting {
    const point = eastNorthMeters(this.#origin, at);
    let best: Meeting & { readonly meters: number } = {
      edge: 0,
      along: 0,
      at: this.#node(this.#edge(0).a),
      meters: Infinity,
    };
    this.#edges.forEach((edge, index) => {
      const near = nearestOnSegment(point, this.#node(edge.a), this.#node(edge.b));
      if (near.meters < best.meters) best = { edge: index, ...near };
    });
    return best;
  }

  #node(index: number): Plane {
    const node = this.#nodes[index];
    if (node === undefined) throw new Error(`no node ${String(index)}`);
    return node;
  }

  #edge(index: number): Edge {
    const edge = this.#edges[index];
    if (edge === undefined) throw new Error(`no edge ${String(index)}`);
    return edge;
  }

  #latLon(point: Plane): LatLon {
    return offsetMeters(this.#origin, point.north, point.east);
  }
}

/**
 * The scenario kept to the network: each member walks the streets and paths between the points of
 * their route, and stands on the nearest one if they stand still. Markers and the places of tasks
 * are moved onto it, as a meeting point or a blocked road would be, and lines (routes) follow it,
 * thinned to what a shape holds. Areas stay as drawn: they cover blocks as well as streets.
 */
export function onFoot(scenario: Scenario, network: WalkNetwork): Scenario {
  const walk = (member: ScenarioMember): ScenarioMember =>
    member.route === undefined ? member : { ...member, route: network.through(member.route) };
  const place = (where: ScenarioPlace | null): ScenarioPlace | null =>
    where?.kind === 'point' ? { kind: 'point', at: network.snap(where.at) } : where;
  const act = (action: ScenarioAction): ScenarioAction => {
    if (action.type === 'marker') return { ...action, where: network.snap(action.where) };
    if (action.type === 'task') return { ...action, place: place(action.place) };
    if (action.type === 'shape' && action.geometry.kind === 'polyline') {
      const { points } = simplifyLine(network.through(action.geometry.points), SHAPE_MAX_POINTS);
      return { ...action, geometry: { kind: 'polyline', points } };
    }
    return action;
  };
  return {
    ...scenario,
    members: scenario.members.map(walk),
    steps: scenario.steps.map((step) => ({ ...step, action: act(step.action) })),
  };
}

/** Puts the network together: joins the points of lines that touch, then keeps its largest part. */
class NetworkBuilder {
  readonly #nodes: Plane[] = [];
  /** Removed edges are left as null, so the indices of the others hold while splicing. */
  readonly #edges: (Edge | null)[] = [];
  /** Nodes by the cell of a grid `JOIN_M` wide they fall in, to find a point's twin quickly. */
  readonly #cells = new Map<string, number[]>();

  addSegment(from: Plane, to: Plane): void {
    this.#addEdge(this.#nodeAt(from), this.#nodeAt(to));
  }

  /** Joins every line that ends close to another to that other, where it passes. */
  spliceLooseEnds(): void {
    const degree = this.#nodes.map(() => 0);
    for (const edge of this.#edges) {
      if (edge === null) continue;
      degree[edge.a] = (degree[edge.a] ?? 0) + 1;
      degree[edge.b] = (degree[edge.b] ?? 0) + 1;
    }
    degree.forEach((count, end) => {
      if (count !== 1) return;
      const point = this.#nodes[end];
      if (point === undefined) return;
      let best: { index: number; at: Plane; meters: number } | null = null;
      for (const [index, edge] of this.#edges.entries()) {
        if (edge === null || edge.a === end || edge.b === end) continue;
        const [a, b] = [this.#nodes[edge.a], this.#nodes[edge.b]];
        if (a === undefined || b === undefined) continue;
        const near = nearestOnSegment(point, a, b);
        if (near.meters <= SPLICE_M && (best === null || near.meters < best.meters))
          best = { index, at: near.at, meters: near.meters };
      }
      if (best === null) return;
      const { index, at } = best;
      const edge = this.#edges[index];
      if (edge === null || edge === undefined) return;
      const middle = this.#nodeAt(at);
      this.#edges[index] = null;
      this.#addEdge(edge.a, middle);
      this.#addEdge(middle, edge.b);
      this.#addEdge(end, middle);
    });
  }

  /** The largest set of nodes joined to one another, renumbered, with the edges between them. */
  largestPart(): { nodes: Plane[]; edges: Edge[] } {
    const edges = this.#edges.filter((edge): edge is Edge => edge !== null);
    const neighbours: number[][] = this.#nodes.map(() => []);
    for (const edge of edges) {
      neighbours[edge.a]?.push(edge.b);
      neighbours[edge.b]?.push(edge.a);
    }
    const part = this.#nodes.map(() => -1);
    const sizes: number[] = [];
    this.#nodes.forEach((_, start) => {
      if (part[start] !== -1 || (neighbours[start]?.length ?? 0) === 0) return;
      const label = sizes.length;
      sizes.push(0);
      const stack = [start];
      part[start] = label;
      for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
        sizes[label] = (sizes[label] ?? 0) + 1;
        for (const next of neighbours[node] ?? []) {
          if (part[next] !== -1) continue;
          part[next] = label;
          stack.push(next);
        }
      }
    });
    const largest = sizes.indexOf(Math.max(...sizes));
    const renumbered = this.#nodes.map(() => -1);
    const nodes: Plane[] = [];
    this.#nodes.forEach((node, index) => {
      if (part[index] !== largest) return;
      renumbered[index] = nodes.length;
      nodes.push(node);
    });
    return {
      nodes,
      edges: edges
        .filter((edge) => part[edge.a] === largest)
        .map((edge) => ({ ...edge, a: renumbered[edge.a] ?? -1, b: renumbered[edge.b] ?? -1 })),
    };
  }

  #addEdge(a: number, b: number): void {
    const [from, to] = [this.#nodes[a], this.#nodes[b]];
    if (a === b || from === undefined || to === undefined) return;
    this.#edges.push({ a, b, length: Math.hypot(to.east - from.east, to.north - from.north) });
  }

  /** The node at a point: one already within `JOIN_M`, or a new one. */
  #nodeAt(point: Plane): number {
    const column = Math.floor(point.east / JOIN_M);
    const row = Math.floor(point.north / JOIN_M);
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (const index of this.#cells.get(`${String(column + dc)},${String(row + dr)}`) ?? []) {
          const node = this.#nodes[index];
          if (node && Math.hypot(node.east - point.east, node.north - point.north) <= JOIN_M)
            return index;
        }
      }
    }
    const index = this.#nodes.length;
    this.#nodes.push(point);
    const key = `${String(column)},${String(row)}`;
    this.#cells.set(key, [...(this.#cells.get(key) ?? []), index]);
    return index;
  }
}

/** The point of a segment nearest to another point, all on the plane. */
function nearestOnSegment(
  point: Plane,
  a: Plane,
  b: Plane,
): { along: number; at: Plane; meters: number } {
  const east = b.east - a.east;
  const north = b.north - a.north;
  const lengthSquared = east ** 2 + north ** 2;
  const along =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((point.east - a.east) * east + (point.north - a.north) * north) / lengthSquared,
          ),
        );
  const at = { east: a.east + along * east, north: a.north + along * north };
  return { along, at, meters: Math.hypot(point.east - at.east, point.north - at.north) };
}

/** A binary heap of nodes by cost, cheapest first. */
class MinQueue {
  readonly #heap: [number, number][] = [];

  push(node: number, cost: number): void {
    const heap = this.#heap;
    heap.push([node, cost]);
    for (let child = heap.length - 1; child > 0;) {
      const parent = (child - 1) >> 1;
      const [up, down] = [heap[parent], heap[child]];
      if (up === undefined || down === undefined || up[1] <= down[1]) break;
      heap[parent] = down;
      heap[child] = up;
      child = parent;
    }
  }

  pop(): [number, number] | undefined {
    const heap = this.#heap;
    const top = heap[0];
    const last = heap.pop();
    if (top === undefined || last === undefined || heap.length === 0) return top;
    heap[0] = last;
    for (let parent = 0; ;) {
      const left = 2 * parent + 1;
      const smallest = [left, left + 1].reduce(
        (best, child) =>
          (heap[child]?.[1] ?? Infinity) < (heap[best]?.[1] ?? Infinity) ? child : best,
        parent,
      );
      if (smallest === parent) break;
      const [a, b] = [heap[parent], heap[smallest]];
      if (a === undefined || b === undefined) break;
      heap[parent] = b;
      heap[smallest] = a;
      parent = smallest;
    }
    return top;
  }
}
