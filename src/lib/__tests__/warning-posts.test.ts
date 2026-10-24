import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { planWarningPosts, buildWarningPostHtml, warningNoteSuffix } from "../warning-posts";
import { parseWellingtonAlert, type WeatherWarning } from "../weather-warnings";

const warningForTest = (id: string, colourName: string, references: string[] = []) =>
  ({ id, colourName, references }) as WeatherWarning;

const REAL = parseWellingtonAlert(
  readFileSync(join(__dirname, "fixtures", "cap-wellington-wind.xml"), "utf8"),
  new Date("2026-10-26T12:00:00+13:00"),
)!;

describe("planWarningPosts", () => {
  it("posts a new orange or red warning", () => {
    const orange = warningForTest("a", "Orange");
    expect(planWarningPosts([orange], {}).post).toEqual([{ warning: orange, kind: "new" }]);
  });

  it("ignores yellow watches", () => {
    expect(planWarningPosts([warningForTest("a", "Yellow")], {})).toEqual({ post: [], record: [] });
  });

  it("doesn't repost a warning it already posted", () => {
    expect(planWarningPosts([warningForTest("a", "Orange")], { a: "Orange" })).toEqual({ post: [], record: [] });
  });

  it("records a reissue of a posted warning without posting it again", () => {
    const reissue = warningForTest("b", "Orange", ["a"]);
    expect(planWarningPosts([reissue], { a: "Orange" })).toEqual({ post: [], record: [reissue] });
  });

  it("posts a watch upgraded to orange, since the watch was never posted", () => {
    const upgraded = warningForTest("b", "Orange", ["watch"]);
    expect(planWarningPosts([upgraded], {}).post).toEqual([{ warning: upgraded, kind: "new" }]);
  });

  it("posts again when an orange warning is upgraded to red, but only once", () => {
    const red = warningForTest("b", "Red", ["a"]);
    expect(planWarningPosts([red], { a: "Orange" }).post).toEqual([{ warning: red, kind: "upgrade" }]);
    expect(planWarningPosts([warningForTest("c", "Red", ["b"])], { a: "Orange", b: "Red" }).post).toEqual([]);
  });
});

describe("buildWarningPostHtml", () => {
  it("builds a toot from the real Wellington wind warning", () => {
    const html = buildWarningPostHtml(REAL, "new");
    expect(html).toContain("🟠 <strong>Strong Wind Warning - Orange</strong> for Wellington<br>6pm Mon 26 Oct – 10am Tue 27 Oct");
    expect(html).toContain("<p>Severe gale northwest winds gusting 120 km/h");
    expect(html).toContain("<p>Action: Prepare your property");
    expect(html).toContain('<a href="https://metservice.com/warnings/home">MetService</a>');
    expect(html).toContain("#Wellington #WellingtonWeather");
  });

  it("marks upgrades and uses red for red warnings", () => {
    const html = buildWarningPostHtml({ ...REAL, colourName: "Red", headline: "Strong Wind Warning - Red" }, "upgrade");
    expect(html).toContain("🔴 Now upgraded: <strong>Strong Wind Warning - Red</strong>");
  });

  it("escapes HTML from the feed", () => {
    const html = buildWarningPostHtml({ ...REAL, description: '<script>alert("x")</script> & more' }, "new");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more");
    expect(html).not.toContain("<script>");
  });
});

describe("warningNoteSuffix", () => {
  it("makes a URL-safe id from the CAP identifier", () => {
    expect(warningNoteSuffix(REAL)).toBe("warning-2-49-0-0-554-0-severeweather-nz-20261024200303269-9");
  });
});
