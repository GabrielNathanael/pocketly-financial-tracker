export interface DefaultCategory {
  name: string
  type: 'income' | 'expense'
  icon: string
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & Drinks', type: 'expense', icon: 'Utensils' },
  { name: 'Groceries', type: 'expense', icon: 'ShoppingCart' },
  { name: 'Transportation', type: 'expense', icon: 'Car' },
  { name: 'Shopping', type: 'expense', icon: 'ShoppingBag' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'Receipt' },
  { name: 'Housing', type: 'expense', icon: 'Home' },
  { name: 'Entertainment', type: 'expense', icon: 'Film' },
  { name: 'Game', type: 'expense', icon: 'Gamepad2' },
  { name: 'Travel', type: 'expense', icon: 'Plane' },
  { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse' },
  { name: 'Education', type: 'expense', icon: 'GraduationCap' },
  { name: 'Personal Care', type: 'expense', icon: 'Sparkles' },
  { name: 'Giving', type: 'expense', icon: 'Heart' },
  { name: 'Transfer Fee', type: 'expense', icon: 'Send' },
  { name: 'Investment', type: 'expense', icon: 'TrendingUp' },
  { name: 'Discrepancy', type: 'expense', icon: 'Scale' },
  { name: 'Loan & Debt', type: 'expense', icon: 'HandCoins' },
  { name: 'Savings', type: 'expense', icon: 'PiggyBank' },
  { name: 'Family & Kids', type: 'expense', icon: 'Users' },
  { name: 'Other Expense', type: 'expense', icon: 'MoreHorizontal' },
]

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', type: 'income', icon: 'Banknote' },
  { name: 'Bunga Bank', type: 'income', icon: 'Landmark' },
  { name: 'Reimbursement', type: 'income', icon: 'HandCoins' },
  { name: 'Investment', type: 'income', icon: 'TrendingUp' },
  { name: 'Freelance & Side Gig', type: 'income', icon: 'Briefcase' },
  { name: 'Business & Sales', type: 'income', icon: 'TrendingUp' },
  { name: 'Investments & Dividends', type: 'income', icon: 'PieChart' },
  { name: 'Gifts & Grants', type: 'income', icon: 'Gift' },
  { name: 'Discrepancy', type: 'income', icon: 'Scale' },
  { name: 'Loan & Debt', type: 'income', icon: 'HandCoins' },
  { name: 'Savings', type: 'income', icon: 'PiggyBank' },
  { name: 'Other Income', type: 'income', icon: 'PlusCircle' },
]

export const AVAILABLE_ICONS = [
  // Food & Drinks & Groceries
  'Utensils',
  'Coffee',
  'Pizza',
  'CupSoda',
  'Wine',
  'Apple',
  'Cake',
  'Carrot',
  'Beef',
  'Fish',
  'Egg',
  
  // Shopping & Groceries
  'ShoppingCart',
  'ShoppingBag',
  'Store',
  'Shirt',
  'Tag',
  'Package',
  'Sparkles',
  'Watch',
  'Smile',
  
  // Transport & Travel
  'Car',
  'Fuel',
  'Bus',
  'Plane',
  'Bike',
  'Train',
  'MapPin',
  'Navigation',
  'Compass',
  'Luggage',
  
  // Bills, Housing & Utilities
  'Home',
  'Receipt',
  'Zap',
  'Wifi',
  'Droplet',
  'Smartphone',
  'Tv',
  'Flame',
  'Key',
  'Building',
  'Bed',
  'WashingMachine',
  
  // Health & Personal Care
  'HeartPulse',
  'Stethoscope',
  'Pill',
  'Activity',
  'Dumbbell',
  'Scissors',
  'Heart',
  'Syringe',
  
  // Education & Work
  'GraduationCap',
  'BookOpen',
  'Briefcase',
  'Laptop',
  'Folder',
  'FileText',
  'Award',
  'PenTool',
  
  // Finance, Giving & Transfer
  'Banknote',
  'Wallet',
  'CreditCard',
  'Coins',
  'TrendingUp',
  'TrendingDown',
  'PiggyBank',
  'Landmark',
  'DollarSign',
  'Scale',
  'Shield',
  'HandCoins',
  'Send',
  'ArrowLeftRight',
  'RefreshCw',
  
  // Family, Social & Religious
  'Users',
  'Baby',
  'Dog',
  'Cat',
  'HeartHandshake',
  'Gift',
  'Church',
  
  // Entertainment & Gaming
  'Gamepad2',
  'Film',
  'Music',
  'Camera',
  'Headphones',
  'Ticket',
  'Dices',
  'Tv2',
  
  // Maintenance & Misc
  'Wrench',
  'Hammer',
  'Sliders',
  'HelpCircle',
  'MoreHorizontal',
]
