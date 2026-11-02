<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Order stock, serials, fees and returns change only through DB RPCs (create_order/update_order/delete_order/set_order_status/record_return/write_off_stock); profit per line is read from the order_line_profit view so UI and month summaries share one formula.
- Month-end numbers come only from the month_statement() DB function (closed months read the month_closures snapshot; settlements are partner_transactions with settles_month), so the dashboard and Month-end page never compute differently.
- Capital repayment is recognized from month-closure snapshots, not mutable balance counters; close chronologically and reopen newest-first so later snapshots never double-repay capital.
- Live month statements recursively carry unpaid earlier live balances from the earliest activity month; closed statements remain immutable and settlements reduce carry exactly once.
- Category prefixes and counters are assigned atomically by the category trigger; retired codes remain reserved so product SKU numbers are never reused.
- Marketplace files are parsed in browser event handlers and reviewed before creation; imports use the Owner-only import_order wrapper around create_order with a transaction-scoped platform/reference lock, so duplicate uploads cannot deduct stock twice and fee/allocation rules remain shared.
