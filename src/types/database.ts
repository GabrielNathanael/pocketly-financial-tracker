export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AccountType = 'bank' | 'cash' | 'ewallet' | 'credit_card'
export type CurrencyCode = 'IDR' | 'USD' | 'SGD'
export type TransactionType = 'income' | 'expense'
export type DebtType = 'debt' | 'receivable'
export type DebtStatus = 'active' | 'paid'
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: AccountType
          currency: CurrencyCode
          initial_balance: number
          current_balance: number
          icon: string | null
          color: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: AccountType
          currency?: CurrencyCode
          initial_balance?: number
          current_balance?: number
          icon?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: AccountType
          currency?: CurrencyCode
          initial_balance?: number
          current_balance?: number
          icon?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: TransactionType
          icon: string
          color: string | null
          is_default: boolean
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: TransactionType
          icon?: string
          color?: string | null
          is_default?: boolean
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: TransactionType
          icon?: string
          color?: string | null
          is_default?: boolean
          parent_id?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string
          type: TransactionType
          amount: number
          currency: CurrencyCode
          description: string | null
          transaction_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id: string
          type: TransactionType
          amount: number
          currency?: CurrencyCode
          description?: string | null
          transaction_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string
          type?: TransactionType
          amount?: number
          currency?: CurrencyCode
          description?: string | null
          transaction_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      transfers: {
        Row: {
          id: string
          user_id: string
          from_account_id: string
          to_account_id: string
          amount: number
          from_currency: CurrencyCode
          to_currency: CurrencyCode
          exchange_rate_used: number
          description: string | null
          transfer_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          from_account_id: string
          to_account_id: string
          amount: number
          from_currency?: CurrencyCode
          to_currency?: CurrencyCode
          exchange_rate_used?: number
          description?: string | null
          transfer_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          from_account_id?: string
          to_account_id?: string
          amount?: number
          from_currency?: CurrencyCode
          to_currency?: CurrencyCode
          exchange_rate_used?: number
          description?: string | null
          transfer_date?: string
          created_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          currency: CurrencyCode
          period_start_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          amount: number
          currency?: CurrencyCode
          period_start_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          amount?: number
          currency?: CurrencyCode
          period_start_date?: string
          created_at?: string
        }
      }
      debts: {
        Row: {
          id: string
          user_id: string
          type: DebtType
          counterparty_name: string
          initial_amount: number
          remaining_amount: number
          currency: CurrencyCode
          status: DebtStatus
          due_date: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: DebtType
          counterparty_name: string
          initial_amount: number
          remaining_amount?: number
          currency?: CurrencyCode
          status?: DebtStatus
          due_date?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: DebtType
          counterparty_name?: string
          initial_amount?: number
          remaining_amount?: number
          currency?: CurrencyCode
          status?: DebtStatus
          due_date?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      debt_payments: {
        Row: {
          id: string
          debt_id: string
          amount: number
          payment_date: string
          linked_transaction_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          debt_id: string
          amount: number
          payment_date?: string
          linked_transaction_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          debt_id?: string
          amount?: number
          payment_date?: string
          linked_transaction_id?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          table_name: string
          record_id: string
          action: AuditAction
          old_values: Json | null
          new_values: Json | null
          changed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          table_name: string
          record_id: string
          action: AuditAction
          old_values?: Json | null
          new_values?: Json | null
          changed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          table_name?: string
          record_id?: string
          action?: AuditAction
          old_values?: Json | null
          new_values?: Json | null
          changed_at?: string
        }
      }
      exchange_rates: {
        Row: {
          id: string
          base_currency: string
          target_currency: string
          rate: number
          fetched_at: string
        }
        Insert: {
          id?: string
          base_currency: string
          target_currency: string
          rate: number
          fetched_at?: string
        }
        Update: {
          id?: string
          base_currency?: string
          target_currency?: string
          rate?: number
          fetched_at?: string
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']> = never

export type Account = Tables<'accounts'>
export type Category = Tables<'categories'>
export type Transaction = Tables<'transactions'>
export type Transfer = Tables<'transfers'>
export type Budget = Tables<'budgets'>
export type Debt = Tables<'debts'>
export type DebtPayment = Tables<'debt_payments'>
export type AuditLog = Tables<'audit_logs'>
export type ExchangeRate = Tables<'exchange_rates'>

// Joined / enriched view types
export interface EnrichedTransaction extends Transaction {
  account?: Account
  category?: Category
}

export interface EnrichedTransfer extends Transfer {
  from_account?: Account
  to_account?: Account
}

export interface EnrichedBudget extends Budget {
  category?: Category
  actual_spent?: number
}

export interface EnrichedDebt extends Debt {
  payments?: DebtPayment[]
}
