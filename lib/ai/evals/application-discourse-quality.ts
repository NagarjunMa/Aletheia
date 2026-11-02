import { evaluateDiscourse, type DiscourseSample } from "./discourse-quality";
export function evaluateApplicationDiscourse(sample: DiscourseSample) {
  if (sample.category !== "yc_application")
    throw new Error("Invalid application evaluation category");
  return evaluateDiscourse(sample);
}
