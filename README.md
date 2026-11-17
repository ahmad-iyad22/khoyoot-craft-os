# Khoyoot

Build "Khoyoot" — a Business Operating System (internal web app) for a small Palestinian heritage products business run by 3 partners.

STACK: Full-stack TypeScript, Tailwind + shadcn/ui, with a real database and authentication (use the default Lovable stack with Supabase backend).

CORE REQUIREMENT: This is Phase 1 only — build the real data foundation and core screens. No AI features yet.

## Authentication & Roles
- Simple login (email/password) for exactly 3 users.
- Role-based access control with 3 roles:
  - **Owner/Finance role**: full access to everything, including financial records, partner capital/withdrawals, and settings.
  - **Inventory/Operations role**: full access to Inventory, Orders, Suppliers, Tasks. Read-only view of Dashboard summary. No access to partner capital/withdrawal details.
  - **Marketing role**: full access to Marketing, Content Calendar, Campaigns. Read-only view of sales performance (which products/platforms sell well) but no access to detailed financial records, costs, or partner capital.
- Enforce these permissions on both the UI (hide/disable) and at the data layer (row-level security policies), not just hidden buttons.

## Pages / Modules to build

1. **Dashboard** (home page after login)
   - Key metrics cards: Revenue, Total Expenses, Net Profit, Number of Orders, Total Stock Value, Ad Spend — for current month, with comparison to previous month.
   - Simple charts: revenue trend over last 6 months, profit by product (top 5).
   - Recent orders list (last 10).
   - Low stock alert banner if any product is below its reorder threshold.

2. **Inventory**
   - Product list: SKU, name, category, cost price, sale price, current stock quantity, reorder threshold.
   - Support serial numbers / batch tracking per product (optional field, list of serials linked to a product batch).
   - "Receive stock" form: add quantity received, unit cost, shipping cost for that batch — auto-calculate landed cost per unit (unit cost + allocated shipping) and update stock + weighted average cost.
   - Stock movement history log (every addition/removal with date, reason, user).

3. **Finance**
   - Income entries (linked to orders where possible) and manual expense entries (categorized: shipping, platform fees, ads, supplies, other).
   - Monthly Profit & Loss view: Revenue - Product Cost - Shipping - Platform Fees - Ads - Other Expenses = Net Profit.
   - Filterable by date range and category.

4. **Orders**
   - Order list: date, platform (Shopee/Lazada/TikTok Shop/Manual), product(s), quantity, sale price, status (pending/shipped/completed/cancelled).
   - Manual order entry form (since marketplace API integration comes later in Phase 5).
   - Order detail view showing linked product cost vs sale price (margin per order).

5. **Partners**
   - List of 3 partners with their capital contribution history and withdrawal history.
   - Running balance per partner (contributions - withdrawals + share of profit if applicable).
   - Only visible in full to the Owner/Finance role; other roles cannot see this page at all.

6. **Suppliers**
   - Basic supplier list: name, contact info, products supplied, lead time notes.

7. **Marketing** (basic for Phase 1, expand later)
   - Content calendar: simple list/calendar of planned posts (platform, date, product, status: idea/scripted/posted).
   - Campaign list: name, platform, budget, date range, linked product — no analytics yet, just tracking.

8. **Tasks**
   - Simple task list assignable to the 3 users, with due dates and status (todo/in progress/done), filterable by assignee.

9. **Settings**
   - Manage product catalog (add/edit/archive products), categories, and platform fee percentages used in profit calculations.
   - User management (view the 3 users and their roles — role changes restricted to Owner).

## Design
- Clean, professional dashboard aesthetic — not generic. Use a warm, earthy color palette that fits a heritage/craft brand (terracotta, olive green, cream, deep navy accents) rather than default blue SaaS colors.
- Arabic-friendly: support right-to-left (RTL) text rendering for Arabic labels/content, but the UI structure itself can default to English labels for now with Arabic content fields (product names, notes) supported.
- Mobile-responsive since partners may check the dashboard from their phones.

## Explicitly out of scope for this build (future phases)
- AI Manager / natural language queries — Phase 2.
- Marketplace API integrations (Shopee/Lazada/TikTok Shop live sync) — Phase 5, orders are manual entry for now.
- Canva/content generation — later phase.

Build the database schema first (products, inventory_batches, stock_movements, orders, order_items, expenses, income, partners, partner_transactions, suppliers, tasks, campaigns, content_calendar, users/roles), then the UI screens on top of it with working CRUD operations and the role-based permissions enforced.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://khoyoot-craft-os.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/790893f9-66cc-4e56-a4b3-ba8537b572f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
