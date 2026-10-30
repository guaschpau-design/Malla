// What the teammates do about tasks. A task for a teammate, or for their team, that none of them
// is on is taken by those free to do it: a moment later, one of them says so now and then, marks it
// taken and they all set off, walk it (errands.ts) and say when it is done. A task they cannot get
// to without crossing what cannot be crossed (water, a fire) they say so of, and leave for a while.
// Someone cut off from the network hears of a task only once they have coverage again.
// A search area whose every strip is done is marked cleared. Whoever went to help someone goes back
// to their task once that is over, and whoever was on a task no longer theirs leaves it.

import { eventRefKey, ShapeStyleCode, type TaskEvent } from '@tesel/protocol';

import { areasToClear } from '../../objects/sweeps.ts';
import { aliasOf } from '../../members/alias.ts';
import { doersOf, errandOf } from '../errands.ts';
import type { Stage } from '../exercise.ts';
import type { Job, Teammate } from '../teammate.ts';

/** How long teammates take to take a task given to them. */
const TAKE_TASK_S = 6;
/** How likely they are to say so in the chat: not every time, as people do not. */
const SAY_TAKEN = 0.6;
/** How long a task at one place takes once there: a word with the neighbours, a cure, a rescue. */
const WORK_AT_PLACE_S = 75;
/** How long a task they could not get to is left before they try again. */
const RETRY_AFTER_S = 120;
/** How long the user's thanks-worthy deed waits for its thanks. */
const THANKS_S = 5;

export class TaskRoutine {
  /** Task versions, by key, they could not get to, and until when they leave them. */
  readonly #leftUntil = new Map<string, number>();

  tick(stage: Stage): void {
    this.#leaveWhatIsOver(stage);
    this.#takeTasks(stage);
    this.#clearSweptAreas(stage);
    this.#thankUser(stage);
  }

  /**
   * Teammates leave what is over: a task done, cancelled or no longer theirs, an SOS ended. Whoever
   * left a task to help goes back to it, if it is still theirs.
   */
  #leaveWhatIsOver(stage: Stage): void {
    for (const teammate of stage.crew.onTheGround) {
      // Someone cut off does not know their task is over.
      if (!stage.hears(teammate)) continue;
      const { job, resume } = teammate;
      if (job?.kind === 'task' && !isFor(stage, job.task, teammate)) teammate.stop(stage.now);
      if (job?.kind === 'help' && stage.state.sosCancels.has(job.sos)) {
        teammate.stop(stage.now);
        if (resume !== null && isFor(stage, resume, teammate)) this.#work(stage, teammate, resume);
      }
    }
  }

  /** Tasks to do for teammates, or their teams, that none of them is on are taken. */
  #takeTasks(stage: Stage): void {
    for (const [key, task] of stage.state.tasks) {
      if (task.status !== 'open' && task.status !== 'in-progress') continue;
      const version = eventRefKey(task);
      if ((this.#leftUntil.get(version) ?? 0) > stage.now) continue;
      const doers = doersFor(stage, task);
      const free = doers.filter((doer) => doer.free && !doer.silent && stage.hears(doer));
      if (free.length === 0 || doers.some((doer) => doer.isOn(key))) continue;
      const taking: Job = { kind: 'task', task: key };
      for (const doer of free) doer.go(taking, [], stage.now);
      stage.after(TAKE_TASK_S, () => {
        // Those still on it: not hurt or gone to help meanwhile.
        const ready = free.filter((doer) => doer.job === taking);
        const latest = stage.state.tasks.get(key);
        const [lead] = ready;
        if (lead === undefined) return;
        if (latest === undefined || eventRefKey(latest) !== version) {
          // Changed meanwhile: it is taken afresh as it now is, if it is still theirs.
          for (const doer of ready) doer.stop(stage.now);
          return;
        }
        const started = ready.filter((doer) => this.#work(stage, doer, key));
        if (started.length === 0) {
          // Left for a while, and tried again then without a word, as the way may have cleared.
          this.#leftUntil.set(version, stage.now + RETRY_AFTER_S * 1000);
          if (stage.once(`no way ${key}`)) {
            stage.say(lead.alias, stage.line('noWay', { task: latest.text }));
          }
          return;
        }
        if (stage.chance.odds(SAY_TAKEN)) {
          stage.say(lead.alias, stage.line('taken', { task: latest.text }));
        }
        if (latest.status === 'open') {
          stage.send(lead, (header) => ({ ...latest, ...header, status: 'in-progress' }));
        }
      });
    }
  }

  /**
   * Sets a teammate off through a task and, once through it, has them say it is done, if they are
   * still on it then and nobody has said so. False if there is no way there they can walk.
   */
  #work(stage: Stage, teammate: Teammate, key: string): boolean {
    const task = stage.state.tasks.get(key);
    if (task === undefined) return false;
    const errand = errandOf(task, stage.state.objects, stage.ground.network);
    const job: Job = { kind: 'task', task: key };
    const arrival = stage.walk(teammate, job, errand);
    if (arrival === null) {
      teammate.stop(stage.now);
      return false;
    }
    // Along a line, through an area or a strip, the walk is the work; at one place, there is work
    // there.
    const workS = errand.kind === 'along' && errand.points.length === 1 ? WORK_AT_PLACE_S : 0;
    stage.after((arrival - stage.now) / 1000 + workS, () => {
      const latest = stage.state.tasks.get(key);
      if (teammate.job !== job || latest === undefined || !isFor(stage, key, teammate)) return;
      teammate.stop(stage.now);
      if (!stage.once(`done ${eventRefKey(latest)}`)) return;
      stage.send(teammate, (header) => ({ ...latest, ...header, status: 'done' }));
      stage.say(teammate.alias, stage.line('done', { task: latest.text }));
    });
    return true;
  }

  /** A search area whose sweep a teammate finished is marked cleared by that teammate. */
  #clearSweptAreas(stage: Stage): void {
    for (const teammate of stage.crew.onTheGround) {
      for (const area of areasToClear(stage.state, teammate.node)) {
        if (!stage.once(`clear ${eventRefKey(area.object)}`)) continue;
        const style = ShapeStyleCode.SEARCH_CLEARED;
        stage.send(teammate, (header) => ({ ...area, ...header, style }));
      }
    }
  }

  /** Whoever gave the user a task thanks them for doing it. */
  #thankUser(stage: Stage): void {
    for (const task of stage.state.tasks.values()) {
      const giver = stage.crew.byNode(task.task.origin);
      if (task.status !== 'done' || task.origin !== stage.user.node || giver === undefined)
        continue;
      if (!stage.once(`thanks ${eventRefKey(task.task)}`)) continue;
      const name = aliasOf(stage.state, stage.user.node);
      stage.after(THANKS_S, () => {
        stage.say(giver.alias, stage.line('thanks', { name }));
      });
    }
  }
}

/** Whether a task, by its key, is still to do and for a teammate, or their team. */
function isFor(stage: Stage, key: string, teammate: Teammate): boolean {
  const task = stage.state.tasks.get(key);
  return (
    (task?.status === 'open' || task?.status === 'in-progress') &&
    doersFor(stage, task).includes(teammate)
  );
}

/** The teammates a task is for: the one it names, or those in the team it names. */
function doersFor(stage: Stage, task: TaskEvent): Teammate[] {
  const simulated = new Set(stage.crew.onTheGround.map((teammate) => teammate.node));
  return doersOf(task, stage.state.teams, simulated).flatMap(
    (node) => stage.crew.byNode(node) ?? [],
  );
}
