import type { ContentDelta } from "./frameAnalysis";
import type { MomentReason } from "./useSlidSession";

/*
 * A moment is a topic, not a frame.
 *
 * Measured on a four-minute presentation with three slides and seven build
 * steps, an earlier rule kept seven moments: every bullet that appeared was a
 * moment of its own. Extrapolated to a one-hour lecture that is around a
 * hundred captures, which is a camera roll, not a class.
 *
 * So change is weighed against the content already on the surface rather than
 * against the frame. A mouse cursor is 7 % of a slide's content; a new slide
 * is 100 % of it. One threshold then means the same thing on a dense slide and
 * on a board with two lines.
 *
 *                              cresceu   perdeu
 *   bullet aparecendo           0.05–0.18   ~0.00
 *   troca de slide              0.09        0.27–0.30
 *
 * What separates a new topic from the same topic growing is not how much
 * changed but whether anything was taken away.
 *
 * This lives apart from the session hook so the rule can be simulated over a
 * whole lecture without a browser — the shipped rule, not a copy of it.
 */

/** Content lost, as a share of what was there: the surface was replaced. */
export const REPLACED_RATIO = 0.15;
/** Content gained, as a share of what was there: the same topic, more complete. */
export const GROWTH_RATIO = 0.1;
/** Absolute floor, so a nearly empty surface cannot make ratios explode. */
export const MIN_CHANGE = 0.0025;
/** Change outside the content at this scale means the camera moved, not the class. */
export const REFRAMED = 0.006;
/** Consecutive ticks of that before the reference moves: a twitch is not a reframe. */
export const REFRAME_TICKS = 3;

/**
 * What this change means for the class, or nothing, which is the answer most
 * of the time.
 *
 * Three outcomes, and the middle one is the whole point. Content replaced is a
 * new topic. Content *added* to what is already kept is the same topic getting
 * more complete — the bullets of a slide arriving one by one, the lecturer
 * writing the second line under the first — and the moment already saved is
 * refined rather than duplicated. Everything else is a cursor, an animation,
 * a flicker: not a learning event.
 */
export interface MomentDecision {
  refine: boolean;
  reason: MomentReason;
}

export function decideMoment(
  { added, removed }: ContentDelta,
  contentArea: number,
): MomentDecision | null {
  // Nothing kept yet: the first steady surface is the starting state.
  if (contentArea <= 0) return { refine: false, reason: "novo-topico" };

  const growth = added / contentArea;
  const loss = removed / contentArea;

  if (removed >= MIN_CHANGE && loss >= REPLACED_RATIO) {
    // Wiped and rewritten, or the slide moved on.
    return {
      refine: false,
      reason: added >= MIN_CHANGE ? "novo-slide" : "novo-topico",
    };
  }

  if (added >= MIN_CHANGE && growth >= GROWTH_RATIO) {
    return { refine: true, reason: "novo-conteudo" };
  }

  return null;
}
