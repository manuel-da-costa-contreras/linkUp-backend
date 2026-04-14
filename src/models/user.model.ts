export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface UserCreateInput {
  email: string;
  name: string;
  role?: 'admin' | 'user';
}

export interface UserUpdateInput {
  email?: string;
  name?: string;
  role?: 'admin' | 'user';
}
