export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountType =
  | "bank"
  | "cash"
  | "ewallet"
  | "credit_card"
  | "investment";
export type CurrencyCode = "IDR" | "USD" | "SGD";
export type TransactionType = "income" | "expense";
export type DebtType = "debt" | "receivable";
export type DebtStatus = "active" | "paid";
export type AuditAction = "INSERT" | "UPDATE" | "DELETE";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type GoalStatus = "in_progress" | "completed" | "paused";
export type GoalDepositType = "deposit" | "withdraw";
export type CryptoTradeType = "buy" | "sell";

export interface Database {
  public: {
    Tables: {
      accounts: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: AccountType;
          currency: CurrencyCode;
          initial_balance: number;
          current_balance: number;
          icon: string | null;
          color: string | null;
          is_active: boolean;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: AccountType;
          currency?: CurrencyCode;
          initial_balance?: number;
          current_balance?: number;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: AccountType;
          currency?: CurrencyCode;
          initial_balance?: number;
          current_balance?: number;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
        };
      };
      categories: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: TransactionType;
          icon: string;
          color: string | null;
          is_default: boolean;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: TransactionType;
          icon?: string;
          color?: string | null;
          is_default?: boolean;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: TransactionType;
          icon?: string;
          color?: string | null;
          is_default?: boolean;
          parent_id?: string | null;
          created_at?: string;
        };
      };
      transactions: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string;
          transfer_id: string | null;
          crypto_trade_id: string | null;
          type: TransactionType;
          amount: number;
          currency: CurrencyCode;
          description: string | null;
          tags: string[];
          transaction_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          category_id: string;
          transfer_id?: string | null;
          crypto_trade_id?: string | null;
          type: TransactionType;
          amount: number;
          currency?: CurrencyCode;
          description?: string | null;
          tags?: string[];
          transaction_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string;
          transfer_id?: string | null;
          crypto_trade_id?: string | null;
          type?: TransactionType;
          amount?: number;
          currency?: CurrencyCode;
          description?: string | null;
          tags?: string[];
          transaction_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transfers: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: number;
          from_currency: CurrencyCode;
          to_currency: CurrencyCode;
          exchange_rate_used: number;
          fee_amount: number;
          fee_mode: "added_to_source" | "deducted_from_amount";
          net_amount: number;
          description: string | null;
          transfer_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: number;
          from_currency?: CurrencyCode;
          to_currency?: CurrencyCode;
          exchange_rate_used?: number;
          fee_amount?: number;
          fee_mode?: "added_to_source" | "deducted_from_amount";
          net_amount?: number;
          description?: string | null;
          transfer_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          from_account_id?: string;
          to_account_id?: string;
          amount?: number;
          from_currency?: CurrencyCode;
          to_currency?: CurrencyCode;
          exchange_rate_used?: number;
          fee_amount?: number;
          fee_mode?: "added_to_source" | "deducted_from_amount";
          net_amount?: number;
          description?: string | null;
          transfer_date?: string;
          created_at?: string;
        };
      };
      budgets: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          currency: CurrencyCode;
          period_start_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          currency?: CurrencyCode;
          period_start_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          currency?: CurrencyCode;
          period_start_date?: string;
          created_at?: string;
        };
      };
      debts: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          type: DebtType;
          counterparty_name: string;
          initial_amount: number;
          remaining_amount: number;
          currency: CurrencyCode;
          status: DebtStatus;
          due_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: DebtType;
          counterparty_name: string;
          initial_amount: number;
          remaining_amount?: number;
          currency?: CurrencyCode;
          status?: DebtStatus;
          due_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: DebtType;
          counterparty_name?: string;
          initial_amount?: number;
          remaining_amount?: number;
          currency?: CurrencyCode;
          status?: DebtStatus;
          due_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      debt_payments: {
        Relationships: [];
        Row: {
          id: string;
          debt_id: string;
          amount: number;
          payment_date: string;
          linked_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          debt_id: string;
          amount: number;
          payment_date?: string;
          linked_transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          debt_id?: string;
          amount?: number;
          payment_date?: string;
          linked_transaction_id?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          table_name: string;
          record_id: string;
          action: AuditAction;
          old_values: Json | null;
          new_values: Json | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          table_name: string;
          record_id: string;
          action: AuditAction;
          old_values?: Json | null;
          new_values?: Json | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          table_name?: string;
          record_id?: string;
          action?: AuditAction;
          old_values?: Json | null;
          new_values?: Json | null;
          changed_at?: string;
        };
      };
      exchange_rates: {
        Relationships: [];
        Row: {
          id: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          base_currency?: string;
          target_currency?: string;
          rate?: number;
          fetched_at?: string;
        };
      };
      recurring_transactions: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: TransactionType;
          amount: number;
          currency: CurrencyCode;
          account_id: string;
          category_id: string | null;
          frequency: RecurringFrequency;
          interval_count: number;
          start_date: string;
          next_due_date: string;
          end_date: string | null;
          is_active: boolean;
          auto_process: boolean;
          notes: string | null;
          last_processed_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: TransactionType;
          amount: number;
          currency?: CurrencyCode;
          account_id: string;
          category_id?: string | null;
          frequency: RecurringFrequency;
          interval_count?: number;
          start_date?: string;
          next_due_date: string;
          end_date?: string | null;
          is_active?: boolean;
          auto_process?: boolean;
          notes?: string | null;
          last_processed_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: TransactionType;
          amount?: number;
          currency?: CurrencyCode;
          account_id?: string;
          category_id?: string | null;
          frequency?: RecurringFrequency;
          interval_count?: number;
          start_date?: string;
          next_due_date?: string;
          end_date?: string | null;
          is_active?: boolean;
          auto_process?: boolean;
          notes?: string | null;
          last_processed_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      savings_goals: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount: number;
          currency: CurrencyCode;
          target_date: string;
          category_id: string | null;
          icon: string;
          color: string;
          status: GoalStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount?: number;
          currency?: CurrencyCode;
          target_date: string;
          category_id?: string | null;
          icon?: string;
          color?: string;
          status?: GoalStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_amount?: number;
          current_amount?: number;
          currency?: CurrencyCode;
          target_date?: string;
          category_id?: string | null;
          icon?: string;
          color?: string;
          status?: GoalStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      savings_goal_deposits: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          account_id: string | null;
          type: GoalDepositType;
          amount: number;
          currency: CurrencyCode;
          deposit_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id: string;
          account_id?: string | null;
          type: GoalDepositType;
          amount: number;
          currency?: CurrencyCode;
          deposit_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string;
          account_id?: string | null;
          type?: GoalDepositType;
          amount?: number;
          currency?: CurrencyCode;
          deposit_date?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      stock_holdings: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          ticker: string;
          total_cost: number;
          lots: number;
          total_shares: number;
          avg_buy_price: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          ticker: string;
          total_cost: number;
          lots?: number;
          total_shares?: number;
          avg_buy_price?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          ticker?: string;
          total_cost?: number;
          lots?: number;
          total_shares?: number;
          avg_buy_price?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      stock_trades: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          holding_id: string | null;
          ticker: string;
          type: "buy" | "sell";
          net_amount: number;
          buy_cost: number;
          realized_pnl: number;
          lots: number;
          shares: number;
          price_per_share: number;
          stamp_duty: number;
          notes: string | null;
          trade_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          holding_id?: string | null;
          ticker: string;
          type: "buy" | "sell";
          net_amount: number;
          buy_cost?: number;
          realized_pnl?: number;
          lots?: number;
          shares?: number;
          price_per_share?: number;
          stamp_duty?: number;
          notes?: string | null;
          trade_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          holding_id?: string | null;
          ticker?: string;
          type?: "buy" | "sell";
          net_amount?: number;
          buy_cost?: number;
          realized_pnl?: number;
          lots?: number;
          shares?: number;
          price_per_share?: number;
          stamp_duty?: number;
          notes?: string | null;
          trade_date?: string;
          created_at?: string;
        };
      };
      crypto_holdings: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          symbol: string;
          name: string;
          quantity: number;
          cost_basis: number;
          average_buy_price: number;
          manual_price: number;
          price_currency: CurrencyCode;
          price_updated_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          symbol: string;
          name: string;
          quantity?: number;
          cost_basis?: number;
          average_buy_price?: number;
          manual_price?: number;
          price_currency?: CurrencyCode;
          price_updated_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          symbol?: string;
          name?: string;
          quantity?: number;
          cost_basis?: number;
          average_buy_price?: number;
          manual_price?: number;
          price_currency?: CurrencyCode;
          price_updated_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      crypto_trades: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          holding_id: string | null;
          symbol: string;
          type: CryptoTradeType;
          quantity: number;
          gross_amount: number;
          fee_amount: number;
          fee_currency: CurrencyCode;
          price_per_unit: number;
          cost_basis: number;
          realized_pnl: number;
          notes: string | null;
          trade_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          holding_id?: string | null;
          symbol: string;
          type: CryptoTradeType;
          quantity: number;
          gross_amount: number;
          fee_amount?: number;
          fee_currency?: CurrencyCode;
          price_per_unit: number;
          cost_basis?: number;
          realized_pnl?: number;
          notes?: string | null;
          trade_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          holding_id?: string | null;
          symbol?: string;
          type?: CryptoTradeType;
          quantity?: number;
          gross_amount?: number;
          fee_amount?: number;
          fee_currency?: CurrencyCode;
          price_per_unit?: number;
          cost_basis?: number;
          realized_pnl?: number;
          notes?: string | null;
          trade_date?: string;
          created_at?: string;
        };
      };
      pinned_templates: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          name: string;
          account_id: string;
          category_id: string;
          type: "income" | "expense";
          amount: number;
          currency: CurrencyCode;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          account_id: string;
          category_id: string;
          type: "income" | "expense";
          amount: number;
          currency?: CurrencyCode;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          account_id?: string;
          category_id?: string;
          type?: "income" | "expense";
          amount?: number;
          currency?: CurrencyCode;
          description?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]> = never;

