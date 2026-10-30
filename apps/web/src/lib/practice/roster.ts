// The people of an exercise as the stage knows them (Crew, exercise.ts): all of them, its lead, and
// who is on the ground, by name, by node and by how near.

import { distanceMeters } from '@tesel/core';
import type { LatLon, NodeId } from '@tesel/protocol';

import type { Crew } from './exercise.ts';
import type { Teammate } from './teammate.ts';

export class Roster implements Crew {
  readonly all: readonly Teammate[];
  readonly lead: Teammate;
  readonly #byAlias: ReadonlyMap<string, Teammate>;
  readonly #byNode: ReadonlyMap<NodeId, Teammate>;

  constructor(teammates: readonly Teammate[]) {
    const [first] = teammates;
    if (first === undefined) throw new Error('an exercise with nobody in it');
    this.all = teammates;
    this.lead =
      teammates.find((teammate) => teammate.coordinates) ??
      teammates.find((teammate) => teammate.remote) ??
      first;
    this.#byAlias = new Map(teammates.map((teammate) => [teammate.alias, teammate]));
    this.#byNode = new Map(teammates.map((teammate) => [teammate.node, teammate]));
  }

  get onTheGround(): Teammate[] {
    return this.all.filter((teammate) => teammate.onFoot);
  }

  byAlias(alias: string): Teammate | undefined {
    return this.#byAlias.get(alias);
  }

  byNode(node: NodeId): Teammate | undefined {
    return this.#byNode.get(node);
  }

  nearest(at: LatLon, can: (who: Teammate) => boolean = () => true): Teammate | undefined {
    const now = Date.now();
    return this.onTheGround
      .filter(can)
      .sort((a, b) => distanceMeters(a.at(now), at) - distanceMeters(b.at(now), at))[0];
  }
}
