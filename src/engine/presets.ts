/**
 * Domain presets. Layer on top of the default banned lists when the user
 * selects --preset cti or --preset marketing.
 */

export const CTI_VOCAB: string[] = [
  // Vendor-marketing dressed as intel
  "sophisticated",
  "advanced",
  "nation-state-grade",
  "next-generation",
  "next-gen",
  "world-class",
  "industry-leading",
  "best-in-class",
  "best-of-breed",
  // Attribution theater
  "definitively-attributed",
  "with-high-certainty"
];

export const CTI_PHRASES: string[] = [
  "in today's threat landscape",
  "ever-evolving threat landscape",
  "rapidly-evolving threat",
  "sophisticated threat actor",
  "advanced persistent threat actor",
  "highly sophisticated",
  "first of its kind",
  "this attack demonstrates",
  "this incident underscores",
  "we have observed with high confidence that",
  "this represents a paradigm shift"
];

export const MARKETING_VOCAB: string[] = [
  "supercharge",
  "elevate",
  "transform",
  "frictionless",
  "best-in-class",
  "industry-leading",
  "thought-leadership",
  "thought-leader",
  "rockstar",
  "ninja",
  "guru",
  "wizard"
];

export const MARKETING_PHRASES: string[] = [
  "take your business to the next level",
  "unlock your potential",
  "join us on this journey",
  "we're more than just a",
  "we believe in",
  "at company-name, we",
  "our mission is to",
  "we're on a mission to"
];
