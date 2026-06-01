# Rule Catalog

The full set of rules shipped with Anti-Slop, with the reasoning behind each.

## Vocabulary

### vocab.banned

Default severity: warning

Flags any single word in the banned vocabulary list. Word-boundary aware (so "preview" is not flagged because "view" is not on the list). Many flagged words have a suggested replacement attached to the diagnostic for the quick-fix.

Some of the most-flagged offenders: delve, leverage, harness, vibrant, intricate, robust, agentic, paradigm, tapestry, realm.

Why: these words are statistically overrepresented in LLM output. Carnegie Mellon 2025 documented the lexical fingerprint; the list grew from there.

### phrases.banned

Default severity: warning

Multi-word phrases. "Let's dive in," "at the end of the day," "in conclusion," "I hope this helps."

Why: these are AI clichés. The sentence almost always reads stronger with the phrase deleted.

### openers.banned

Default severity: warning

Sentence-initial filler: Certainly, Absolutely, Sure, Moreover, Furthermore, Additionally, Notably, Interestingly, Indeed.

Why: humans don't open sentences this way. AI does. Cutting the opener and starting with the claim is almost always an upgrade.

## Punctuation

### punctuation.emDash

Default severity: warning. Budget: 1 per 500 words.

Why: this is the single most cited AI tell. Em dashes are legitimate punctuation, but the way LLMs deploy them has poisoned the well. A budget lets you use one where it earns the read, and catches the surplus.

### punctuation.exclamation

Default severity: info. Budget: 1 per 1,000 words.

Why: enthusiasm should come from word choice, not punctuation.

### punctuation.ellipsis

Default severity: info. Budget: 1 per piece.

Why: ellipses are for trailing off. AI uses them as transitions, which reads as performative hesitation.

## Structure

### structure.parataxis

Default severity: info. Threshold: 3 consecutive sentences of 6 words or fewer.

Why: parataxis is the default AI rhythm. Short sentence. Then another. Then another. Reads like a poem and immediately signals AI authorship. Fix by connecting related thoughts with subordinate clauses, conjunctions, or semicolons.

### structure.uniformLength

Default severity: info. Threshold: 3 consecutive sentences with word counts within 1 of each other, each sentence at least 5 words.

Why: metronome rhythm. AI text has no texture. Real prose has texture: a 4-word sentence, then a 30-word one, then a fragment.

### structure.ruleOfThree

Default severity: info. Threshold: 1 rule-of-three list per document.

Why: AI defaults to listing three things to sound comprehensive. "Speed, efficiency, and innovation." Use two. Or four. Or the single thing that matters.

## Pattern

### pattern.negativeParallelism

Default severity: warning.

Catches every form of "not X, but Y" reframe construction: "this isn't X, this is Y," "less X, more Y," "not just X, but Y," "the question isn't X, the question is Y," "you don't need X, you need Y," "stop thinking X, start thinking Y."

Why: this is THE AI tell. Peer-reviewed work backs this up. Every model does it dozens of times per response. The fix is the same every time: delete the negated framing, state the positive claim directly.

### pattern.todayOpener

Default severity: warning.

Catches "In today's [anything]," "In the world of [anything]," "In the modern [anything]," "In the era of [anything]."

Why: marketing-essay opener. Skip the framing.

### pattern.metaCommentary

Default severity: warning.

Catches "In this article, we will...," "Let me walk you through...," "Here's a comprehensive overview..."

Why: say the thing. Don't announce the thing.

### pattern.cutoffDisclaimer

Default severity: warning.

Catches "As of my last update," "Based on my training," "While specific details are limited," "I don't have access to real-time data."

Why: dead giveaway. Cut every one.

### pattern.engagementBait

Default severity: warning.

Catches "Let that sink in," "Read that again," "This changes everything," "What nobody tells you."

Why: reader-poking copy. The content should make people want to keep reading on its own.

### pattern.copulativeAvoidance

Default severity: info.

Catches "serves as a," "stands as a," "represents a," "boasts a," "features a," "holds the distinction of being."

Why: AI replaces "is" and "has" with bloated alternatives. Just say "is."

### pattern.falseRange

Default severity: info.

Catches "from X to Y" where X and Y are short noun phrases.

Why: if there's no meaningful middle ground between X and Y, the range is fake. AI uses these to sound comprehensive while saying nothing.

## How to silence a rule

Three options, in order of preference.

1. Allow the specific word in `.antislop.yml` under `allowedVocab`. Best when the word is a term of art.
2. Add an inline disable comment for the rule ID on a specific line. Best when one occurrence is the right call.
3. Set the rule's `enabled: false` in `.antislop.yml`. Best when the rule does not apply to your context (for example, structure.ruleOfThree in a doc that genuinely has many three-item lists).
