/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { buildImportLines, detectColumns, groupImportLines, importDate, importStatus, matchProduct } from './order-import';
const products=[{id:'p1',sku:'LEA-001',name:'Bag',stock_qty:3,image_url:null},{id:'p2',sku:'BAG-001',name:'Bag',stock_qty:4,image_url:null}];
describe('marketplace imports',()=>{
 test('matches SKU exactly and refuses ambiguous names',()=>{expect(matchProduct('LEA-001','Bag',products)).toBe('p1');expect(matchProduct('', 'Bag',products)).toBe('');expect(matchProduct('wrong','Bag',products)).toBe('');});
 test('groups multiple product lines into one order with actual unit prices',()=>{const rows=[{'Order ID':'00123','Created Time':'2026-10-27 10:00','Seller SKU':'LEA-001',Quantity:2,'Unit Price':100,'Order Status':'Completed'},{'Order ID':'00123','Created Time':'2026-10-27 10:00','Seller SKU':'BAG-001',Quantity:1,'Unit Price':50,'Order Status':'Completed'}];const groups=groupImportLines(buildImportLines(rows,detectColumns(Object.keys(rows[0]??{})),products));expect(groups.length).toBe(1);expect(groups[0]?.valid).toBe(true);expect(groups[0]?.items.reduce((s,l)=>s+l.quantity*l.sale_price,0)).toBe(250);});
 test('missing price and fractional quantities block creation',()=>{const base={row:2,reference:'A',date:'2026-10-27',status:'pending',source:'SKU',product_id:'p1',customer:'',quantity:1,sale_price:NaN};expect(groupImportLines([base])[0]?.valid).toBe(false);expect(groupImportLines([{...base,sale_price:10,quantity:1.5}])[0]?.valid).toBe(false);});
 test('unknown and returned statuses are never guessed',()=>{expect(importStatus('Returned')).toBe('');expect(importStatus('Completed')).toBe('completed');expect(importDate('2026-02-30')).toBe('');expect(importDate('27/10/2026')).toBe('');});
 test('does not treat order totals as unit prices',()=>{expect(detectColumns(['Order ID','Order Total','Quantity']).price).toBe('');});
});