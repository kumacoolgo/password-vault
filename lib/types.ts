export type VaultItem = {
  id: string;
  category?: string;
  url: string;
  username?: string;
  password: string;
  createdAt?: string;
  validDays?: number;
  dueDate?: string;
};