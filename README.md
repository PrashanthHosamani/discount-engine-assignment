# Opptra Discount Engine

Live deployment: https://discount-engine-assignment-lime.vercel.app/

## Run Locally

1. `npm install`
2. Add `GEMINI_API_KEY=<your_key>` to `.env.local` (only needed for natural-language rule parsing)
3. `npm run dev` (or `npm test` to run unit tests)

## What Changed

- **Cart-level rules (`src/engine/discountEngine.js`, `src/engine/csvParser.js`, `sample-data/rules.csv`):** Added `cart` scope and `min_cart_value`, evaluated after item-level discounts and shown as a separate cart offer row when triggered.
- **Natural-language rules (`api/parse-rule.js`, `src/engine/nlRuleParser.js`, `src/components/RuleInput.jsx`):** Parses plain-English rules into `DiscountRule` objects via Gemini structured output, validates fields before showing the confirm/discard step, and surfaces clear errors on ambiguous input.
- **PDF cart upload (`src/engine/pdfReader.js`, `src/engine/pdfTableParser.js`, `src/components/CartPdfUploader.jsx`):** Extracts `(Product, Brand, Platform, Base Price)` from text PDFs, replaces the cart, and clears/recalculates results.
- **UI (`src/App.jsx`, `src/components/DataTable.jsx`, `src/components/CsvUploader.jsx`):** Added `Rules That Match` on cart items, `Status` badges (`Max discount`, `Stacked`, `Discount applied`, `No offer`, `Cart offer`), and `Remove` buttons on applied offers.

## Key Decisions & Assumptions

- **Single serverless function instead of a second backend:** CSV and PDF parsing run in the browser; only `api/parse-rule.js` runs server-side on Vercel to keep `GEMINI_API_KEY` out of client code. All input parsers adapt to `discountEngine.js` without changing item-level math.
- **Inclusive cart threshold (`>=`) & tie-breaking:** Cart rules trigger at `subtotal >= minCartValue` (matching `Cart total >= Rs.4,000`; phrasing like *"more than Rs.5,000"* follows the same `>=` engine check). If multiple cart rules qualify, the largest rupee saving wins.
- **All-or-nothing PDF validation:** Column boundaries are inferred from header x-coordinates so multi-word names (`Natura Casa`, `Amazon India`) stay intact. If a PDF is scanned/empty or any row has missing columns or an invalid price, the upload is rejected with row details and the existing cart is kept intact rather than showing a partial total.
- **LLM validation:** Parsed rules are checked client-side (`scope`, `type`, `0 < percentage <= 100`, `minCartValue > 0`) before confirmation, with a non-blocking warning if a brand or platform matches nothing in the current cart.

## AI Tools Used

Used Antigravity and Claude during development; verified discount calculations and edge cases with `npm test` and manual testing.
