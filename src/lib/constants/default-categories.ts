export interface DefaultCategory {
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & Drinks', type: 'expense', icon: 'Utensils', color: '#EF4444' },
  { name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#10B981' },
  { name: 'Transportation', type: 'expense', icon: 'Car', color: '#F97316' },
  { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#F59E0B' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'Receipt', color: '#EAB308' },
  { name: 'Housing', type: 'expense', icon: 'Home', color: '#84CC16' },
  { name: 'Entertainment', type: 'expense', icon: 'Film', color: '#14B8A6' },
  { name: 'Game', type: 'expense', icon: 'Gamepad2', color: '#8B5CF6' },
  { name: 'Travel', type: 'expense', icon: 'Plane', color: '#06B6D4' },
  { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#EC4899' },
  { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#3B82F6' },
  { name: 'Personal Care', type: 'expense', icon: 'Sparkles', color: '#F43F5E' },
  { name: 'Giving', type: 'expense', icon: 'Heart', color: '#E11D48' },
  { name: 'Transfer', type: 'expense', icon: 'Send', color: '#6366F1' },
  { name: 'Investment', type: 'expense', icon: 'TrendingUp', color: '#0284C7' },
  { name: 'Discrepancy', type: 'expense', icon: 'Scale', color: '#64748B' },
  { name: 'Family & Kids', type: 'expense', icon: 'Users', color: '#6366F1' },
  { name: 'Other Expense', type: 'expense', icon: 'MoreHorizontal', color: '#64748B' },
]

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', type: 'income', icon: 'Banknote', color: '#10B981' },
  { name: 'Bunga Bank', type: 'income', icon: 'Landmark', color: '#0D9488' },
  { name: 'Reimbursement', type: 'income', icon: 'HandCoins', color: '#06B6D4' },
  { name: 'Investment', type: 'income', icon: 'TrendingUp', color: '#0284C7' },
  { name: 'Freelance & Side Gig', type: 'income', icon: 'Briefcase', color: '#059669' },
  { name: 'Business & Sales', type: 'income', icon: 'TrendingUp', color: '#0D9488' },
  { name: 'Investments & Dividends', type: 'income', icon: 'PieChart', color: '#0284C7' },
  { name: 'Gifts & Grants', type: 'income', icon: 'Gift', color: '#EC4899' },
  { name: 'Other Income', type: 'income', icon: 'PlusCircle', color: '#64748B' },
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
