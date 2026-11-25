# Opptra Discount Engine

Live deployment: **Pending Vercel deploy** *(update with your `*.vercel.app` URL once deployed)*

## Run Locally

1. Install dependencies: `npm install`
2. *(Optional for Task 2)* Add `GEMINI_API_KEY=your_key` to `.env.local`
3. Start the app: `npm run dev` (or run `npm test` for unit tests)

Open `http://localhost:5173`, upload `sample-data/rules.csv` and `sample-data/cart.csv`, and click **Calculate Discounts**.

## What Changed

The core calculator in `src/engine/discountEngine.js` stays pure and untouched at the item level. All new input modes adapt into the existing `DiscountRule` and `CartItem` shapes:

| Area | Files | What it does |
|------|-------|--------------|
| Cart-level offers | `src/engine/discountEngine.js`, `src/engine/csvParser.js`, `sample-data/rules.csv`, `src/App.jsx` | Adds `cart` scope + `min_cart_value`, evaluates `RULE-04` after item discounts, and renders the cart offer row only when triggered. |
| Natural-language rules | `api/parse-rule.js`, `src/engine/nlRuleParser.js`, `src/components/RuleInput.jsx` | Parses plain-English rules via Gemini structured JSON (`POST /api/parse-rule`), validates fields client-side, shows a confirmation step, and updates results if already calculated. |
| PDF cart upload | `src/engine/pdfReader.js`, `src/engine/pdfTableParser.js`, `src/components/CartPdfUploader.jsx`, `sample-data/cart.pdf` | Reads text coordinates via `pdfjs-dist`, extracts `(Product, Brand, Platform, Base Price)`, validates all rows, replaces the cart, and recalculates if already calculated. |
| UI & offer controls | `src/App.jsx`, `src/components/DataTable.jsx`, `src/components/CsvUploader.jsx` | Shows `Rules That Match` on cart items, `Status` badges (`Max discount`, `Stacked`, `Discount applied`, `No offer`, `Cart offer`), and `Remove` actions on applied offers. |
| Tests | `tests/discountEngine.test.js` | Covers sample CSV math, inclusive threshold & below-threshold behavior, LLM validation/ambiguity, and real PDF parsing/failure cases. |

## Architecture & Tradeoffs (Plain Language)

- **Why one serverless function instead of a separate Python backend?** The assignment does not need a database or persistent server. Client-side CSV and PDF parsing run directly in the browser, and `api/parse-rule.js` is a single Vercel function whose only job is keeping `GEMINI_API_KEY` out of browser code.
- **Why inputs stay separate from the engine:** `csvParser.js`, `nlRuleParser.js`, and `pdfTableParser.js` all output plain `DiscountRule` or `CartItem` objects. A new input mode (e.g., JSON or webhook) can be added without modifying `discountEngine.js`.

## Deliberate Assumptions

1. **Cart threshold is inclusive (`>=`):** Matches the sample table (`Cart total >= Rs.4,000`). Note that natural-language phrases like *"more than Rs.5,000"* strictly imply `>`, whereas the engine applies `>=`; documented here as a 1-rupee boundary convention.
2. **Multiple qualifying cart rules:** Evaluated after item-level discounts; if multiple cart rules qualify, the rule yielding the largest rupee saving is applied so checkout shows one clear cart offer.
3. **All-or-nothing PDF validation:** If any row in an uploaded PDF has missing columns or a non-numeric price (or if the PDF is scanned/image-only with no text), the import is rejected with row-level errors and the existing cart is preserved. Silently skipping bad rows in a pricing checkout would produce a wrong total that looks valid.
4. **LLM validation & cart mismatch warning:** Gemini output is checked against `scope`, `type`, numeric bounds (`0 < pct <= 100`), and `minCartValue` before reaching the confirmation step. Ambiguous inputs (e.g., *"Give a discount for big orders"*) return a clear prompt to be more specific. If a parsed brand/platform matches no items in the current cart, a non-blocking warning is shown during confirmation.
5. **PDF column splitting by x-coordinates:** Header `x` positions (`Product`, `Brand`, `Platform`, `Base Price`) define column boundaries so multi-word names like `Natura Casa` and `Amazon India` do not break on spaces.
6. **Spec numbering note:** The assignment's *How We'll Evaluate This* section refers to NL rules and PDF upload as Tasks 1 and 2, while *What You Need to Build* labels Cart-level offer as Task 1. All three features are implemented.

## AI Tools Used

Used Antigravity and Claude for planning, architecture review, and scaffolding the new input adapters, unit tests, and UI wiring, then reviewed and verified all discount math and edge cases via `npm test` and `npm run build`.
