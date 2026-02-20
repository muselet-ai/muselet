import {
  contextByType,
  contextRecommended,
  DEFAULT_VALUE,
} from "./rules/context-by-type.js";

export const rules = {
  "context-by-type": contextByType,
  "context-recommended": contextRecommended,
};

export { DEFAULT_VALUE };
export type { RuleValue, SectionConfig } from "./rules/context-by-type.js";
