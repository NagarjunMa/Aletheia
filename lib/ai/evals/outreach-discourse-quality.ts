import { evaluateDiscourse, type DiscourseSample } from "./discourse-quality";
export function evaluateOutreachDiscourse(sample: DiscourseSample) {
  if (sample.category === "yc_application")
    throw new Error("Invalid outreach evaluation category");
  return evaluateDiscourse(sample);
}
