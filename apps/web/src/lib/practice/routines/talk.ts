// What the teammates say to the user. Someone named in a message answers it; a question of where
// they are, or of how it is going, gets where they are or what they are on; anything else gets a
// word now and then from whoever leads. A report gets an answer too. When the user coordinates,
// teammates left with nothing to do ask what to do next, as people waiting at a meeting point do;
// not those standing guard at a post.

import { eventRefKey } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';

/** How long, at least and at most, someone takes to answer the user. */
const REPLY_S = [4, 9] as const;
/** The least time between answers nobody was asked for by name. */
const REPLY_GAP_S = 30;
/** How long teammates wait with nothing to do before they ask. */
const IDLE_ASK_S = 90;
/** The least time between their asking. */
const IDLE_GAP_S = 240;
/** The most people who answer one message. */
const MOST_ANSWERS = 2;

const WHERE = /\b(d[oó]nde|where)\b/iu;
const HOW = /(c[oó]mo (vais|va|est[aá]is|lo llev[aá]is)|qu[eé] tal|how (is|are)|status)/iu;

export class TalkRoutine {
  #lastReplyMs = -Infinity;
  #lastIdleAskMs = -Infinity;

  tick(stage: Stage): void {
    this.#answerMessages(stage);
    this.#answerReports(stage);
    if (stage.user.role === 'coordinator') this.#askForWork(stage);
  }

  #answerMessages(stage: Stage): void {
    for (const message of stage.state.chat) {
      if (message.origin !== stage.user.node) continue;
      if (!stage.once(`answer ${eventRefKey(message)}`)) continue;
      const named = stage.crew.onTheGround.filter(
        (teammate) => !teammate.silent && mentions(message.text, teammate.alias),
      );
      const asks = WHERE.test(message.text) ? 'where' : HOW.test(message.text) ? 'how' : null;
      if (named.length === 0 && !this.#mayReply(stage)) continue;
      const answering = named.length > 0 ? named.slice(0, MOST_ANSWERS) : [spokesperson(stage)];
      for (const teammate of answering) {
        const text = asks === null ? stage.line('heard') : this.#about(stage, teammate, asks);
        stage.after(stage.chance.between(...REPLY_S), () => {
          stage.say(teammate.alias, text);
        });
      }
    }
  }

  #answerReports(stage: Stage): void {
    for (const report of stage.state.reports) {
      if (report.origin !== stage.user.node) continue;
      if (!stage.once(`answer ${eventRefKey(report)}`) || !this.#mayReply(stage)) continue;
      stage.after(stage.chance.between(...REPLY_S), () => {
        stage.say(stage.crew.lead.alias, stage.line('reportHeard'));
      });
    }
  }

  /** Whether an answer nobody asked for by name may go now: not too soon after the last. */
  #mayReply(stage: Stage): boolean {
    if (stage.now - this.#lastReplyMs < REPLY_GAP_S * 1000) return false;
    this.#lastReplyMs = stage.now;
    return true;
  }

  /** Where a teammate is, or what they are on. */
  #about(stage: Stage, teammate: Teammate, asks: 'where' | 'how'): string {
    if (asks === 'where' || teammate.remote) {
      const where = stage.ground.where(stage.t, teammate.at(stage.now), landmarkOf(stage));
      return stage.line('where', { where });
    }
    const { job } = teammate;
    if (job?.kind === 'task') {
      const task = stage.state.tasks.get(job.task);
      if (task) return stage.line('doing', { task: task.text });
    }
    if (job?.kind === 'help') {
      const called = stage.crew.byNode(stage.state.sos.get(job.sos)?.origin ?? teammate.node);
      return stage.line('helping', { name: called?.alias ?? stage.user.name });
    }
    if (job?.kind === 'scene') return job.what;
    return stage.line('free');
  }

  /** Teammates left with nothing to do for a while ask what to do next. */
  #askForWork(stage: Stage): void {
    if (stage.now - this.#lastIdleAskMs < IDLE_GAP_S * 1000) return;
    const idle = stage.crew.onTheGround.filter((teammate) => {
      const since = teammate.idleSince;
      return (
        teammate.free &&
        !teammate.silent &&
        teammate.post === null &&
        since !== null &&
        stage.now - since > IDLE_ASK_S * 1000
      );
    });
    const [speaker] = idle;
    if (speaker === undefined) return;
    this.#lastIdleAskMs = stage.now;
    const where = stage.ground.where(stage.t, speaker.at(stage.now), landmarkOf(stage));
    const names = stage.list(idle.map((teammate) => teammate.alias));
    stage.say(speaker.alias, stage.line('idle', { names, where }));
  }
}

/**
 * Who answers what the user says to everyone: whoever coordinates, when the user is a member;
 * someone of the team, when the user coordinates it.
 */
function spokesperson(stage: Stage): Teammate {
  if (stage.user.role === 'member') return stage.crew.lead;
  return stage.crew.onTheGround.find((teammate) => !teammate.silent) ?? stage.crew.lead;
}

/** Whether a message names someone, as a word of its own, whatever the case and accents. */
function mentions(text: string, name: string): boolean {
  const plain = (words: string) =>
    words
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  return new RegExp(`\\b${plain(name)}\\b`, 'u').test(plain(text));
}
