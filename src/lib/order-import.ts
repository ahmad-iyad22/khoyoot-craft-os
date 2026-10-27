export type ImportProduct = { id: string; sku: string; name: string; stock_qty: number; image_url: string | null };
export type ImportLine = { row: number; reference: string; date: string; status: string; source: string; product_id: string; quantity: number; sale_price: number; customer: string };
export const IMPORT_FIELDS = ['reference', 'date', 'sku', 'name', 'quantity', 'price', 'status', 'customer'] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
export type ColumnMap = Record<ImportField, string>;
const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[\s_\-()./]+/g, '');
const aliases: Record<ImportField, string[]> = {
 reference: ['Order ID', 'Order Number', 'Order No.', 'Order SN', 'Order/Adjust ID'],
 date: ['Order Creation Date', 'Created Time', 'Order Create Time', 'Order Created Time', 'Order Date', 'Create Time'],
 sku: ['Seller SKU', 'Seller SKU ID', 'SKU', 'SKU Reference No.', 'Variation SKU', 'SKU Seller'],
 name: ['Product Name', 'Item Name', 'Product', 'Item'],
 quantity: ['Quantity', 'Qty', 'SKU Quantity', 'Order Item Quantity'],
 price: ['Deal Price', 'Unit Price', 'Paid Price', 'Sale Price'],
 status: ['Order Status', 'Status'],
 customer: ['Buyer Username', 'Buyer Name', 'Customer Name', 'Recipient', 'Recipient Name'],
};
export function detectColumns(headers: string[]): ColumnMap {
 return Object.fromEntries(IMPORT_FIELDS.map(f => [f, aliases[f].map(a => headers.find(h => normalize(h) === normalize(a))).find(Boolean) ?? ''])) as ColumnMap;
}
export function importNumber(v: unknown): number {
 const s = String(v ?? '').trim().replace(/^(MYR|RM)\s*/i, '').replace(/,/g, '');
 return s === '' ? NaN : Number(s);
}
export function importDate(v: unknown): string {
 if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
 const s=String(v ?? '').trim();
 const m=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s|T|$)/.exec(s);
 if (!m) return '';
 const y=Number(m[1]), month=Number(m[2]), day=Number(m[3]);
 const d=new Date(y,month-1,day);
 return d.getFullYear()===y && d.getMonth()===month-1 && d.getDate()===day ? `${m[1]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
}
export function importStatus(v: unknown): string {
 const s=normalize(v);
 if (['cancelled','canceled'].includes(s)) return 'cancelled';
 if (['completed','complete'].includes(s)) return 'completed';
 if (['delivered'].includes(s)) return 'delivered';
 if (['shipped','shipping','intransit','toship','readytoship','tobeshipped','pending','unpaid','topay','processed','packed'].includes(s)) return ['shipped','shipping','intransit'].includes(s) ? 'shipped' : 'pending';
 return '';
}
export function matchProduct(sku: unknown, name: unknown, products: ImportProduct[]): string {
 const code=String(sku ?? '').trim().toLowerCase();
 const matches=code ? products.filter(p => p.sku.toLowerCase()===code) : products.filter(p => normalize(p.name)===normalize(name) && normalize(name)!=='');
 return matches.length===1 ? matches[0]?.id ?? '' : '';
}
export function buildImportLines(rows: Record<string, unknown>[], columns: ColumnMap, products: ImportProduct[]): ImportLine[] {
 return rows.map((r,i)=>({row:i+2, reference:String(r[columns.reference]??'').trim(), date:importDate(r[columns.date]), status:importStatus(r[columns.status]), source:String(r[columns.sku] || r[columns.name] || ''), product_id:matchProduct(r[columns.sku],r[columns.name],products), quantity:importNumber(r[columns.quantity]), sale_price:importNumber(r[columns.price]), customer:String(r[columns.customer]??'')}));
}
export function groupImportLines(lines: ImportLine[]) {
 const grouped=new Map<string,ImportLine[]>();
 for(const line of lines) grouped.set(line.reference,[...(grouped.get(line.reference)??[]),line]);
 return [...grouped].map(([reference,items])=>({reference,items,valid:!!reference && items.every(l=>!!l.product_id && !!importDate(l.date) && !!l.status && Number.isInteger(l.quantity) && l.quantity>0 && Number.isFinite(l.sale_price) && l.sale_price>=0 && l.date===items[0]?.date && l.status===items[0]?.status)}));
}