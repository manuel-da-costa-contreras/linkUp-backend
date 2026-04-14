export interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'paid' | 'cancelled';
  total: number;
  createdAt: string;
}

export interface OrderCreateInput {
  userId: string;
  status?: 'pending' | 'paid' | 'cancelled';
  total: number;
}

export interface OrderUpdateInput {
  userId?: string;
  status?: 'pending' | 'paid' | 'cancelled';
  total?: number;
}
