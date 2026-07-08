# Spec: Personality quiz (`personality-quiz`)

**Source story:** `../user-stories/08-personality-quiz.md`
**Depends on:** `browse-catalog`
**Status:** Draft — awaiting approval

## Problem

Customers who arrive from memes want a fun, low-friction way to discover a duck that feels like “them.” The catalog is already browsable, but there is still no light-weight recommendation experience that turns a few quick choices into a single duck suggestion.

This story adds a pure personality quiz that recommends a duck based on a short set of multiple-choice answers. The result is deterministic, easy to test, and safe to surface later in a web UI without introducing any persistent side effects.

## Users

- **Quincy Quacker (customer):** wants a quick, playful way to find a duck that matches their mood or personality.
- **Later stories / other code (indirect):** the web frontend (story 9) will render the quiz and link the recommendation to the duck detail page.

## Scope

### In scope

- A pure quiz engine over a fixed set of multiple-choice questions.
- A scoring model that maps answer choices to duck categories.
- Deterministic winner selection when multiple categories tie.
- A recommendation result containing the selected duck, a short personalized message, and a detail-page link.
- A library-level contract that can be rendered later by the web frontend without changing persistent state.

### Out of scope

- Saving quiz results to analytics, accounts, or persistence.
- Social sharing previews or leaderboards.
- Personalized discount codes or special offers.
- Any backend or HTTP-specific behavior.

## Functional requirements

### FR1 — Quiz structure

The quiz contains exactly 6 questions, each with 4 answer options.

The questions and their option-to-category scoring are fixed by the spec and are not user-editable.

1. **How do you like to spend your free time?**
   - A. Charting a course into the unknown → `pirate` +2
   - B. Keeping things simple and comfortable → `classic` +2
   - C. Celebrating with sparkles and surprises → `seasonal` +2
   - D. Improving a plan or building something → `professional` +2

2. **When a problem appears, you...**
   - A. Meet it with bold confidence → `pirate` +2
   - B. Take it in stride and stay practical → `classic` +2
   - C. Make it feel lighter with cheer → `seasonal` +2
   - D. Break it down and solve it expertly → `professional` +2

3. **Your ideal home is...**
   - A. A deck with room for adventure → `pirate` +2
   - B. A cozy and familiar nook → `classic` +2
   - C. A place that feels festive all year long → `seasonal` +2
   - D. A workshop full of tools and ideas → `professional` +2

4. **What do you value most?**
   - A. Freedom and a little mischief → `pirate` +2
   - B. Honesty and calm → `classic` +2
   - C. Wonder and celebration → `seasonal` +2
   - D. Mastery and excellence → `professional` +2

5. **How do you handle a surprise?**
   - A. Turn it into an adventure → `pirate` +1, `seasonal` +1
   - B. See it as a chance to stay steady → `classic` +2
   - C. Decorate it and party anyway → `seasonal` +2
   - D. Analyze it until it makes sense → `professional` +2

6. **What kind of companion do you want?**
   - A. Bold, loyal, and a little dramatic → `pirate` +2
   - B. Reliable and low-drama → `classic` +2
   - C. Playful and full of surprises → `seasonal` +2
   - D. Bright, capable, and impressive → `professional` +2

### FR2 — Scoring and winner selection

- The quiz starts each category at zero.
- Each selected answer contributes its specified weights to one or more categories.
- After all questions are answered, the category with the highest total score wins.
- If multiple categories are tied for the highest score, the winner is selected by a deterministic tie-break rule: categories are compared in the fixed order `pirate`, `classic`, `seasonal`, `professional`, and the first category in that order wins.
- The winning category maps to a duck recommendation by selecting the first duck in the catalog whose `category` matches that winning category.

### FR3 — Recommendation result

The quiz result is a pure value object with these fields:

- `duck`: the recommended duck
- `message`: a short personalized message for that duck
- `detailUrl`: a stable detail-page path such as `/ducks/${duck.id}`

The message should match the winning category in a friendly, non-robotic tone. Suggested category messages:

- `pirate`: `You have the bold, adventurous spirit of a pirate duck.`
- `classic`: `You have a steady, dependable vibe that suits a classic duck.`
- `seasonal`: `You bring a little wonder and celebration to every room.`
- `professional`: `You value craft, careful thought, and a polished approach.`

### FR4 — Purity and side effects

- The quiz logic is pure: it does not mutate its inputs, has no hidden state, and does not write to persistence.
- Taking the quiz never adds to the cart, changes stock, or records analytics in this workshop implementation.

## Non-functional requirements

- **NFR1 — Stack:** TypeScript, ES modules, Node 20+, `node:`-prefixed built-ins only; no new runtime dependencies.
- **NFR2 — Tests:** Vitest tests live next to source as `*.test.ts` and cover scoring, tie-breaking, selection, and the no-side-effects requirement.
- **NFR3 — Purity:** the quiz engine is deterministic and testable without a web server or persistence layer.

## Acceptance criteria

1. The quiz contains 6 fixed questions with 4 answer options each.
2. Each selected answer contributes the weights defined in FR1 to one or more categories.
3. The winning category is derived from the accumulated scores, and ties are broken deterministically by the fixed category order.
4. The recommended duck is the first catalog duck whose category matches the winning category.
5. The result includes the selected duck, a short personalized message, and a detail-page link.
6. The same answer set always returns the same duck and message.
7. Taking the quiz does not mutate any persistent state or cart data.
8. The full suite (`npm test`) passes.

## Open questions

- **Message tone:** should the personalized copy be more whimsical, more concise, or more explicitly tied to the duck's name? Default: friendly and short, with room for later UI polish.
- **Category source:** should the quiz map only to the existing catalog categories (`pirate`, `classic`, `seasonal`, `professional`), or should future stories introduce a fifth category? Default: keep it aligned with the current catalog categories.
