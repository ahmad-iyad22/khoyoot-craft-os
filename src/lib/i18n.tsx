import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
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
