# Batch 1 — Stock safety, auto codes, weight, images, full Arabic

All edits done directly (no sub-agents). Selling prices, partner shares and sign-in settings are untouched.

## A. Stock safety
1. Orders form: each product in the picker shows "Available: N". Saving is blocked when quantity on a line (or the total across lines for the same product) is more than what's available, with a translated error.
2. New database action `create_order(order, lines)` saves the order, its items and the stock deduction in one step. It locks each product, refuses if stock is too low, and rolls everything back on any error. The Orders page calls only this (the current loop that ignores errors goes away).
3. Receiving stock keeps adding automatically; selling deducts through the step above. The manual +/- in Inventory becomes "Correction": the reason is required (dropdown: count correction, damaged, lost, returned, other + note), logged in movements. The database also refuses any change that would make stock negative.

## B. Automatic batch codes and serial numbers
- New counter table per product (next batch number, next serial number), never reset, so numbers are never reused.
- `receive_stock` generates the batch code `{SKU}-B01, B02…` and one serial per piece `{SKU}-0001…`, continuing from the counter. Serials get a global unique rule; a duplicate stops the whole receipt with an error (no silent skip).
- The batch code and serial inputs are removed from the Receive stock dialog. After saving, a message shows e.g. "Batch LEA-001-B03 · Serials LEA-001-0011 to LEA-001-0015".
- Serials tab shows thumbnail + product name + SKU beside each serial.
- The shipment "add to inventory" step uses the same generator so shipments also get codes and serials.

## C. Product weight
- Add "Weight (grams)" to the product add/edit form in Settings > Products, stored in grams, shown as kg in the products table and inventory. Name stays typed manually.

## D. Product images
- Create a public-read "product-images" storage area; only Owner/Operations can upload, replace or delete.
- Product form gets "Upload photo" (camera or gallery on phones), images only, compressed in the browser to max ~1600px JPEG, rejected over 5 MB before compression. The existing link field remains as a fallback. Photo appears wherever thumbnails already show.

## E. Arabic and RTL on every page
- Translate Suppliers and Partners pages fully, plus every toast, dialog, placeholder and table header on all listed pages and login.
- Add role_owner / role_operations / role_marketing keys; sidebar role label uses them.
- Fix typo "الإيرادادات" → "الإيرادات".
- Mobile menu opens from the right in Arabic.
- Replace text-left/text-right/space-x with start/end-safe classes in app pages.
- Add Shipments to the sidebar.

## Verification
Build log, then signed-in browser checks of dashboard, inventory, orders, shipments, suppliers, partners, finance, marketing, tasks, settings, login in English and Arabic, light and dark, plus a phone-size check. Real tests: oversell is refused; a receipt of 3 creates 3 serials and a batch code; a photo uploads. Final reply: done / not done per A–E.

## Technical details
- Migration: `product_code_counters(product_id pk, next_batch int default 1, next_serial int default 1)`, grants + RLS (ops); `products.weight_grams numeric default 0`; unique index on `serial_numbers(serial)`; CHECK-like trigger rejecting `stock_qty < 0`; `create_order(_order jsonb, _lines jsonb) returns uuid` SECURITY DEFINER with `is_ops()` check and `SELECT … FOR UPDATE`; `adjust_stock` requires non-empty reason; `receive_stock` keeps signature but ignores `_batch_code/_serials`, returns batch id; new `last_receipt` info returned via `receive_stock_v2` returning jsonb (batch_code, first_serial, last_serial). `receive_shipment` updated to call the shared generator.
- Bucket via storage tool; storage.objects policies: public select, insert/update/delete when `is_ops()`.
- Client compression with canvas (no new package).
- Existing `products.weight` in kg (if present) is not used by this batch's shipping logic; shipping rebuild is out of scope.
