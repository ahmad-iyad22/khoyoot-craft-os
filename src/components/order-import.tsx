import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/lib/i18n';
import { buildImportLines, detectColumns, groupImportLines, IMPORT_FIELDS, importStatus, statusKey, stockShortfalls, type ColumnMap, type ImportLine, type ImportProduct, type StatusMap } from '@/lib/order-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductThumbnail } from '@/components/product-thumbnail';
import { money, ORDER_STATUSES } from '@/lib/format';

type SavedMapping = { columns?: Partial<ColumnMap>; statusMap?: StatusMap; lineTotal?: boolean; useFileFee?: boolean };
const firstFinite = (vals: (number | undefined)[]) => vals.find(v => Number.isFinite(v)) ?? NaN;

export function OrderImport() {
 const {t,ts}=useI18n(); const qc=useQueryClient();
 const [open,setOpen]=useState(false),[platform,setPlatform]=useState(''),[rows,setRows]=useState<Record<string,unknown>[]>([]),[headers,setHeaders]=useState<string[]>([]),[columns,setColumns]=useState<ColumnMap>(()=>detectColumns([])),[lines,setLines]=useState<ImportLine[]>([]),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[currency,setCurrency]=useState(false),[error,setError]=useState(''),[results,setResults]=useState<Record<string,string>>({}),[lineTotal,setLineTotal]=useState(false),[useFileFee,setUseFileFee]=useState(false),[statusMap,setStatusMap]=useState<StatusMap>({}),[done,setDone]=useState(false);
 const productsQ=useQuery({queryKey:['order-import-products'],enabled:open,queryFn:async()=>{const {data,error}=await supabase.from('products').select('id,sku,name,stock_qty,image_url,avg_cost').eq('archived',false).in('status',['active','out_of_stock']);if(error)throw error;return data as ImportProduct[];}});
 const feesQ=useQuery({queryKey:['order-import-platforms'],enabled:open,queryFn:async()=>{const {data,error}=await supabase.from('platform_fees').select('platform').order('platform');if(error)throw error;return (data??[]).map(r=>r.platform);}});
 const settingsQ=useQuery({queryKey:['order-import-settings'],enabled:open,queryFn:async()=>{const {data,error}=await supabase.from('app_settings').select('list_options').eq('id',true).maybeSingle();if(error)throw error;return (data?.list_options??{}) as Record<string,unknown>;}});
 const platforms=feesQ.data??[]; const products=productsQ.data??[];
 const saved=((settingsQ.data?.['import_mappings']??{}) as Record<string,SavedMapping>)[platform];
 const groups=useMemo(()=>groupImportLines(lines),[lines]);
 const isDone=(ref:string)=>results[ref]==='created'||results[ref]==='duplicate';
 const short=useMemo(()=>stockShortfalls(groups,products,isDone),[groups,products,results]); // eslint-disable-line react-hooks/exhaustive-deps
 const rawStatuses=useMemo(()=>[...new Set(rows.map(r=>String(r[columns.status]??'').trim()).filter(Boolean))],[rows,columns.status]);
 const update=(index:number,patch:Partial<ImportLine>)=>setLines(old=>old.map((l,i)=>i===index?{...l,...patch}:l));
 function applySaved(hs:string[]){
  const auto=detectColumns(hs); const m=saved?.columns??{};
  setColumns(Object.fromEntries(IMPORT_FIELDS.map(f=>[f,m[f]&&hs.includes(m[f]!)?m[f]:auto[f]])) as ColumnMap);
  setStatusMap(saved?.statusMap??{}); setLineTotal(!!saved?.lineTotal); setUseFileFee(!!saved?.useFileFee);
 }
 async function readFile(file:File){
  setBusy(true);setError('');setResults({});setReview(false);setDone(false);setRows([]);setLines([]);setCurrency(false);
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
   const clean=hs.filter(Boolean); setHeaders(clean); applySaved(clean);
   setRows(rs.map(row=>Object.fromEntries(clean.map(h=>[h,row[hs.indexOf(h)]]))));
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function goReview(){
  const fullMap:StatusMap=Object.fromEntries(rawStatuses.map(s=>[statusKey(s),statusMap[statusKey(s)]??importStatus(s)]));
  const ls=buildImportLines(rows,columns,products,fullMap);
  setLines(lineTotal?ls.map(l=>({...l,sale_price:l.sale_price/l.quantity})):ls);setReview(true);
  const all=(settingsQ.data??{}); const maps={...((all['import_mappings']??{}) as Record<string,SavedMapping>),[platform]:{columns,statusMap:fullMap,lineTotal,useFileFee}};
  const {error}=await supabase.from('app_settings').update({list_options:{...all,import_mappings:maps} as never}).eq('id',true);
  if(error)toast.error(error.message); else {toast.success(t('imp_saveMapping'));void qc.invalidateQueries({queryKey:['order-import-settings']});}
 }
 function reasonFor(g:{reference:string;valid:boolean;items:ImportLine[]}){
  if(g.items.some(l=>!l.product_id))return t('imp_noMatch');
  if(!g.valid)return t('imp_invalid');
  if(short.has(g.reference))return t('imp_overStock');
  return '';
 }
 async function create(){
  setBusy(true);setError('');
  try {
   for(const group of groups){
    if(isDone(group.reference))continue;
    const reason=reasonFor(group); if(reason){setResults(old=>({...old,[group.reference]:reason}));continue;}
    const first=group.items[0];if(!first)continue;
    const fee=firstFinite(group.items.map(l=>l.fee)); const ship=firstFinite(group.items.map(l=>l.shipping));
    const manual=useFileFee&&Number.isFinite(fee);
    const notes=[t('imp_importedNote'),Number.isFinite(ship)?`${t('imp_shipNote')}: ${ship}`:''].filter(Boolean).join(' · ');
    const {data,error}=await supabase.rpc('import_order',{_order:{order_number:group.reference,order_date:first.date,platform,status:first.status,customer_name:first.customer,shipping_cost:0,tax_amount:0,notes,platform_fee_manual:manual,...(manual?{platform_fee:fee}:{})},_lines:group.items.map(l=>({product_id:l.product_id,quantity:l.quantity,sale_price:l.sale_price}))});
    if(error){setResults(old=>({...old,[group.reference]:error.message.includes('INSUFFICIENT_STOCK')||error.message.toLowerCase().includes('stock')?t('imp_stock'):error.message.includes('IMPORT_')?t('imp_invalid'):error.message}));}
    else {const result=data as {status?:string};setResults(old=>({...old,[group.reference]:result.status==='duplicate'?'duplicate':'created'}));}
   }
   setDone(true);
  }finally{await qc.invalidateQueries();setBusy(false);}
 }
 const createdRevenue=groups.filter(g=>results[g.reference]==='created').reduce((s,g)=>s+g.items.reduce((a,l)=>a+l.quantity*l.sale_price,0),0);
 const skipped=groups.filter(g=>results[g.reference]&&results[g.reference]!=='created');
 return <>
  <Button variant="outline" onClick={()=>setOpen(true)}><Upload className="size-4"/>{t('imp_title')}</Button>
  <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{t('imp_title')}</DialogTitle><DialogDescription>{t('imp_fileTypes')}</DialogDescription></DialogHeader>
   <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>{t('ord_platform')}</Label><select aria-label={t('ord_platform')} disabled={busy||review} value={platform} onChange={e=>{setPlatform(e.target.value);setRows([]);setHeaders([]);}} className="h-10 w-full rounded-md border bg-background px-3"><option value="">—</option>{platforms.map(p=><option key={p}>{p}</option>)}</select></div><div className="space-y-2"><Label htmlFor="order-import-file">{t('imp_file')}</Label><Input id="order-import-file" type="file" accept=".csv,.xlsx" disabled={busy||!platform||settingsQ.isPending} onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);e.target.value='';}}/></div></div>
   {feesQ.data&&!platforms.length&&<p className="text-sm text-destructive">{t('imp_noFees')}</p>}
   {(error||productsQ.error||feesQ.error||settingsQ.error)&&<p role="alert" className="text-sm text-destructive">{error||productsQ.error?.message||feesQ.error?.message||settingsQ.error?.message}</p>}
   {!!rows.length&&!review&&<>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{IMPORT_FIELDS.map(field=><div key={field} className="space-y-1"><Label>{t(`imp_${field}`)}</Label><select aria-label={t(`imp_${field}`)} value={columns[field]} onChange={e=>setColumns(old=>({...old,[field]:e.target.value}))} className="h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="">—</option>{headers.map(h=><option key={h}>{h}</option>)}</select></div>)}</div>
    {!!rawStatuses.length&&<div className="space-y-2"><p className="text-sm font-medium">{t('imp_statusMap')}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rawStatuses.map(s=>{const k=statusKey(s);const v=statusMap[k]??importStatus(s);return <div key={k} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{s}</span><select aria-label={s} value={v} onChange={e=>setStatusMap(old=>({...old,[k]:e.target.value}))} className="h-9 rounded-md border bg-background px-2"><option value="">{t('imp_skipped')}</option>{ORDER_STATUSES.map(o=><option key={o} value={o}>{ts(o)}</option>)}</select></div>;})}</div></div>}
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={lineTotal} onCheckedChange={v=>setLineTotal(v===true)}/>{t('imp_lineTotal')}</label>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={useFileFee} disabled={!columns.fee} onCheckedChange={v=>setUseFileFee(v===true)}/>{t('imp_useFileFee')}</label>
    <Button disabled={busy||productsQ.isPending||!!productsQ.error||!columns.reference||!columns.quantity||!columns.price||(!columns.sku&&!columns.name)} onClick={()=>void goReview()}>{t('imp_review')}</Button>
   </>}
   {review&&<>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr>{['reference','date','sku','quantity','price','status'].map(f=><th key={f} className="p-2 text-start">{t(`imp_${f}`)}</th>)}<th className="p-2 text-start">{t('imp_available')}</th><th className="p-2 text-start">{t('imp_profit')}</th></tr></thead><tbody>{lines.map((l,i)=>{const result=results[l.reference];const fin=isDone(l.reference);const product=products.find(p=>p.id===l.product_id);const g=groups.find(x=>x.reference===l.reference);const reason=!fin&&g?reasonFor(g):'';const profit=product&&Number.isFinite(l.sale_price*l.quantity)?(l.sale_price-(product.avg_cost??0))*l.quantity:NaN;return <tr key={l.row} className="border-t"><td className="max-w-40 p-2"><div className="break-all">{l.reference||'—'}</div>{result&&<p className={fin?'text-muted-foreground':'text-destructive'}>{fin?t(`imp_${result}`):result}</p>}{!result&&reason&&<p className="text-destructive">{reason}</p>}</td><td className="p-2"><Input aria-label={t('imp_date')} type="date" value={l.date} disabled={fin||busy} onChange={e=>update(i,{date:e.target.value})}/></td><td className="max-w-64 p-2"><div className="mb-1 flex items-center gap-2"><ProductThumbnail url={product?.image_url ?? null} name={product?.name ?? null}/><span className="break-all text-xs text-muted-foreground">{l.source}</span></div><select aria-label={`${t('imp_match')} ${l.row}`} disabled={fin||busy} value={l.product_id} onChange={e=>update(i,{product_id:e.target.value})} className="h-10 w-full rounded-md border bg-background px-2"><option value="">{t('imp_match')}</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></td><td className="p-2"><Input aria-label={t('quantity')} type="number" min={1} step={1} value={Number.isFinite(l.quantity)?l.quantity:''} disabled={fin||busy} onChange={e=>update(i,{quantity:e.target.value===''?NaN:Number(e.target.value)})}/></td><td className="p-2"><Input aria-label={t('imp_price')} type="number" min={0} step="0.01" value={Number.isFinite(l.sale_price)?l.sale_price:''} disabled={fin||busy} onChange={e=>update(i,{sale_price:e.target.value===''?NaN:Number(e.target.value)})}/></td><td className="p-2"><select aria-label={t('imp_status')} disabled={fin||busy} value={l.status} onChange={e=>update(i,{status:e.target.value})} className="h-10 w-full rounded-md border bg-background px-2"><option value="">—</option>{ORDER_STATUSES.map(s=><option key={s} value={s}>{ts(s)}</option>)}</select></td><td className="p-2 tabular-nums">{product?.stock_qty??'—'}</td><td className="p-2 tabular-nums">{Number.isFinite(profit)?money(profit):'—'}</td></tr>;})}</tbody></table></div>
    <p className="text-sm">{t('ord_total')}: {money(lines.reduce((s,l)=>s+(Number.isFinite(l.sale_price*l.quantity)?l.sale_price*l.quantity:0),0))}</p>
    {done&&<div className="card-surface space-y-1 p-3 text-sm"><p className="font-medium">{t('imp_summary')}</p><p>{t('imp_created')}: {groups.filter(g=>results[g.reference]==='created').length} · {t('imp_skipped')}: {skipped.length} · {t('imp_revenue')}: {money(createdRevenue)}</p>{skipped.map(g=><p key={g.reference} className="text-muted-foreground">{g.reference}: {results[g.reference]==='duplicate'?t('imp_duplicate'):results[g.reference]}</p>)}</div>}
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={currency} onCheckedChange={v=>setCurrency(v===true)} disabled={busy}/>{t('imp_myr')}</label>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy||Object.values(results).some(v=>v==='created')} onClick={()=>{setReview(false);setResults({});setDone(false);}}>{t('imp_columns')}</Button><Button disabled={busy||!currency||!platform||!groups.some(g=>!isDone(g.reference))} onClick={()=>void create()}>{busy?t('ord_saving'):t('imp_create')}</Button></div>
   </>}
  </DialogContent></Dialog>
 </>;
}
