import apiClient from "./axiosClient";

export type ConversationPaginationParams = {
  PageNumber?: number;
  PageSize?: number;
};

const unwrapResponseData = (response: any) =>
  response?.data?.data ?? response?.data;

const conversationApi = {
  getConversations: (
    params?: ConversationPaginationParams,
  ) =>
    apiClient
      .get("/conversations", { params })
      .then(unwrapResponseData),

  getConversationById: (conversationId: string) =>
    apiClient
      .get(`/conversations/${conversationId}`)
      .then(unwrapResponseData),

  getConversationMessages: (
    conversationId: string,
    params?: ConversationPaginationParams,
  ) =>
    apiClient
      .get(`/conversations/${conversationId}/messages`, {
        params,
      })
      .then(unwrapResponseData),

  getConversationNegotiations: (
    conversationId: string,
    params?: ConversationPaginationParams,
  ) =>
    apiClient
      .get(`/conversations/${conversationId}/negotiations`, {
        params,
      })
      .then(unwrapResponseData),

  markConversationAsRead: (conversationId: string) =>
    apiClient
      .patch(`/conversations/${conversationId}/read`)
      .then(unwrapResponseData),
};

export default conversationApi;
