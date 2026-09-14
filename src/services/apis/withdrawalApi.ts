import apiClient from "./axiosClient";

export type WithdrawalStatus =
  | "Pending"
  | "Approved"
  | "Processing"
  | "Completed"
  | "Rejected"
  | "Failed";

export type WalletTransactionStatus =
  | "Pending"
  | "Completed"
  | "Failed"
  | "Cancelled";

export type WithdrawalTransactionType =
  | "Withdrawal_Lock"
  | "Withdrawal_Success"
  | "Withdrawal_Revert";

export type BankVerificationStatus =
  | "Unverified"
  | "Pending"
  | "Verified"
  | "Rejected";

export type WithdrawalListItem = {
  withdrawalId: string;
  amount: number;
  status: WithdrawalStatus | null;
  bankName: string | null;
  maskedAccountNumber: string | null;
  requestedAt: string | null;
  processedAt: string | null;
  rejectReason: string | null;
};

export type WithdrawalBankAccount = {
  userBankId: string;
  bankCode: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  verifyStatus: BankVerificationStatus | null;
};

export type WithdrawalFinancialEvent = {
  walletTransactionId: string;
  transactionType: WithdrawalTransactionType | null;
  status: WalletTransactionStatus | null;
  amount: number;
  createdAt: string;
};

export type WithdrawalDetail = {
  withdrawalId: string;
  amount: number;
  status: WithdrawalStatus | null;
  bankAccount: WithdrawalBankAccount;
  requestedAt: string | null;
  processedAt: string | null;
  rejectReason: string | null;
  financialEvents: WithdrawalFinancialEvent[];
};

export type WithdrawalSearchParams = {
  PageNumber: number;
  PageSize: number;
  Status?: WithdrawalStatus;
  FromDate?: string;
  ToDate?: string;
};

export type WithdrawalPage = {
  items: WithdrawalListItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
};

export type ApiResult<T> = {
  isSuccess?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export const getMyWithdrawals = (params: WithdrawalSearchParams) =>
  apiClient
    .get<ApiResult<WithdrawalPage> | WithdrawalPage>("/wallet/withdrawals", {
      params,
    })
    .then((response) => response.data);

export const getMyWithdrawalDetail = (withdrawalId: string) =>
  apiClient
    .get<ApiResult<WithdrawalDetail> | WithdrawalDetail>(
      `/wallet/withdrawals/${encodeURIComponent(withdrawalId)}`,
    )
    .then((response) => response.data);
