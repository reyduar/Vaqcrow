export interface LedgerPort {
  getBalance(accountId: string): Promise<unknown>;
}
