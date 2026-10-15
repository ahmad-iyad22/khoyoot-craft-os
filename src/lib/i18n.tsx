import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EXTRA_DICT } from "./i18n-extra";
import { supabase } from "@/integrations/supabase/client";

export type Lang = "en" | "ar";

type Dict = Record<string, { en: string; ar: string }>;

export const DICT: Dict = {
  // brand / shell
  appName: { en: "Khoyoot", ar: "خيوط" },
  tagline: { en: "Business OS", ar: "نظام إدارة الأعمال" },
  navigation: { en: "Navigation", ar: "التنقل" },
  signOut: { en: "Sign out", ar: "تسجيل الخروج" },
  language: { en: "Language", ar: "اللغة" },
  english: { en: "English", ar: "الإنجليزية" },
  arabic: { en: "Arabic", ar: "العربية" },
  theme: { en: "Theme", ar: "المظهر" },
  light: { en: "Light", ar: "فاتح" },
  dark: { en: "Dark", ar: "داكن" },

  // nav
  dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  inventory: { en: "Inventory", ar: "المخزون" },
  shipments: { en: "Shipping", ar: "الشحنات" },
  orders: { en: "Orders", ar: "الطلبات" },
  finance: { en: "Finance", ar: "المالية" },
  partners: { en: "Partners", ar: "الشركاء" },
  suppliers: { en: "Suppliers", ar: "الموردون" },
  marketing: { en: "Marketing", ar: "التسويق" },
  analytics: { en: "Platform Analytics", ar: "تحليلات المنصات" },
  aiManager: { en: "AI Manager", ar: "المدير الذكي" },
  tasks: { en: "Tasks", ar: "المهام" },
  settings: { en: "Settings", ar: "الإعدادات" },

  // generic
  add: { en: "Add", ar: "إضافة" },
  save: { en: "Save", ar: "حفظ" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  edit: { en: "Edit", ar: "تعديل" },
  delete: { en: "Delete", ar: "حذف" },
  search: { en: "Search", ar: "بحث" },
  status: { en: "Status", ar: "الحالة" },
  date: { en: "Date", ar: "التاريخ" },
  product: { en: "Product", ar: "المنتج" },
  products: { en: "Products", ar: "المنتجات" },
  quantity: { en: "Quantity", ar: "الكمية" },
  notes: { en: "Notes", ar: "ملاحظات" },
  total: { en: "Total", ar: "الإجمالي" },
  platform: { en: "Platform", ar: "المنصة" },
  revenue: { en: "Revenue", ar: "الإيرادات" },
  comparedLastMonth: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
  profit: { en: "Profit", ar: "الربح" },
  none: { en: "Nothing here yet", ar: "لا يوجد شيء بعد" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  actions: { en: "Actions", ar: "إجراءات" },
  name: { en: "Name", ar: "الاسم" },
  price: { en: "Price", ar: "السعر" },
  cost: { en: "Cost", ar: "التكلفة" },
  stock: { en: "Stock", ar: "المخزون" },
  category: { en: "Category", ar: "الفئة" },
  supplier: { en: "Supplier", ar: "المورد" },
  description: { en: "Description", ar: "الوصف" },
  view: { en: "View", ar: "عرض" },
  weight: { en: "Weight", ar: "الوزن" },
  reference: { en: "Reference", ar: "المرجع" },
  margin: { en: "Margin", ar: "هامش الربح" },
  targetMargin: { en: "Target margin", ar: "هامش الربح المستهدف" },
  alertThreshold: { en: "Alert threshold", ar: "حد التنبيه" },
  sellingPrice: { en: "Selling price", ar: "سعر البيع" },
  avgCost: { en: "Weighted average cost", ar: "متوسط التكلفة المرجح" },

  // dashboard
  totalExpenses: { en: "Total expenses", ar: "إجمالي المصاريف" },
  netProfit: { en: "Net profit", ar: "صافي الربح" },
  stockValue: { en: "Stock value", ar: "قيمة المخزون" },
  adSpend: { en: "Ad spend", ar: "الإنفاق الإعلاني" },
  shipmentsInTransit: { en: "Shipments in transit", ar: "شحنات قيد النقل" },
  marginAlerts: { en: "Margin alerts", ar: "تنبيهات هامش الربح" },
  recentOrders: { en: "Recent orders", ar: "أحدث الطلبات" },

  // shipments
  shippingTitle: { en: "Shipping management", ar: "إدارة الشحن" },
  shippingSubtitle: {
    en: "Palestine → Malaysia shipments, weight-based cost allocation and landed cost.",
    ar: "الشحنات من فلسطين إلى ماليزيا، توزيع التكلفة حسب الوزن وتكلفة الوصول.",
  },
  newShipment: { en: "New shipment", ar: "شحنة جديدة" },
  totalShippingCost: { en: "Total shipping cost paid", ar: "إجمالي تكلفة الشحن المدفوعة" },
  paidWeight: { en: "Weight paid for (kg)", ar: "الوزن المدفوع (كجم)" },
  lineItems: { en: "Line items", ar: "بنود الشحنة" },
  unitProductCost: { en: "Product cost per unit", ar: "تكلفة المنتج للوحدة" },
  lineWeight: { en: "Total weight for this product (kg)", ar: "الوزن الكلي لهذا المنتج (كجم)" },
  costPerKg: { en: "Cost per kg", ar: "التكلفة لكل كجم" },
  allocatedShipping: { en: "Allocated shipping / unit", ar: "الشحن الموزع للوحدة" },
  landedCost: { en: "Landed cost / unit", ar: "تكلفة الوصول للوحدة" },
  advanceStage: { en: "Advance stage", ar: "المرحلة التالية" },
  addToInventory: { en: "Add to inventory", ar: "إضافة إلى المخزون" },

  // product detail
  productDetail: { en: "Product detail", ar: "تفاصيل المنتج" },
  howMade: { en: "How it is made", ar: "طريقة الصنع" },
  materials: { en: "Materials", ar: "المواد" },
  photos: { en: "Photos", ar: "الصور" },
  documents: { en: "Documents", ar: "المستندات" },
  minStock: { en: "Minimum stock", ar: "الحد الأدنى للمخزون" },
  reorderThreshold: { en: "Reorder threshold", ar: "حد إعادة الطلب" },
  recommendedReorder: { en: "Recommended reorder qty", ar: "الكمية الموصى بطلبها" },
  salesHistory: { en: "Sales history", ar: "سجل المبيعات" },
  marketingHistory: { en: "Marketing history", ar: "سجل التسويق" },
  marginOverTime: { en: "Margin over time", ar: "هامش الربح عبر الزمن" },
  marketingCost: { en: "Marketing cost", ar: "تكلفة التسويق" },
  platformFees: { en: "Platform fees", ar: "رسوم المنصة" },
  launchDate: { en: "Expected launch date", ar: "تاريخ الإطلاق المتوقع" },

  // analytics
  analyticsSubtitle: {
    en: "Manual snapshots per platform — views, orders, revenue and ad spend.",
    ar: "لقطات يدوية لكل منصة — المشاهدات والطلبات والإيرادات والإنفاق الإعلاني.",
  },
  views: { en: "Views", ar: "المشاهدات" },
  productViews: { en: "Product views", ar: "مشاهدات المنتج" },
  conversion: { en: "Conversion rate", ar: "معدل التحويل" },
  bestDay: { en: "Best day of week", ar: "أفضل يوم في الأسبوع" },

  // ai
  aiSubtitle: {
    en: "Ask about margins, pricing, shipments and reorders. Advice only — nothing is changed automatically.",
    ar: "اسأل عن الهوامش والتسعير والشحنات وإعادة الطلب. نصائح فقط — لا يتم تغيير أي بيانات تلقائيًا.",
  },
  askPlaceholder: { en: "Ask the AI manager…", ar: "اسأل المدير الذكي…" },
  send: { en: "Send", ar: "إرسال" },

  // settings
  skuPrefixes: { en: "Code prefixes", ar: "بادئات الأكواد" },
  prefixCode: { en: "Prefix", ar: "البادئة" },
  nextCode: { en: "Next code will be", ar: "الكود التالي سيكون" },
  categories: { en: "Categories", ar: "الفئات" },
  expenseCategories: { en: "Expense categories", ar: "فئات المصاريف" },
  platformFeesTab: { en: "Platform fees", ar: "رسوم المنصات" },
  team: { en: "Team", ar: "الفريق" },
  role: { en: "Role", ar: "الدور" },
  defaultTargetMargin: { en: "Default target margin", ar: "هامش الربح الافتراضي" },

  // shipping additions
  customsCost: { en: "Customs / tax cost", ar: "تكلفة الجمارك" },
  supplierPrice: { en: "Supplier price / unit", ar: "سعر المورد للوحدة" },
  allocatedCustoms: { en: "Allocated customs / unit", ar: "الجمارك الموزعة للوحدة" },
  amountOwed: { en: "Amount owed to supplier", ar: "المبلغ المستحق للمورد" },
  owedBalance: { en: "Owed balance", ar: "الرصيد المستحق" },
  payments: { en: "Payments", ar: "الدفعات" },
  recordPayment: { en: "Record payment", ar: "تسجيل دفعة" },
  agreedPrices: { en: "Agreed prices", ar: "الأسعار المتفق عليها" },
  deleteConfirm: { en: "Delete this record?", ar: "حذف هذا السجل؟" },

  // partners / expenses
  profitShare: { en: "Profit share %", ar: "نسبة الأرباح %" },
  expenseShare: { en: "Expense share %", ar: "نسبة المصاريف %" },
  addPartner: { en: "Add partner", ar: "إضافة شريك" },
  rebalance: { en: "Percentages must total 100%", ar: "يجب أن يكون مجموع النسب 100%" },
  capital: { en: "Capital contributions", ar: "المساهمات الرأسمالية" },
  withdrawals: { en: "Withdrawals", ar: "السحوبات" },
  balance: { en: "Balance", ar: "الرصيد" },
  ledger: { en: "Ledger", ar: "دفتر الحسابات" },
  sharedExpenses: { en: "Shared expenses", ar: "المصاريف المشتركة" },
  paidBy: { en: "Paid by", ar: "دفعها" },
  splitEqually: { en: "Split equally", ar: "تقسيم بالتساوي" },
  customSplit: { en: "Custom split", ar: "تقسيم مخصص" },
  owesPayer: { en: "Owes the payer", ar: "مستحق للدافع" },
  profitDistribution: { en: "Profit distribution", ar: "توزيع الأرباح" },

  // analytics / content
  addSnapshot: { en: "Add snapshot", ar: "إضافة لقطة" },
  engagement: { en: "Engagement", ar: "التفاعل" },
  attributedOrders: { en: "Attributed orders", ar: "الطلبات المنسوبة" },
  attributedRevenue: { en: "Attributed revenue", ar: "الإيرادات المنسوبة" },
  postPerformance: { en: "Post performance", ar: "أداء المنشور" },

  // page headers
  dashboardSubtitle: { en: "compared with last month", ar: "مقارنة بالشهر الماضي" },
  inventorySubtitle: {
    en: "Stock levels, landed costs, batches and serial numbers.",
    ar: "مستويات المخزون وتكاليف الوصول والدفعات والأرقام التسلسلية.",
  },
  receiveStock: { en: "Receive stock", ar: "استلام مخزون" },
  ordersSubtitle: {
    en: "Manual entry for now — marketplace sync arrives in a later phase.",
    ar: "إدخال يدوي حاليًا — مزامنة المنصات في مرحلة لاحقة.",
  },
  newOrder: { en: "New order", ar: "طلب جديد" },
  salesPerformance: { en: "Sales performance", ar: "أداء المبيعات" },
  unitsSold: { en: "Units sold", ar: "الوحدات المباعة" },
  searchProducts: { en: "Search by name or SKU…", ar: "ابحث بالاسم أو رمز المنتج…" },

  // settings / account
  settingsSubtitle: { en: "Catalog, categories, platform fees and team roles.", ar: "الكتالوج والفئات ورسوم المنصات وأدوار الفريق." },
  account: { en: "My account", ar: "حسابي" },
  changePassword: { en: "Change password", ar: "تغيير كلمة المرور" },
  newPassword: { en: "New password", ar: "كلمة المرور الجديدة" },
  confirmPassword: { en: "Confirm password", ar: "تأكيد كلمة المرور" },
  passwordTooShort: { en: "Password must be at least 8 characters", ar: "يجب أن تكون كلمة المرور 8 أحرف على الأقل" },
  passwordMismatch: { en: "Passwords do not match", ar: "كلمتا المرور غير متطابقتين" },
  passwordUpdated: { en: "Password updated", ar: "تم تحديث كلمة المرور" },
  addProduct: { en: "Add product", ar: "إضافة منتج" },
  editProduct: { en: "Edit product", ar: "تعديل المنتج" },
  sku: { en: "SKU", ar: "رمز المنتج" },
  restore: { en: "Restore", ar: "استعادة" },
  archive: { en: "Archive", ar: "أرشفة" },
  deleted: { en: "Deleted", ar: "تم الحذف" },
  deleteProductConfirm: {
    en: "Permanently delete \"{name}\"? Its batches, stock history and shipment lines are removed too. This cannot be undone.",
    ar: "حذف \"{name}\" نهائيًا؟ ستُحذف دفعاته وسجل مخزونه وبنود شحناته أيضًا. لا يمكن التراجع.",
  },
  catalogRestricted: { en: "The product catalog is managed by Owner and Operations roles.", ar: "يدير الكتالوج المالك وفريق العمليات." },
  arabicName: { en: "Arabic name", ar: "الاسم بالعربية" },
  feePercent: { en: "Fee %", ar: "نسبة الرسوم %" },
  user: { en: "User", ar: "المستخدم" },
  pickCategory: { en: "Pick a category to generate the SKU", ar: "اختر فئة لإنشاء رمز المنتج" },
  photoUrl: { en: "Photo URL", ar: "رابط الصورة" },
  photo: { en: "Photo", ar: "الصورة" },
  // common table / page labels
  orderNumber: { en: "Order #", ar: "رقم الطلب" },
  customer: { en: "Customer", ar: "العميل" },
  items: { en: "Items", ar: "العناصر" },
  shipping: { en: "Shipping", ar: "الشحن" },
  platformFee: { en: "Platform fee", ar: "رسوم المنصة" },
  income: { en: "Income", ar: "الدخل" },
  expenses: { en: "Expenses", ar: "المصاريف" },
  amount: { en: "Amount", ar: "المبلغ" },
  source: { en: "Source", ar: "المصدر" },
  from: { en: "From", ar: "من" },
  to: { en: "To", ar: "إلى" },
  allCategories: { en: "All categories", ar: "كل الفئات" },
  monthlyPL: { en: "Monthly profit & loss", ar: "الأرباح والخسائر الشهرية" },
  financeSubtitle: { en: "Income, expenses and monthly profit & loss.", ar: "الدخل والمصاريف والأرباح والخسائر الشهرية." },
  addIncome: { en: "Add income", ar: "إضافة دخل" },
  addExpense: { en: "Add expense", ar: "إضافة مصروف" },
  month: { en: "Month", ar: "الشهر" },
  type: { en: "Type", ar: "النوع" },
  lowStock: { en: "Low stock", ar: "مخزون منخفض" },
  revenueTrend: { en: "Revenue trend (6 months)", ar: "اتجاه الإيرادات (6 أشهر)" },
  topProducts: { en: "Top products by profit", ar: "أعلى المنتجات ربحًا" },
  batches: { en: "Batches", ar: "الدفعات" },
  movements: { en: "Stock movements", ar: "حركات المخزون" },
  serials: { en: "Serial numbers", ar: "الأرقام التسلسلية" },
  reason: { en: "Reason", ar: "السبب" },
  unitCost: { en: "Unit cost", ar: "تكلفة الوحدة" },
  received: { en: "Received", ar: "تاريخ الاستلام" },
  supplierLabel: { en: "Supplier", ar: "المورد" },
  noAccess: { en: "You don't have access to this section.", ar: "ليست لديك صلاحية لهذا القسم." },
  exportCsv: { en: "Export Excel (CSV)", ar: "تصدير Excel (CSV)" },
  "Account created. Check your email to confirm, then sign in.": { en: "Account created. Check your email to confirm, then sign in.", ar: "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062d\u0633\u0627\u0628. \u062a\u062d\u0642\u0642 \u0645\u0646 \u0628\u0631\u064a\u062f\u0643 \u062b\u0645 \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644." },
  "Ad spend": { en: "Ad spend", ar: "\u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064a" },
  "Add at least one product": { en: "Add at least one product", ar: "\u0623\u0636\u0641 \u0645\u0646\u062a\u062c\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" },
  "Add expense": { en: "Add expense", ar: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0635\u0631\u0648\u0641" },
  "Add income": { en: "Add income", ar: "\u0625\u0636\u0627\u0641\u0629 \u062f\u062e\u0644" },
  "Add line": { en: "Add line", ar: "\u0625\u0636\u0627\u0641\u0629 \u0628\u0646\u062f" },
  "Added": { en: "Added", ar: "\u062a\u0645\u062a \u0627\u0644\u0625\u0636\u0627\u0641\u0629" },
  "Adjust": { en: "Adjust", ar: "\u062a\u0639\u062f\u064a\u0644" },
  "All categories": { en: "All categories", ar: "\u0643\u0644 \u0627\u0644\u0641\u0626\u0627\u062a" },
  "All orders": { en: "All orders", ar: "\u0643\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a" },
  "Amount": { en: "Amount", ar: "\u0627\u0644\u0645\u0628\u0644\u063a" },
  "At weighted average cost": { en: "At weighted average cost", ar: "\u0628\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0631\u062c\u062d" },
  "Avg cost": { en: "Avg cost", ar: "\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062a\u0643\u0644\u0641\u0629" },
  "Batch": { en: "Batch", ar: "\u0627\u0644\u062f\u0641\u0639\u0629" },
  "Batch code (optional)": { en: "Batch code (optional)", ar: "\u0631\u0645\u0632 \u0627\u0644\u062f\u0641\u0639\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)" },
  "Batches": { en: "Batches", ar: "\u0627\u0644\u062f\u0641\u0639\u0627\u062a" },
  "By": { en: "By", ar: "\u0628\u0648\u0627\u0633\u0637\u0629" },
  "Category": { en: "Category", ar: "\u0627\u0644\u0641\u0626\u0629" },
  "Category added": { en: "Category added", ar: "\u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0641\u0626\u0629" },
  "Category deleted": { en: "Category deleted", ar: "\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0641\u0626\u0629" },
  "Category updated": { en: "Category updated", ar: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0641\u0626\u0629" },
  "Change": { en: "Change", ar: "\u0627\u0644\u062a\u063a\u064a\u064a\u0631" },
  "Choose product": { en: "Choose product", ar: "\u0627\u062e\u062a\u0631 \u0645\u0646\u062a\u062c\u064b\u0627" },
  "Cost": { en: "Cost", ar: "\u0627\u0644\u062a\u0643\u0644\u0641\u0629" },
  "Create account": { en: "Create account", ar: "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628" },
  "Customer": { en: "Customer", ar: "\u0627\u0644\u0639\u0645\u064a\u0644" },
  "Date": { en: "Date", ar: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e" },
  "Description": { en: "Description", ar: "\u0627\u0644\u0648\u0635\u0641" },
  "Email": { en: "Email", ar: "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a" },
  "Expense category": { en: "Expense category", ar: "\u0641\u0626\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641" },
  "Expense recorded": { en: "Expense recorded", ar: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641" },
  "Expenses": { en: "Expenses", ar: "\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641" },
  "Fee updated": { en: "Fee updated", ar: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0631\u0633\u0648\u0645" },
  "Finance": { en: "Finance", ar: "\u0627\u0644\u0645\u0627\u0644\u064a\u0629" },
  "Financial records are limited to the Owner / Finance role.": { en: "Financial records are limited to the Owner / Finance role.", ar: "\u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u0645\u0627\u0644\u0643 \u0641\u0642\u0637." },
  "From": { en: "From", ar: "\u0645\u0646" },
  "Full name": { en: "Full name", ar: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644" },
  "Income": { en: "Income", ar: "\u0627\u0644\u062f\u062e\u0644" },
  "Income recorded": { en: "Income recorded", ar: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0644" },
  "Income, expenses and profit & loss.": { en: "Income, expenses and profit & loss.", ar: "\u0627\u0644\u062f\u062e\u0644 \u0648\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641 \u0648\u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0626\u0631." },
  "Inventory is available to the Owner and the Operations partner.": { en: "Inventory is available to the Owner and the Operations partner.", ar: "\u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0645\u062a\u0627\u062d \u0644\u0644\u0645\u0627\u0644\u0643 \u0648\u0634\u0631\u064a\u0643 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a." },
  "Items": { en: "Items", ar: "\u0627\u0644\u0639\u0646\u0627\u0635\u0631" },
  "Landed / unit": { en: "Landed / unit", ar: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 / \u0648\u062d\u062f\u0629" },
  "Margin": { en: "Margin", ar: "\u0647\u0627\u0645\u0634 \u0627\u0644\u0631\u0628\u062d" },
  "Movements": { en: "Movements", ar: "\u0627\u0644\u062d\u0631\u0643\u0627\u062a" },
  "Navigation": { en: "Navigation", ar: "\u0627\u0644\u062a\u0646\u0642\u0644" },
  "Net margin": { en: "Net margin", ar: "\u0635\u0627\u0641\u064a \u0627\u0644\u0647\u0627\u0645\u0634" },
  "Net profit": { en: "Net profit", ar: "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d" },
  "New order": { en: "New order", ar: "\u0637\u0644\u0628 \u062c\u062f\u064a\u062f" },
  "No batches received yet.": { en: "No batches received yet.", ar: "\u0644\u0645 \u062a\u064f\u0633\u062a\u0644\u0645 \u062f\u0641\u0639\u0627\u062a \u0628\u0639\u062f." },
  "No expenses in this range.": { en: "No expenses in this range.", ar: "\u0644\u0627 \u0645\u0635\u0627\u0631\u064a\u0641 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629." },
  "No income entries in this range.": { en: "No income entries in this range.", ar: "\u0644\u0627 \u062f\u062e\u0644 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629." },
  "No orders yet \u2014 add one from the Orders page.": { en: "No orders yet \u2014 add one from the Orders page.", ar: "\u0644\u0627 \u0637\u0644\u0628\u0627\u062a \u0628\u0639\u062f \u2014 \u0623\u0636\u0641 \u0637\u0644\u0628\u064b\u0627 \u0645\u0646 \u0635\u0641\u062d\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062a." },
  "No orders yet.": { en: "No orders yet.", ar: "\u0644\u0627 \u0637\u0644\u0628\u0627\u062a \u0628\u0639\u062f." },
  "No role": { en: "No role", ar: "\u0628\u062f\u0648\u0646 \u062f\u0648\u0631" },
  "No sales recorded yet.": { en: "No sales recorded yet.", ar: "\u0644\u0627 \u0645\u0628\u064a\u0639\u0627\u062a \u0645\u0633\u062c\u0644\u0629 \u0628\u0639\u062f." },
  "No serial numbers recorded.": { en: "No serial numbers recorded.", ar: "\u0644\u0627 \u0623\u0631\u0642\u0627\u0645 \u062a\u0633\u0644\u0633\u0644\u064a\u0629." },
  "No stock movements yet.": { en: "No stock movements yet.", ar: "\u0644\u0627 \u062d\u0631\u0643\u0627\u062a \u0645\u062e\u0632\u0648\u0646 \u0628\u0639\u062f." },
  "Not available for your role": { en: "Not available for your role", ar: "\u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0644\u062f\u0648\u0631\u0643" },
  "Notes": { en: "Notes", ar: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a" },
  "Open inventory": { en: "Open inventory", ar: "\u0641\u062a\u062d \u0627\u0644\u0645\u062e\u0632\u0648\u0646" },
  "Optional": { en: "Optional", ar: "\u0627\u062e\u062a\u064a\u0627\u0631\u064a" },
  "Order detail": { en: "Order detail", ar: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0637\u0644\u0628" },
  "Order ref": { en: "Order ref", ar: "\u0645\u0631\u062c\u0639 \u0627\u0644\u0637\u0644\u0628" },
  "Order saved": { en: "Order saved", ar: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0637\u0644\u0628" },
  "Order total": { en: "Order total", ar: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628" },
  "Orders": { en: "Orders", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a" },
  "Orders are available to the Owner and the Operations partner.": { en: "Orders are available to the Owner and the Operations partner.", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u0645\u0627\u0644\u0643 \u0648\u0634\u0631\u064a\u0643 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a." },
  "Password": { en: "Password", ar: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" },
  "Phase 1 \u00b7 Internal use only": { en: "Phase 1 \u00b7 Internal use only", ar: "\u0627\u0644\u0645\u0631\u062d\u0644\u0629 1 \u00b7 \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a" },
  "Platform": { en: "Platform", ar: "\u0627\u0644\u0645\u0646\u0635\u0629" },
  "Platform fee": { en: "Platform fee", ar: "\u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0646\u0635\u0629" },
  "Product": { en: "Product", ar: "\u0627\u0644\u0645\u0646\u062a\u062c" },
  "Product cost": { en: "Product cost", ar: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0646\u062a\u062c" },
  "Product saved": { en: "Product saved", ar: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0645\u0646\u062a\u062c" },
  "Products": { en: "Products", ar: "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a" },
  "Profit &amp; Loss": { en: "Profit & Loss", ar: "\u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0626\u0631" },
  "Qty": { en: "Qty", ar: "\u0627\u0644\u0643\u0645\u064a\u0629" },
  "Quantity": { en: "Quantity", ar: "\u0627\u0644\u0643\u0645\u064a\u0629" },
  "Reason": { en: "Reason", ar: "\u0627\u0644\u0633\u0628\u0628" },
  "Receive stock": { en: "Receive stock", ar: "\u0627\u0633\u062a\u0644\u0627\u0645 \u0645\u062e\u0632\u0648\u0646" },
  "Received": { en: "Received", ar: "\u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645" },
  "Received on": { en: "Received on", ar: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645" },
  "Recent orders": { en: "Recent orders", ar: "\u0623\u062d\u062f\u062b \u0627\u0644\u0637\u0644\u0628\u0627\u062a" },
  "Record expense": { en: "Record expense", ar: "\u062a\u0633\u062c\u064a\u0644 \u0645\u0635\u0631\u0648\u0641" },
  "Record income": { en: "Record income", ar: "\u062a\u0633\u062c\u064a\u0644 \u062f\u062e\u0644" },
  "Revenue": { en: "Revenue", ar: "\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a" },
  "Revenue \u00b7 last 6 months": { en: "Revenue \u00b7 last 6 months", ar: "\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u00b7 \u0622\u062e\u0631 6 \u0623\u0634\u0647\u0631" },
  "Role updated": { en: "Role updated", ar: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062f\u0648\u0631" },
  "SKU": { en: "SKU", ar: "\u0631\u0645\u0632 \u0627\u0644\u0645\u0646\u062a\u062c" },
  "Sale": { en: "Sale", ar: "\u0633\u0639\u0631 \u0627\u0644\u0628\u064a\u0639" },
  "Save": { en: "Save", ar: "\u062d\u0641\u0638" },
  "Serial": { en: "Serial", ar: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062a\u0633\u0644\u0633\u0644\u064a" },
  "Serial numbers (optional, one per line)": { en: "Serial numbers (optional, one per line)", ar: "\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062a\u0633\u0644\u0633\u0644\u064a\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u060c \u0631\u0642\u0645 \u0641\u064a \u0643\u0644 \u0633\u0637\u0631)" },
  "Serials": { en: "Serials", ar: "\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062a\u0633\u0644\u0633\u0644\u064a\u0629" },
  "Shipping": { en: "Shipping", ar: "\u0627\u0644\u0634\u062d\u0646" },
  "Shipping + platform fee": { en: "Shipping + platform fee", ar: "\u0627\u0644\u0634\u062d\u0646 + \u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0646\u0635\u0629" },
  "Shipping cost": { en: "Shipping cost", ar: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u062d\u0646" },
  "Sign in": { en: "Sign in", ar: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644" },
  "Source": { en: "Source", ar: "\u0627\u0644\u0645\u0635\u062f\u0631" },
  "Status": { en: "Status", ar: "\u0627\u0644\u062d\u0627\u0644\u0629" },
  "Stock": { en: "Stock", ar: "\u0627\u0644\u0645\u062e\u0632\u0648\u0646" },
  "Stock adjusted": { en: "Stock adjusted", ar: "\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u062e\u0632\u0648\u0646" },
  "Stock is deducted automatically for each line.": { en: "Stock is deducted automatically for each line.", ar: "\u064a\u064f\u062e\u0635\u0645 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0644\u0643\u0644 \u0628\u0646\u062f." },
  "Stock received": { en: "Stock received", ar: "\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u062e\u0632\u0648\u0646" },
  "Stock value": { en: "Stock value", ar: "\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u062e\u0632\u0648\u0646" },
  "Supplier": { en: "Supplier", ar: "\u0627\u0644\u0645\u0648\u0631\u062f" },
  "To": { en: "To", ar: "\u0625\u0644\u0649" },
  "Top 5 products by margin": { en: "Top 5 products by margin", ar: "\u0623\u0639\u0644\u0649 5 \u0645\u0646\u062a\u062c\u0627\u062a \u0631\u0628\u062d\u064b\u0627" },
  "Total": { en: "Total", ar: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a" },
  "Total expenses": { en: "Total expenses", ar: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641" },
  "Unit cost": { en: "Unit cost", ar: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0648\u062d\u062f\u0629" },
  "Value": { en: "Value", ar: "\u0627\u0644\u0642\u064a\u0645\u0629" },
  "View": { en: "View", ar: "\u0639\u0631\u0636" },
  "When": { en: "When", ar: "\u0645\u062a\u0649" },
  "Which products and platforms sell \u2014 costs and financial records stay with the Owner.": { en: "Which products and platforms sell \u2014 costs and financial records stay with the Owner.", ar: "\u0623\u064a \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0648\u0627\u0644\u0645\u0646\u0635\u0627\u062a \u062a\u0628\u064a\u0639 \u2014 \u0627\u0644\u062a\u0643\u0627\u0644\u064a\u0641 \u0648\u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u062a\u0628\u0642\u0649 \u0644\u062f\u0649 \u0627\u0644\u0645\u0627\u0644\u0643." },
  printPdf: { en: "Print / PDF", ar: "طباعة / PDF" },
  "Unknown": { en: "Unknown", ar: "\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641" },
  "Save order": { en: "Save order", ar: "\u062d\u0641\u0638 \u0627\u0644\u0637\u0644\u0628" },
  "Landed cost per unit = unit cost + shipping split across the batch. Weighted average cost updates automatically.": { 
    en: "Landed cost per unit = unit cost + shipping split across the batch. Weighted average cost updates automatically.", 
    ar: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0648\u062d\u062f\u0629 = \u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0648\u062d\u062f\u0629 + \u062a\u0642\u0633\u064a\u0645 \u0627\u0644\u0634\u062d\u0646 \u0639\u0644\u0649 \u0627\u0644\u062f\u0641\u0639\u0629. \u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0631\u062c\u062d \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627."
  },
  "1 product is at or below the reorder threshold": { en: "1 product is at or below the reorder threshold", ar: "\u0645\u0646\u062a\u062c \u0648\u0627\u062d\u062f \u0639\u0646\u062f \u0623\u0648 \u0623\u0642\u0644 \u0645\u0646 \u062d\u062f \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628" },
  "{count} products are at or below the reorder threshold": { en: "{count} products are at or below the reorder threshold", ar: "{count} \u0645\u0646\u062a\u062c\u0627\u062a \u0639\u0646\u062f \u0623\u0648 \u0623\u0642\u0644 \u0645\u0646 \u062d\u062f \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628" },
  "Saving\u2026": { en: "Saving\u2026", ar: "\u062c\u0627\u0631\u064d \u0627\u0644\u062d\u0641\u0638\u2026" },
  "No products yet \u2014 add them in Settings \u2192 Product catalog.": { en: "No products yet \u2014 add them in Settings \u2192 Product catalog.", ar: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u0628\u0639\u062f \u2014 \u0623\u0636\u0641\u0647\u0627 \u0641\u064a \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u2190 \u0643\u062a\u0627\u0644\u0648\u062c \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a." },
  "Order fulfilment": { en: "Order fulfilment", ar: "\u062a\u0646\u0641\u064a\u0630 \u0627\u0644\u0637\u0644\u0628" },
  "Revenue (orders)": { en: "Revenue (orders)", ar: "\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a (\u0627\u0644\u0637\u0644\u0628\u0627\u062a)" },
  "Other income": { en: "Other income", ar: "\u062f\u062e\u0644 \u0622\u062e\u0631" },
  "Other expenses": { en: "Other expenses", ar: "\u0645\u0635\u0627\u0631\u064a\u0641 \u0623\u062e\u0631\u0649" },
  "Ads": { en: "Ads", ar: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062a" },
  "pcs": { en: "pcs", ar: "\u0642\u0637\u0639\u0629" },
  "Ask the Owner if you need access to this section.": { en: "Ask the Owner if you need access to this section.", ar: "\u0627\u0633\u0623\u0644 \u0627\u0644\u0645\u0627\u0644\u0643 \u0625\u0630\u0627 \u0643\u0646\u062a \u0628\u062d\u0627\u062c\u0629 \u0625\u0644\u0649 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645." },
  "min": { en: "min", ar: "\u0627\u0644\u0623\u062f\u0646\u0649" },
};


for (const [k, v] of Object.entries(EXTRA_DICT)) if (!(k in DICT)) DICT[k] = v;
DICT["role_owner"] = EXTRA_DICT["role_owner"]!;

export const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  idea: { en: "Idea", ar: "فكرة" },
  in_development: { en: "In development", ar: "قيد التطوير" },
  preparing: { en: "Preparing", ar: "قيد التحضير" },
  ready: { en: "Ready", ar: "جاهز" },
  future_product: { en: "Future product", ar: "منتج مستقبلي" },
  active: { en: "Active", ar: "نشط" },
  out_of_stock: { en: "Out of stock", ar: "نفد المخزون" },
  discontinued: { en: "Discontinued", ar: "موقوف" },
  sent_from_palestine: { en: "Sent from Palestine", ar: "أُرسلت من فلسطين" },
  in_transit: { en: "In transit", ar: "قيد النقل" },
  customs: { en: "Customs", ar: "الجمارك" },
  arrived_in_malaysia: { en: "Arrived in Malaysia", ar: "وصلت إلى ماليزيا" },
  added_to_inventory: { en: "Added to inventory", ar: "أُضيفت إلى المخزون" },
};

type Ctx = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT | string) => string;
  ts: (key: string) => string;
};

const LangContext = createContext<Ctx | null>(null);

let currentLang: Lang = "en";
/** Translate outside hooks (toasts, helpers). Tree remounts on language change so this stays fresh. */
export function tt(key: string): string {
  return DICT[key]?.[currentLang] ?? key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", data.user.id)
        .maybeSingle();
      const value = (profile as { language?: string } | null)?.language;
      if (!cancelled && (value === "ar" || value === "en")) setLangState(value);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("profiles").update({ language: next }).eq("id", data.user.id);
      }
    })();
  }, []);

  currentLang = lang;
  const value = useMemo<Ctx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang,
      t: (key: string) => DICT[key]?.[lang] ?? key,
      ts: (key: string) => STATUS_LABELS[key]?.[lang] ?? key.replace(/_/g, " "),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}><Fragment key={lang}>{children}</Fragment></LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    return {
      lang: "en" as Lang,
      dir: "ltr" as const,
      setLang: () => {},
      t: (key: string) => DICT[key]?.en ?? key,
      ts: (key: string) => STATUS_LABELS[key]?.en ?? key.replace(/_/g, " "),
    };
  }
  return ctx;
}
