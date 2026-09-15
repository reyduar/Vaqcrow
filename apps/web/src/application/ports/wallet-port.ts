export interface WalletAccount {
  readonly publicKey: string;
}

export interface WalletPort {
  isAvailable(): Promise<boolean>;
  connect(): Promise<WalletAccount>;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}
