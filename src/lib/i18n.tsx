import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  printPdf: { en: "Print / PDF", ar: "طباعة / PDF" },
};


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
