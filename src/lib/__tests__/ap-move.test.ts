import { describe, it, expect } from "vitest";
import { buildMoveActivity } from "../ap-move";
import { OLD_ACTOR, NEW_ACTOR } from "../ap-identity";

describe("buildMoveActivity", () => {
  it("moves from the old actor to the new actor", () => {
    const move = buildMoveActivity();
    expect(move.type).toBe("Move");
    expect(move.actor).toBe(OLD_ACTOR.actorId);
    expect(move.object).toBe(OLD_ACTOR.actorId);
    expect(move.target).toBe(NEW_ACTOR.actorId);
  });

  it("includes a unique id and a published timestamp", () => {
    const move = buildMoveActivity();
    expect(move.id).toMatch(new RegExp(`^${OLD_ACTOR.base}/actor/moves/\\d+$`));
    expect(() => new Date(move.published as string).toISOString()).not.toThrow();
  });

  it("uses the plain activitystreams context, no gts extensions needed for Move", () => {
    const move = buildMoveActivity();
    expect(move["@context"]).toBe("https://www.w3.org/ns/activitystreams");
  });
});
