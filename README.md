# Opptra Discount Engine

Live deployment: https://discount-engine-assignment-lime.vercel.app/  
Walkthrough video: https://drive.google.com/file/d/1uVZxN2sXpwGFjg8F5fY2N6tB0f6r1s0_/view?usp=sharing

## Run Locally

1. Install dependencies: `npm install`
2. Add `GEMINI_API_KEY=<your_key>` to `.env.local` (required for natural-language rule parsing)
3. Start the app: `npm run dev` (open `http://localhost:5173`)

Optional verification commands:
- `npm test` — runs the 5 unit and PDF integration tests
- `npm run build` — builds the production bundle into `dist/`

## What Was Built

All new input modes adapt to the existing `DiscountRule` and `CartItem` shapes while keeping item-level discount logic in `src/engine/discountEngine.js` pure and untouched:

- **Cart-level discount rules:** Supports `scope: "cart"` and `min_cart_value` in `rules.csv`, `csvParser.js`, and `discountEngine.js` (`evaluateCartOffer`, `evaluateCart`). Evaluated after all item-level discounts against the item subtotal and displayed as a separate `Cart offer` row only when triggered (hidden when below threshold).
- **Natural-language rule input:** Plain-English rule text is sent to `POST /api/parse-rule` (`api/parse-rule.js`), parsed via Gemini structured JSON (`gemini-3.5-flash-lite` with fast model fallback), validated client-side in `src/engine/nlRuleParser.js`, and shown in a confirmation step (`src/components/RuleInput.jsx`) to confirm or discard before adding.
- **PDF cart upload:** Extracts `(Product, Brand, Platform, Base Price)` from text-based cart PDFs using `pdfjs-dist` (`src/engine/pdfReader.js`, `src/engine/pdfTableParser.js`, `src/components/CartPdfUploader.jsx`), replaces the current cart, and recalculates when results are active.
- **UI & breakdown:** Displays `Rules That Match` on cart items (`pick max`, `stackable`, `only`, `No rules match`), `Status` badges in Cart Summary (`Max discount`, `Stacked`, `Discount applied`, `No offer`, `Cart offer`), and `Remove` actions on applied offers.

## Expected Results (Sample Data)

Uploading `sample-data/rules.csv` and `sample-data/cart.csv` (or `sample-data/cart.pdf`) and clicking **Calculate Discounts** produces:

| Item | Base Price | Rule(s) Applied | Final Price | Status |
|---|---|---|---|---|
| ITEM-01 | Rs.1,299 | Platform offer: 15% off (`RULE-01` beats `RULE-02`) | Rs.1,104 | Max discount |
| ITEM-02 | Rs.849 | Brand offer: Rs.150 off + Platform offer: 10% off | Rs.629 | Stacked |
| ITEM-03 | Rs.599 | Platform offer: 15% off | Rs.509 | Discount applied |
| ITEM-04 | Rs.2,499 | No offers available | Rs.2,499 | No offer |
| ITEM-05 | Rs.449 | Platform offer: 15% off | Rs.382 | Discount applied |
| ITEM-06 | Rs.899 | Platform offer: 10% off | Rs.809 | Discount applied |

- **Cart Total before offer:** `Rs.5,932`
- **Cart Offer (`RULE-04`):** `Rs.5,932 >= Rs.4,000 -> 10% off entire cart -> −Rs.593`
- **Final Cart Total:** `Rs.5,339`

## Key Decisions & Edge Cases

- **No separate backend or database:** CSV and PDF parsing run in the browser; `api/parse-rule.js` is a single Vercel serverless function whose only job is keeping `GEMINI_API_KEY` off the client (with a 300-character input cap). In-memory React state handles the session, and a new input mode can be added without modifying `discountEngine.js`.
- **Inclusive cart threshold (`>=`) & tie-breaking:** Cart rules trigger when `subtotal >= minCartValue` (matching `Cart total >= Rs.4,000`; phrases like *"more than Rs.5,000"* follow the same `>=` engine check). If multiple cart rules qualify, the largest rupee saving is applied.
- **All-or-nothing PDF validation & column splitting:** Column boundaries are inferred from header x-coordinates so multi-word names (`Natura Casa`, `Amazon India`) stay in one cell. Trailing page footers (`Page 1 of 1`) are ignored, while a missing table/column, non-numeric price, or scanned/image-only PDF rejects the import with row-level errors and keeps the existing cart intact rather than showing a partial cart total.
- **LLM validation & ambiguous input:** Responses are checked for `resolvable === true`, valid `scope` (`brand | platform | cart`), `type` (`percentage | flat`), numeric bounds (`0 < percentage <= 100`), and positive `minCartValue` for cart rules. Ambiguous inputs (e.g., *"Give a discount for big orders"*) surface a clear prompt asking the user to be more specific, and a non-blocking warning appears if a parsed brand or platform matches no items in the current cart.
- **Explicit calculate trigger:** Cart Summary remains hidden until **Calculate Discounts** is clicked; afterward, confirming an NL rule, removing an applied offer, or uploading a valid PDF cart recalculates automatically.

## Project Structure

```
api/
  parse-rule.js              ← Vercel serverless function (Gemini structured output)
sample-data/
  rules.csv                  ← sample rules including RULE-04 (cart offer)
  cart.csv                   ← sample cart items
  cart.pdf                   ← sample cart table PDF (Order #OP-9921)
src/
  engine/
    discountEngine.js        ← pure item + cart discount calculation
    csvParser.js             ← CSV → DiscountRule[] / CartItem[]
    nlRuleParser.js          ← /api/parse-rule client + schema validation
    pdfReader.js             ← pdfjs-dist text coordinate extraction
    pdfTableParser.js        ← coordinate table parser + all-or-nothing validation
  components/
    CsvUploader.jsx
    CartPdfUploader.jsx
    RuleInput.jsx
    DataTable.jsx
    ErrorBanner.jsx
  App.jsx
tests/
  discountEngine.test.js     ← unit + end-to-end PDF tests
```
