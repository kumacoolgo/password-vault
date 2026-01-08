export type VaultItem = {
  id: string;
  category?: string;
  url: string;
  username?: string;
  password: string;
  createdAt?: string; // ISO
  validDays?: number; // days
  dueDate?: string;   // ISO
};
