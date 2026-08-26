export interface DefaultCategory {
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & Drinks', type: 'expense', icon: 'Utensils', color: '#EF4444' },
  { name: 'Transportation', type: 'expense', icon: 'Car', color: '#F97316' },
  { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#F59E0B' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'Receipt', color: '#EAB308' },
  { name: 'Housing', type: 'expense', icon: 'Home', color: '#84CC16' },
  { name: 'Entertainment', type: 'expense', icon: 'Film', color: '#10B981' },
  { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#06B6D4' },
  { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#3B82F6' },
  { name: 'Personal Care', type: 'expense', icon: 'Sparkles', color: '#F43F5E' },
  { name: 'Family & Kids', type: 'expense', icon: 'Users', color: '#6366F1' },
  { name: 'Other Expense', type: 'expense', icon: 'MoreHorizontal', color: '#64748B' },
]

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', type: 'income', icon: 'Banknote', color: '#10B981' },
  { name: 'Freelance & Side Gig', type: 'income', icon: 'Briefcase', color: '#059669' },
  { name: 'Business & Sales', type: 'income', icon: 'TrendingUp', color: '#0D9488' },
  { name: 'Investments & Dividends', type: 'income', icon: 'PieChart', color: '#0284C7' },
  { name: 'Gifts & Grants', type: 'income', icon: 'Gift', color: '#EC4899' },
  { name: 'Other Income', type: 'income', icon: 'PlusCircle', color: '#64748B' },
]

export const AVAILABLE_ICONS = [
  // Food & Drinks
  'Utensils',
  'Coffee',
  'Pizza',
  'CupSoda',
  'Wine',
  'Apple',
  'Cake',
  
  // Transport & Travel
  'Car',
  'Fuel',
  'Bus',
  'Plane',
  'Bike',
  'Train',
  'MapPin',
  'Navigation',
  
  // Shopping & Lifestyle
  'ShoppingBag',
  'ShoppingCart',
  'Shirt',
  'Gift',
  'Package',
  'Tag',
  'Sparkles',
  'Watch',
  'Smile',
  
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
  
  // Health & Personal Care
  'HeartPulse',
  'Stethoscope',
  'Pill',
  'Activity',
  'Dumbbell',
  'Scissors',
  
  // Education & Work
  'GraduationCap',
  'BookOpen',
  'Briefcase',
  'Laptop',
  'Folder',
  'FileText',
  'Award',
  
  // Finance & Money
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
  
  // Family & Social
  'Users',
  'Baby',
  'Dog',
  'Cat',
  'Heart',
  
  // Entertainment & Tech
  'Film',
  'Music',
  'Gamepad2',
  'Camera',
  'Headphones',
  'Ticket',
  
  // Maintenance & Misc
  'Wrench',
  'Hammer',
  'Carrot',
  'HelpCircle',
  'MoreHorizontal',
]
