export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          base_currency: string
          counting_statuses: string[]
          currencies: string[]
          id: boolean
          updated_at: string
        }
        Insert: {
          base_currency?: string
          counting_statuses?: string[]
          currencies?: string[]
          id?: boolean
          updated_at?: string
        }
        Update: {
          base_currency?: string
          counting_statuses?: string[]
          currencies?: string[]
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          summary: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          actual_balance: number | null
          actual_checked_at: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          name: string
          notes: string | null
          opening_balance: number
          opening_date: string
          opening_fx: number
          partner_id: string | null
          pending_payout: number
          updated_at: string
        }
        Insert: {
          actual_balance?: number | null
          actual_checked_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind: string
          name: string
          notes?: string | null
          opening_balance?: number
          opening_date?: string
          opening_fx?: number
          partner_id?: string | null
          pending_payout?: number
          updated_at?: string
        }
        Update: {
          actual_balance?: number | null
          actual_checked_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          opening_date?: string
          opening_fx?: number
          partner_id?: string | null
          pending_payout?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string
          amount: number
          base_amount: number
          created_at: string
          created_by: string | null
          currency: string
          fx_rate_to_base: number
          id: string
          note: string | null
          receipt_path: string | null
          to_account_id: string | null
          txn_date: string
          txn_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          base_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          fx_rate_to_base?: number
          id?: string
          note?: string | null
          receipt_path?: string | null
          to_account_id?: string | null
          txn_date?: string
          txn_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          base_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          fx_rate_to_base?: number
          id?: string
          note?: string | null
          receipt_path?: string | null
          to_account_id?: string | null
          txn_date?: string
          txn_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget: number
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          platform: string
          product_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          platform?: string
          product_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          platform?: string
          product_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ar: string | null
          prefix_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ar?: string | null
          prefix_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ar?: string | null
          prefix_code?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_date: string | null
          doc_type: string
          id: string
          notes: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_date?: string | null
          doc_type?: string
          id?: string
          notes?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_date?: string | null
          doc_type?: string
          id?: string
          notes?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      content_calendar: {
        Row: {
          attributed_orders: number
          attributed_revenue: number
          created_at: string
          engagement: number
          id: string
          notes: string | null
          platform: string
          product_id: string | null
          scheduled_date: string
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          attributed_orders?: number
          attributed_revenue?: number
          created_at?: string
          engagement?: number
          id?: string
          notes?: string | null
          platform?: string
          product_id?: string | null
          scheduled_date?: string
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          attributed_orders?: number
          attributed_revenue?: number
          created_at?: string
          engagement?: number
          id?: string
          notes?: string | null
          platform?: string
          product_id?: string | null
          scheduled_date?: string
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_shared: boolean
          label: string
          label_ar: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_shared?: boolean
          label: string
          label_ar?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          label?: string
          label_ar?: string | null
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          partner_id: string
          share_amount: number
          share_percent: number
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          partner_id: string
          share_amount?: number
          share_percent?: number
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          partner_id?: string
          share_amount?: number
          share_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          base_amount: number | null
          campaign_id: string | null
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          entry_date: string
          fx_rate_to_base: number
          id: string
          is_shared: boolean
          order_id: string | null
          paid_by_business: boolean
          paid_by_partner_id: string | null
          receipt_path: string | null
          shipment_id: string | null
          split_mode: string
          updated_at: string
        }
        Insert: {
          amount: number
          base_amount?: number | null
          campaign_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date?: string
          fx_rate_to_base?: number
          id?: string
          is_shared?: boolean
          order_id?: string | null
          paid_by_business?: boolean
          paid_by_partner_id?: string | null
          receipt_path?: string | null
          shipment_id?: string | null
          split_mode?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number | null
          campaign_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date?: string
          fx_rate_to_base?: number
          id?: string
          is_shared?: boolean
          order_id?: string | null
          paid_by_business?: boolean
          paid_by_partner_id?: string | null
          receipt_path?: string | null
          shipment_id?: string | null
          split_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_partner_id_fkey"
            columns: ["paid_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          base_amount: number | null
          created_at: string
          created_by: string | null
          currency: string
          entry_date: string
          fx_rate_to_base: number
          id: string
          notes: string | null
          order_id: string | null
          source: string
        }
        Insert: {
          amount: number
          base_amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_date?: string
          fx_rate_to_base?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          source?: string
        }
        Update: {
          amount?: number
          base_amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_date?: string
          fx_rate_to_base?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_code: string | null
          cost_owed_partner_id: string | null
          created_at: string
          created_by: string | null
          id: string
          landed_unit_cost: number
          notes: string | null
          product_id: string
          profit_split: Json | null
          quantity: number
          received_at: string
          remaining_qty: number | null
          shipment_id: string | null
          shipping_cost: number
          supplier_id: string | null
          unit_cost: number
        }
        Insert: {
          batch_code?: string | null
          cost_owed_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          landed_unit_cost?: number
          notes?: string | null
          product_id: string
          profit_split?: Json | null
          quantity: number
          received_at?: string
          remaining_qty?: number | null
          shipment_id?: string | null
          shipping_cost?: number
          supplier_id?: string | null
          unit_cost?: number
        }
        Update: {
          batch_code?: string | null
          cost_owed_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          landed_unit_cost?: number
          notes?: string | null
          product_id?: string
          profit_split?: Json | null
          quantity?: number
          received_at?: string
          remaining_qty?: number | null
          shipment_id?: string | null
          shipping_cost?: number
          supplier_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_cost_owed_partner_id_fkey"
            columns: ["cost_owed_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "inventory_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_history: {
        Row: {
          avg_cost: number
          id: string
          margin_percent: number
          product_id: string
          recorded_at: string
          selling_price: number
          shipment_id: string | null
          source: string
        }
        Insert: {
          avg_cost?: number
          id?: string
          margin_percent?: number
          product_id: string
          recorded_at?: string
          selling_price?: number
          shipment_id?: string | null
          source?: string
        }
        Update: {
          avg_cost?: number
          id?: string
          margin_percent?: number
          product_id?: string
          recorded_at?: string
          selling_price?: number
          shipment_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      month_closures: {
        Row: {
          closed_at: string
          closed_by: string | null
          id: string
          month: string
          snapshot: Json
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          id?: string
          month: string
          snapshot: Json
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          id?: string
          month?: string
          snapshot?: Json
        }
        Relationships: []
      }
      order_allocations: {
        Row: {
          batch_code: string | null
          batch_id: string | null
          cost_owed_partner_id: string | null
          created_at: string
          fee_refunded: number
          id: string
          order_id: string
          order_item_id: string
          product_id: string | null
          profit_split: Json | null
          quantity: number
          refund_amount: number
          returned_qty: number
          returned_serials: string[]
          serials: string[]
          unit_item_cost: number
          unit_landed_cost: number
        }
        Insert: {
          batch_code?: string | null
          batch_id?: string | null
          cost_owed_partner_id?: string | null
          created_at?: string
          fee_refunded?: number
          id?: string
          order_id: string
          order_item_id: string
          product_id?: string | null
          profit_split?: Json | null
          quantity: number
          refund_amount?: number
          returned_qty?: number
          returned_serials?: string[]
          serials?: string[]
          unit_item_cost?: number
          unit_landed_cost?: number
        }
        Update: {
          batch_code?: string | null
          batch_id?: string | null
          cost_owed_partner_id?: string | null
          created_at?: string
          fee_refunded?: number
          id?: string
          order_id?: string
          order_item_id?: string
          product_id?: string | null
          profit_split?: Json | null
          quantity?: number
          refund_amount?: number
          returned_qty?: number
          returned_serials?: string[]
          serials?: string[]
          unit_item_cost?: number
          unit_landed_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_cost_owed_partner_id_fkey"
            columns: ["cost_owed_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          packaging_unit_cost: number
          product_id: string | null
          quantity: number
          sale_price: number
          unit_cost: number
          unit_item_cost: number
          unit_landed_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          packaging_unit_cost?: number
          product_id?: string | null
          quantity?: number
          sale_price?: number
          unit_cost?: number
          unit_item_cost?: number
          unit_landed_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          packaging_unit_cost?: number
          product_id?: string | null
          quantity?: number
          sale_price?: number
          unit_cost?: number
          unit_item_cost?: number
          unit_landed_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_returns: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string
          order_item_id: string
          platform_fee_refunded: number
          quantity: number
          refund_amount: number
          refund_platform_fee: boolean
          return_date: string
          serials: string[]
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          order_item_id: string
          platform_fee_refunded?: number
          quantity: number
          refund_amount?: number
          refund_platform_fee?: boolean
          return_date?: string
          serials?: string[]
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          order_item_id?: string
          platform_fee_refunded?: number
          quantity?: number
          refund_amount?: number
          refund_platform_fee?: boolean
          return_date?: string
          serials?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_returns_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          fee_snapshot: Json | null
          id: string
          notes: string | null
          order_date: string
          order_number: string | null
          packaging_cost: number
          platform: string
          platform_fee: number
          platform_fee_auto: number
          platform_fee_manual: boolean
          shipping_cost: number
          split_override: Json | null
          status: string
          tax_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          fee_snapshot?: Json | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          packaging_cost?: number
          platform?: string
          platform_fee?: number
          platform_fee_auto?: number
          platform_fee_manual?: boolean
          shipping_cost?: number
          split_override?: Json | null
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          fee_snapshot?: Json | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          packaging_cost?: number
          platform?: string
          platform_fee?: number
          platform_fee_auto?: number
          platform_fee_manual?: boolean
          shipping_cost?: number
          split_override?: Json | null
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_profit_periods: {
        Row: {
          created_at: string
          id: string
          net_profit: number
          notes: string | null
          period_end: string
          period_start: string
          shares: Json
        }
        Insert: {
          created_at?: string
          id?: string
          net_profit: number
          notes?: string | null
          period_end: string
          period_start: string
          shares: Json
        }
        Update: {
          created_at?: string
          id?: string
          net_profit?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          shares?: Json
        }
        Relationships: []
      }
      partner_transactions: {
        Row: {
          amount: number
          base_amount: number | null
          created_at: string
          currency: string
          fx_rate_to_base: number
          id: string
          notes: string | null
          partner_id: string
          profit_period_id: string | null
          receipt_path: string | null
          settles_month: string | null
          shipment_cost_kind: string | null
          shipment_id: string | null
          txn_date: string
          txn_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          base_amount?: number | null
          created_at?: string
          currency?: string
          fx_rate_to_base?: number
          id?: string
          notes?: string | null
          partner_id: string
          profit_period_id?: string | null
          receipt_path?: string | null
          settles_month?: string | null
          shipment_cost_kind?: string | null
          shipment_id?: string | null
          txn_date?: string
          txn_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number | null
          created_at?: string
          currency?: string
          fx_rate_to_base?: number
          id?: string
          notes?: string | null
          partner_id?: string
          profit_period_id?: string | null
          receipt_path?: string | null
          settles_month?: string | null
          shipment_cost_kind?: string | null
          shipment_id?: string | null
          txn_date?: string
          txn_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transactions_profit_period_id_fkey"
            columns: ["profit_period_id"]
            isOneToOne: false
            referencedRelation: "partner_profit_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transactions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          expense_share_percent: number
          id: string
          location: string
          name: string
          notes: string | null
          profile_id: string | null
          share_percent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          expense_share_percent?: number
          id?: string
          location?: string
          name: string
          notes?: string | null
          profile_id?: string | null
          share_percent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          expense_share_percent?: number
          id?: string
          location?: string
          name?: string
          notes?: string | null
          profile_id?: string | null
          share_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_analytics: {
        Row: {
          ad_spend: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          orders: number
          platform: string
          product_views: number
          revenue: number
          snapshot_date: string
          updated_at: string
          views: number
        }
        Insert: {
          ad_spend?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          orders?: number
          platform: string
          product_views?: number
          revenue?: number
          snapshot_date?: string
          updated_at?: string
          views?: number
        }
        Update: {
          ad_spend?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          orders?: number
          platform?: string
          product_views?: number
          revenue?: number
          snapshot_date?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          commission_percent: number
          fee_percent: number
          fixed_fee: number
          id: string
          note: string | null
          platform: string
          sst_percent: number
          transaction_fee_percent: number
          updated_at: string
          waiver_until: string | null
        }
        Insert: {
          commission_percent?: number
          fee_percent?: number
          fixed_fee?: number
          id?: string
          note?: string | null
          platform: string
          sst_percent?: number
          transaction_fee_percent?: number
          updated_at?: string
          waiver_until?: string | null
        }
        Update: {
          commission_percent?: number
          fee_percent?: number
          fixed_fee?: number
          id?: string
          note?: string | null
          platform?: string
          sst_percent?: number
          transaction_fee_percent?: number
          updated_at?: string
          waiver_until?: string | null
        }
        Relationships: []
      }
      product_code_counters: {
        Row: {
          next_batch: number
          next_serial: number
          product_id: string
        }
        Insert: {
          next_batch?: number
          next_serial?: number
          product_id: string
        }
        Update: {
          next_batch?: number
          next_serial?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_code_counters_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived: boolean
          avg_cost: number
          category_id: string | null
          cost_price: number
          created_at: string
          description: string | null
          documents: Json
          expected_launch_date: string | null
          how_made: string | null
          id: string
          image_url: string
          margin_alert_threshold: number
          marketing_cost: number
          materials: string | null
          min_stock: number
          name: string
          name_ar: string | null
          notes: string | null
          packaging_cost_per_unit: number
          photos: Json
          prefix_code: string | null
          reorder_threshold: number
          sale_price: number
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          stock_qty: number
          supplier_id: string | null
          target_margin: number
          tracks_serials: boolean
          updated_at: string
          weight_grams: number
        }
        Insert: {
          archived?: boolean
          avg_cost?: number
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          documents?: Json
          expected_launch_date?: string | null
          how_made?: string | null
          id?: string
          image_url?: string
          margin_alert_threshold?: number
          marketing_cost?: number
          materials?: string | null
          min_stock?: number
          name: string
          name_ar?: string | null
          notes?: string | null
          packaging_cost_per_unit?: number
          photos?: Json
          prefix_code?: string | null
          reorder_threshold?: number
          sale_price?: number
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_qty?: number
          supplier_id?: string | null
          target_margin?: number
          tracks_serials?: boolean
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          archived?: boolean
          avg_cost?: number
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          documents?: Json
          expected_launch_date?: string | null
          how_made?: string | null
          id?: string
          image_url?: string
          margin_alert_threshold?: number
          marketing_cost?: number
          materials?: string | null
          min_stock?: number
          name?: string
          name_ar?: string | null
          notes?: string | null
          packaging_cost_per_unit?: number
          photos?: Json
          prefix_code?: string | null
          reorder_threshold?: number
          sale_price?: number
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_qty?: number
          supplier_id?: string | null
          target_margin?: number
          tracks_serials?: boolean
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string
        }
        Relationships: []
      }
      serial_numbers: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          notes: string | null
          order_item_id: string | null
          product_id: string
          serial: string
          status: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_item_id?: string | null
          product_id: string
          serial: string
          status?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_item_id?: string | null
          product_id?: string
          serial?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "serial_numbers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          allocated_customs_line: number
          allocated_customs_per_unit: number
          allocated_shipping_line: number
          allocated_shipping_per_unit: number
          batch_code: string | null
          batch_id: string | null
          created_at: string
          customs_unit: number
          first_serial: string | null
          id: string
          landed_unit_cost: number
          last_serial: string | null
          product_cost: number | null
          product_id: string
          quantity: number
          ship_unit: number
          shipment_id: string
          sort_order: number
          supplier_amount_owed: number
          supplier_id: string | null
          total_weight_kg: number
          unit_product_cost: number
          unit_weight_grams: number
        }
        Insert: {
          allocated_customs_line?: number
          allocated_customs_per_unit?: number
          allocated_shipping_line?: number
          allocated_shipping_per_unit?: number
          batch_code?: string | null
          batch_id?: string | null
          created_at?: string
          customs_unit?: number
          first_serial?: string | null
          id?: string
          landed_unit_cost?: number
          last_serial?: string | null
          product_cost?: number | null
          product_id: string
          quantity?: number
          ship_unit?: number
          shipment_id: string
          sort_order?: number
          supplier_amount_owed?: number
          supplier_id?: string | null
          total_weight_kg?: number
          unit_product_cost?: number
          unit_weight_grams?: number
        }
        Update: {
          allocated_customs_line?: number
          allocated_customs_per_unit?: number
          allocated_shipping_line?: number
          allocated_shipping_per_unit?: number
          batch_code?: string | null
          batch_id?: string | null
          created_at?: string
          customs_unit?: number
          first_serial?: string | null
          id?: string
          landed_unit_cost?: number
          last_serial?: string | null
          product_cost?: number | null
          product_id?: string
          quantity?: number
          ship_unit?: number
          shipment_id?: string
          sort_order?: number
          supplier_amount_owed?: number
          supplier_id?: string | null
          total_weight_kg?: number
          unit_product_cost?: number
          unit_weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "shipment_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          cost_owed_partner_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customs_base: number
          customs_cost: number
          customs_currency: string
          customs_fx: number
          customs_paid_by_partner_id: string | null
          id: string
          notes: string | null
          profit_split: Json | null
          receipt_path: string | null
          received_at: string | null
          reference: string
          sender_partner_id: string | null
          sender_supplier_id: string | null
          shipping_base: number
          shipping_fx: number
          shipping_paid_by_partner_id: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          status_dates: Json
          total_paid_weight_kg: number
          total_shipping_cost: number
          updated_at: string
        }
        Insert: {
          cost_owed_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_base?: number
          customs_cost?: number
          customs_currency?: string
          customs_fx?: number
          customs_paid_by_partner_id?: string | null
          id?: string
          notes?: string | null
          profit_split?: Json | null
          receipt_path?: string | null
          received_at?: string | null
          reference: string
          sender_partner_id?: string | null
          sender_supplier_id?: string | null
          shipping_base?: number
          shipping_fx?: number
          shipping_paid_by_partner_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          status_dates?: Json
          total_paid_weight_kg?: number
          total_shipping_cost?: number
          updated_at?: string
        }
        Update: {
          cost_owed_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_base?: number
          customs_cost?: number
          customs_currency?: string
          customs_fx?: number
          customs_paid_by_partner_id?: string | null
          id?: string
          notes?: string | null
          profit_split?: Json | null
          receipt_path?: string | null
          received_at?: string | null
          reference?: string
          sender_partner_id?: string | null
          sender_supplier_id?: string | null
          shipping_base?: number
          shipping_fx?: number
          shipping_paid_by_partner_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          status_dates?: Json
          total_paid_weight_kg?: number
          total_shipping_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_cost_owed_partner_id_fkey"
            columns: ["cost_owed_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_customs_paid_by_partner_id_fkey"
            columns: ["customs_paid_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_sender_partner_id_fkey"
            columns: ["sender_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_sender_supplier_id_fkey"
            columns: ["sender_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "shipments_sender_supplier_id_fkey"
            columns: ["sender_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_shipping_paid_by_partner_id_fkey"
            columns: ["shipping_paid_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_prefixes: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
          label_ar: string | null
          next_number: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
          label_ar?: string | null
          next_number?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
          label_ar?: string | null
          next_number?: number
        }
        Relationships: []
      }
      stock_losses: {
        Row: {
          batch_code: string | null
          batch_id: string | null
          cost_owed_partner_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_marketing: boolean
          loss_amount: number
          loss_date: string
          notes: string | null
          order_id: string | null
          product_id: string | null
          profit_split: Json | null
          quantity: number
          reason: string
          return_id: string | null
          serials: string[]
          unit_item_cost: number
          unit_landed_cost: number
        }
        Insert: {
          batch_code?: string | null
          batch_id?: string | null
          cost_owed_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_marketing?: boolean
          loss_amount?: number
          loss_date?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          profit_split?: Json | null
          quantity: number
          reason: string
          return_id?: string | null
          serials?: string[]
          unit_item_cost?: number
          unit_landed_cost?: number
        }
        Update: {
          batch_code?: string | null
          batch_id?: string | null
          cost_owed_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_marketing?: boolean
          loss_amount?: number
          loss_date?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          profit_split?: Json | null
          quantity?: number
          reason?: string
          return_id?: string | null
          serials?: string[]
          unit_item_cost?: number
          unit_landed_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_losses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_losses_cost_owed_partner_id_fkey"
            columns: ["cost_owed_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_losses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_losses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_losses_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "order_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          change_qty: number
          created_at: string
          id: string
          note: string | null
          product_id: string
          reason: string
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          change_qty: number
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          reason: string
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          change_qty?: number
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_on: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_on?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_on?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_prices: {
        Row: {
          agreed_price: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          product_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          agreed_price?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          product_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          agreed_price?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          product_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          lead_time_notes: string | null
          name: string
          phone: string | null
          products_supplied: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_time_notes?: string | null
          name: string
          phone?: string | null
          products_supplied?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_time_notes?: string | null
          name?: string
          phone?: string | null
          products_supplied?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bank_account_balances: {
        Row: {
          actual_balance: number | null
          actual_checked_at: string | null
          balance_base: number | null
          balance_native: number | null
          currency: string | null
          id: string | null
          kind: string | null
          name: string | null
          partner_id: string | null
          pending_payout: number | null
        }
        Insert: {
          actual_balance?: number | null
          actual_checked_at?: string | null
          balance_base?: never
          balance_native?: never
          currency?: string | null
          id?: string | null
          kind?: string | null
          name?: string | null
          partner_id?: string | null
          pending_payout?: number | null
        }
        Update: {
          actual_balance?: number | null
          actual_checked_at?: string | null
          balance_base?: never
          balance_native?: never
          currency?: string | null
          id?: string | null
          kind?: string | null
          name?: string | null
          partner_id?: string | null
          pending_payout?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_profit: {
        Row: {
          allocation_id: string | null
          batch_code: string | null
          batch_id: string | null
          cost_owed_partner_id: string | null
          effective_split: Json | null
          item_cost_owed: number | null
          landed_cost: number | null
          net_revenue: number | null
          order_date: string | null
          order_id: string | null
          order_item_id: string | null
          packaging_cost: number | null
          platform_fee_share: number | null
          product_id: string | null
          profit: number | null
          quantity: number | null
          returned_qty: number | null
          returned_serials: string[] | null
          sale_price: number | null
          serials: string[] | null
          shipping_tax_share: number | null
          split_missing: boolean | null
          status: string | null
          unit_item_cost: number | null
          unit_landed_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_cost_owed_partner_id_fkey"
            columns: ["cost_owed_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_line_costs: {
        Row: {
          allocated_customs_line: number | null
          allocated_customs_unit: number | null
          allocated_shipping_line: number | null
          allocated_shipping_unit: number | null
          customs_cost_per_kg: number | null
          id: string | null
          landed_cost_per_unit: number | null
          product_id: string | null
          quantity: number | null
          shipment_id: string | null
          shipping_cost_per_kg: number | null
          supplier_amount_owed_live: number | null
          supplier_id: string | null
          supplier_price_per_unit: number | null
          total_weight: number | null
          total_weight_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "shipment_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_balances: {
        Row: {
          balance: number | null
          name: string | null
          supplier_id: string | null
          total_owed: number | null
          total_paid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _alloc_item: {
        Args: {
          _item_id: string
          _order_id: string
          _pid: string
          _qty: number
          _serials: string[]
        }
        Returns: undefined
      }
      _apply_order_header: {
        Args: { _id: string; _order: Json }
        Returns: undefined
      }
      _insert_order_lines: {
        Args: { _allocate: boolean; _lines: Json; _order_id: string }
        Returns: undefined
      }
      _release_order: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          _change: number
          _note?: string
          _product_id: string
          _reason: string
        }
        Returns: undefined
      }
      allocate_shipment: { Args: { _shipment_id: string }; Returns: undefined }
      claim_next_sku: { Args: { _code: string }; Returns: string }
      close_month: { Args: { _month: string }; Returns: undefined }
      compute_platform_fee: {
        Args: { _date: string; _platform: string; _revenue: number }
        Returns: Json
      }
      create_order: { Args: { _lines: Json; _order: Json }; Returns: string }
      delete_order: { Args: { _id: string }; Returns: undefined }
      delete_shipment: { Args: { _id: string }; Returns: undefined }
      generate_batch_codes: {
        Args: { _batch_id: string; _product_id: string; _quantity: number }
        Returns: Json
      }
      get_products_basic: {
        Args: never
        Returns: {
          archived: boolean
          category_id: string
          id: string
          name: string
          name_ar: string
          sale_price: number
          sku: string
          stock_qty: number
        }[]
      }
      get_sales_performance: {
        Args: never
        Returns: {
          month: string
          name: string
          platform: string
          product_id: string
          revenue: number
          sku: string
          units_sold: number
        }[]
      }
      has_any_role: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_marketing: { Args: never; Returns: boolean }
      is_ops: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      month_statement: { Args: { _month: string }; Returns: Json }
      next_sku_preview: { Args: { _code: string }; Returns: string }
      partner_month_summary: { Args: { _month: string }; Returns: Json }
      preview_allocation: {
        Args: { _product_id: string; _qty: number; _serials?: string[] }
        Returns: Json
      }
      receive_shipment: { Args: { _shipment_id: string }; Returns: Json }
      receive_stock: {
        Args: {
          _batch_code?: string
          _notes?: string
          _product_id: string
          _quantity: number
          _received_at?: string
          _serials?: string[]
          _shipping_cost: number
          _supplier_id?: string
          _unit_cost: number
        }
        Returns: string
      }
      receive_stock_auto: {
        Args: {
          _notes?: string
          _product_id: string
          _quantity: number
          _received_at?: string
          _shipping_cost: number
          _supplier_id?: string
          _unit_cost: number
        }
        Returns: Json
      }
      record_return: {
        Args: {
          _action: string
          _date: string
          _item_id: string
          _notes: string
          _qty: number
          _refund: number
          _refund_fee: boolean
        }
        Returns: string
      }
      reopen_month: { Args: { _month: string }; Returns: undefined }
      save_partner_profit_period: {
        Args: {
          _end: string
          _id: string
          _notes?: string
          _profit: number
          _shares: Json
          _start: string
        }
        Returns: string
      }
      save_shared_expense: {
        Args: { _e: Json; _id: string; _splits: Json }
        Returns: string
      }
      save_shipment: {
        Args: { _id: string; _items: Json; _s: Json }
        Returns: string
      }
      set_order_status: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      settle_partner: {
        Args: {
          _amount: number
          _date: string
          _month: string
          _notes: string
          _partner_id: string
          _receipt: string
        }
        Returns: string
      }
      split_valid: { Args: { _s: Json }; Returns: boolean }
      undo_shipment_receipt: { Args: { _id: string }; Returns: undefined }
      update_order: {
        Args: { _id: string; _lines: Json; _order: Json }
        Returns: undefined
      }
      write_off_stock: {
        Args: {
          _date: string
          _notes: string
          _product_id: string
          _qty: number
          _reason: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "operations" | "marketing"
      product_status:
        | "idea"
        | "in_development"
        | "preparing"
        | "ready"
        | "future_product"
        | "active"
        | "out_of_stock"
        | "discontinued"
      shipment_status:
        | "preparing"
        | "sent_from_palestine"
        | "in_transit"
        | "customs"
        | "arrived_in_malaysia"
        | "added_to_inventory"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "operations", "marketing"],
      product_status: [
        "idea",
        "in_development",
        "preparing",
        "ready",
        "future_product",
        "active",
        "out_of_stock",
        "discontinued",
      ],
      shipment_status: [
        "preparing",
        "sent_from_palestine",
        "in_transit",
        "customs",
        "arrived_in_malaysia",
        "added_to_inventory",
      ],
    },
  },
} as const