export type Account = Tables<"accounts">;
export type Category = Tables<"categories">;
export type Transaction = Tables<"transactions">;
export type Transfer = Tables<"transfers">;
export type Budget = Tables<"budgets">;
export type Debt = Tables<"debts">;
export type DebtPayment = Tables<"debt_payments">;
export type AuditLog = Tables<"audit_logs">;
export type ExchangeRate = Tables<"exchange_rates">;
export type RecurringTransaction = Tables<"recurring_transactions">;
export type SavingsGoal = Tables<"savings_goals">;
export type SavingsGoalDeposit = Tables<"savings_goal_deposits">;
export type StockHolding = Tables<"stock_holdings">;
export type StockTrade = Tables<"stock_trades">;
export type CryptoHolding = Tables<"crypto_holdings">;
export type CryptoTrade = Tables<"crypto_trades">;
export type PinnedTemplateDB = Tables<"pinned_templates">;

// Joined / enriched view types
export interface EnrichedTransaction extends Transaction {
  account?: Account;
  category?: Category;
}

export interface EnrichedTransfer extends Transfer {
  from_account?: Account;
  to_account?: Account;
}

export interface EnrichedBudget extends Budget {
  category?: Category;
  actual_spent?: number;
}

export interface EnrichedDebt extends Debt {
  payments?: DebtPayment[];
}

export interface EnrichedRecurringTransaction extends RecurringTransaction {
  account?: Account;
  category?: Category;
}

export interface EnrichedSavingsGoalDeposit extends SavingsGoalDeposit {
  account?: Account;
}

export interface EnrichedSavingsGoal extends SavingsGoal {
  category?: Category;
  deposits?: EnrichedSavingsGoalDeposit[];
}

export interface EnrichedStockHolding extends StockHolding {
  account?: Account;
}

export interface EnrichedStockTrade extends StockTrade {
  account?: Account;
}
export interface EnrichedCryptoHolding extends CryptoHolding {
  account?: Account;
}
export interface EnrichedCryptoTrade extends CryptoTrade {
  account?: Account;
}
