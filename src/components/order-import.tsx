import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/lib/i18n';
import { buildImportLines, detectColumns, groupImportLines, IMPORT_FIELDS, type ColumnMap, type ImportLine, type ImportProduct } from '@/lib/order-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductThumbnail } from '@/components/product-thumbnail';
import { money, ORDER_STATUSES } from '@/lib/format';

export function OrderImport() {
 const {t,ts}=useI18n(); const qc=useQueryClient();
 const [open,setOpen]=useState(false),[platform,setPlatform]=useState('Shopee'),[rows,setRows]=useState<Record<string,unknown>[]>([]),[headers,setHeaders]=useState<string[]>([]),[columns,setColumns]=useState<ColumnMap>(()=>detectColumns([])),[lines,setLines]=useState<ImportLine[]>([]),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[currency,setCurrency]=useState(false),[error,setError]=useState(''),[results,setResults]=useState<Record<string,string>>({}),[lineTotal,setLineTotal]=useState(false);
 const productsQ=useQuery({queryKey:['order-import-products'],enabled:open,queryFn:async()=>{const {data,error}=await supabase.from('products').select('id,sku,name,stock_qty,image_url').eq('archived',false).in('status',['active','out_of_stock']);if(error)throw error;return data as ImportProduct[];}});
 const feesQ=useQuery({queryKey:['order-import-fees',platform],enabled:open,queryFn:async()=>{const {data,error}=await supabase.from('platform_fees').select('platform').eq('platform',platform).maybeSingle();if(error)throw error;return data;}});
 const products=productsQ.data??[];
 const groups=useMemo(()=>groupImportLines(lines),[lines]);
 const update=(index:number,patch:Partial<ImportLine>)=>setLines(old=>old.map((l,i)=>i===index?{...l,...patch}:l));
 async function readFile(file:File){
  setBusy(true);setError('');setResults({});setReview(false);setRows([]);setLines([]);setCurrency(false);
  try{
   if(file.size>10*1024*1024)throw new Error(t('imp_size'));
   let grid:unknown[][]=[];
   if(/\.xlsx$/i.test(file.name)){const {readSheet}=await import('read-excel-file/browser');grid=await readSheet(file, 1);}
   else if(/\.csv$/i.test(file.name)){const {default:Papa}=await import('papaparse');const parsed=Papa.parse<string[]>(await file.text(),{skipEmptyLines:'greedy'});if(parsed.errors.length)throw new Error(t('imp_parse'));grid=parsed.data;}
   else throw new Error(t('imp_format'));
   const start=grid.findIndex(row=>!!detectColumns(row.map(v=>String(v??'').trim())).reference);
   const first=grid[start>=0?start:0];if(!first)throw new Error(t('imp_empty'));
   const hs=first.map(v=>String(v??'').trim());if(new Set(hs.filter(Boolean)).size!==hs.filter(Boolean).length)throw new Error(t('imp_headers'));
   const rs=grid.slice((start>=0?start:0)+1).filter(row=>row.some(v=>v!==null&&v!==undefined&&v!==''));
   if(!rs.length||rs.length>5000)throw new Error(t('imp_rows'));
   setHeaders(hs.filter(Boolean));setColumns(detectColumns(hs));setRows(rs.map(row=>Object.fromEntries(hs.filter(Boolean).map(h=>[h,row[hs.indexOf(h)]]))));
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function create(){
  setBusy(true);setError('');
  try {
   for(const group of groups){
    if(!group.valid || results[group.reference]==='created'||results[group.reference]==='duplicate')continue;
    const first=group.items[0];if(!first)continue;
    const {data,error}=await supabase.rpc('import_order',{_order:{order_number:group.reference,order_date:first.date,platform,status:first.status,customer_name:first.customer,shipping_cost:0,tax_amount:0,notes:t('imp_importedNote')},_lines:group.items.map(l=>({product_id:l.product_id,quantity:l.quantity,sale_price:l.sale_price}))});
    if(error){setResults(old=>({...old,[group.reference]:error.message.includes('INSUFFICIENT_STOCK')?t('imp_stock'):error.message.includes('IMPORT_')?t('imp_invalid'):error.message}));}
    else {const result=data as {status?:string};setResults(old=>({...old,[group.reference]:result.status==='duplicate'?'duplicate':'created'}));}
   }
  }finally{await qc.invalidateQueries();setBusy(false);}
 }
 return <>
  <Button variant="outline" onClick={()=>setOpen(true)}><Upload className="size-4"/>{t('imp_title')}</Button>
  <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{t('imp_title')}</DialogTitle><DialogDescription>{t('imp_fileTypes')}</DialogDescription></DialogHeader>
   <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>{t('ord_platform')}</Label><select aria-label={t('ord_platform')} disabled={busy||review} value={platform} onChange={e=>setPlatform(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3">{['Shopee','TikTok Shop','Lazada'].map(p=><option key={p}>{p}</option>)}</select></div><div className="space-y-2"><Label htmlFor="order-import-file">{t('imp_file')}</Label><Input id="order-import-file" type="file" accept=".csv,.xlsx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);e.target.value='';}}/></div></div>
   {(error||productsQ.error||feesQ.error)&&<p role="alert" className="text-sm text-destructive">{error||productsQ.error?.message||feesQ.error?.message}</p>}
   {!!rows.length&&!review&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{IMPORT_FIELDS.map(field=><div key={field} className="space-y-1"><Label>{t(`imp_${field}`)}</Label><select aria-label={t(`imp_${field}`)} value={columns[field]} onChange={e=>setColumns(old=>({...old,[field]:e.target.value}))} className="h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="">—</option>{headers.map(h=><option key={h}>{h}</option>)}</select></div>)}</div><label className="flex items-center gap-2 text-sm"><Checkbox checked={lineTotal} onCheckedChange={v=>setLineTotal(v===true)}/>{t('imp_lineTotal')}</label><Button disabled={busy||productsQ.isPending||!!productsQ.error||!columns.reference||!columns.quantity||!columns.price||(!columns.sku&&!columns.name)} onClick={()=>{const ls=buildImportLines(rows,columns,products);setLines(lineTotal?ls.map(l=>({...l,sale_price:l.sale_price/l.quantity})):ls);setReview(true);}}>{t('imp_review')}</Button></>}
   {review&&<>
    <div className="flex flex-wrap gap-4 text-sm"><span>{groups.length} {t('orders')}</span><span>{t('imp_created')}: {Object.values(results).filter(v=>v==='created').length}</span><span>{t('imp_duplicate')}: {Object.values(results).filter(v=>v==='duplicate').length}</span></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr>{['reference','date','sku','quantity','price','status'].map(f=><th key={f} className="p-2 text-start">{t(`imp_${f}`)}</th>)}</tr></thead><tbody>{lines.map((l,i)=>{const result=results[l.reference];const saved=result==='created'||result==='duplicate';const product=products.find(p=>p.id===l.product_id);return <tr key={l.row} className="border-t"><td className="max-w-40 p-2"><div className="break-all">{l.reference||'—'}</div>{result&&<p className={saved?'text-muted-foreground':'text-destructive'}>{saved?t(`imp_${result}`):result}</p>}{!groups.find(g=>g.reference===l.reference)?.valid&&<p className="text-destructive">{t('imp_invalid')}</p>}</td><td className="p-2"><Input aria-label={t('imp_date')} type="date" value={l.date} disabled={saved||busy} onChange={e=>update(i,{date:e.target.value})}/></td><td className="max-w-64 p-2"><div className="mb-1 flex items-center gap-2"><ProductThumbnail url={product?.image_url ?? null} name={product?.name ?? null}/><span className="break-all text-xs text-muted-foreground">{l.source}</span></div><select aria-label={`${t('imp_match')} ${l.row}`} disabled={saved||busy} value={l.product_id} onChange={e=>update(i,{product_id:e.target.value})} className="h-10 w-full rounded-md border bg-background px-2"><option value="">{t('imp_match')}</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name} ({p.stock_qty})</option>)}</select></td><td className="p-2"><Input aria-label={t('quantity')} type="number" min={1} step={1} value={Number.isFinite(l.quantity)?l.quantity:''} disabled={saved||busy} onChange={e=>update(i,{quantity:e.target.value===''?NaN:Number(e.target.value)})}/></td><td className="p-2"><Input aria-label={t('imp_price')} type="number" min={0} step="0.01" value={Number.isFinite(l.sale_price)?l.sale_price:''} disabled={saved||busy} onChange={e=>update(i,{sale_price:e.target.value===''?NaN:Number(e.target.value)})}/></td><td className="p-2"><select aria-label={t('imp_status')} disabled={saved||busy} value={l.status} onChange={e=>update(i,{status:e.target.value})} className="h-10 w-full rounded-md border bg-background px-2"><option value="">—</option>{ORDER_STATUSES.map(s=><option key={s} value={s}>{ts(s)}</option>)}</select></td></tr>;})}</tbody></table></div>
    <p className="text-sm">{t('ord_total')}: {money(lines.reduce((s,l)=>s+(Number.isFinite(l.sale_price*l.quantity)?l.sale_price*l.quantity:0),0))}</p>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={currency} onCheckedChange={v=>setCurrency(v===true)} disabled={busy}/>{t('imp_myr')}</label>
    {!feesQ.data&&<p className="text-sm text-destructive">{t('imp_noFees')}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy||Object.values(results).some(v=>v==='created')} onClick={()=>{setReview(false);setResults({});}}>{t('imp_columns')}</Button><Button disabled={busy||!currency||!feesQ.data||!!feesQ.error||!groups.some(g=>g.valid&&results[g.reference]!=='created'&&results[g.reference]!=='duplicate')} onClick={()=>void create()}>{busy?t('ord_saving'):t('imp_create')}</Button></div>
   </>}
  </DialogContent></Dialog>
 </>;
}