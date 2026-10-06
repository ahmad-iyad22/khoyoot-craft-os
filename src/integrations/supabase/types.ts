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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          is_shared: boolean
          order_id: string | null
          paid_by_partner_id: string | null
          split_mode: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_shared?: boolean
          order_id?: string | null
          paid_by_partner_id?: string | null
          split_mode?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_shared?: boolean
          order_id?: string | null
          paid_by_partner_id?: string | null
          split_mode?: string
          updated_at?: string
        }
        Relationships: [
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
        ]
      }
      income: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          notes: string | null
          order_id: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
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
          created_at: string
          created_by: string | null
          id: string
          landed_unit_cost: number
          notes: string | null
          product_id: string
          quantity: number
          received_at: string
          shipping_cost: number
          supplier_id: string | null
          unit_cost: number
        }
        Insert: {
          batch_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          landed_unit_cost?: number
          notes?: string | null
          product_id: string
          quantity: number
          received_at?: string
          shipping_cost?: number
          supplier_id?: string | null
          unit_cost?: number
        }
        Update: {
          batch_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          landed_unit_cost?: number
          notes?: string | null
          product_id?: string
          quantity?: number
          received_at?: string
          shipping_cost?: number
          supplier_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          sale_price: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          sale_price?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          sale_price?: number
          unit_cost?: number
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
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string | null
          platform: string
          platform_fee: number
          shipping_cost: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          platform?: string
          platform_fee?: number
          shipping_cost?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          platform?: string
          platform_fee?: number
          shipping_cost?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          partner_id: string
          txn_date: string
          txn_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          partner_id: string
          txn_date?: string
          txn_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string
          txn_date?: string
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
          fee_percent: number
          id: string
          platform: string
          updated_at: string
        }
        Insert: {
          fee_percent?: number
          id?: string
          platform: string
          updated_at?: string
        }
        Update: {
          fee_percent?: number
          id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
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
          product_id: string
          serial: string
          status: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          serial: string
          status?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
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
          allocated_customs_per_unit: number
          allocated_shipping_per_unit: number
          created_at: string
          id: string
          landed_unit_cost: number
          product_id: string
          quantity: number
          shipment_id: string
          supplier_amount_owed: number
          supplier_id: string | null
          total_weight_kg: number
          unit_product_cost: number
        }
        Insert: {
          allocated_customs_per_unit?: number
          allocated_shipping_per_unit?: number
          created_at?: string
          id?: string
          landed_unit_cost?: number
          product_id: string
          quantity?: number
          shipment_id: string
          supplier_amount_owed?: number
          supplier_id?: string | null
          total_weight_kg?: number
          unit_product_cost?: number
        }
        Update: {
          allocated_customs_per_unit?: number
          allocated_shipping_per_unit?: number
          created_at?: string
          id?: string
          landed_unit_cost?: number
          product_id?: string
          quantity?: number
          shipment_id?: string
          supplier_amount_owed?: number
          supplier_id?: string | null
          total_weight_kg?: number
          unit_product_cost?: number
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
      shipments: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customs_cost: number
          id: string
          notes: string | null
          received_at: string | null
          reference: string
          status: Database["public"]["Enums"]["shipment_status"]
          status_dates: Json
          total_paid_weight_kg: number
          total_shipping_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_cost?: number
          id?: string
          notes?: string | null
          received_at?: string | null
          reference: string
          status?: Database["public"]["Enums"]["shipment_status"]
          status_dates?: Json
          total_paid_weight_kg?: number
          total_shipping_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_cost?: number
          id?: string
          notes?: string | null
          received_at?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          status_dates?: Json
          total_paid_weight_kg?: number
          total_shipping_cost?: number
          updated_at?: string
        }
        Relationships: []
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
      adjust_stock: {
        Args: {
          _change: number
          _note?: string
          _product_id: string
          _reason: string
        }
        Returns: undefined
      }
      claim_next_sku: { Args: { _code: string }; Returns: string }
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
      next_sku_preview: { Args: { _code: string }; Returns: string }
      receive_shipment: { Args: { _shipment_id: string }; Returns: undefined }
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
