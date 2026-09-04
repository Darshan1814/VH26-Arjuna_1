"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, RAGResponse, RAGQueryRequest } from "@/types";
import { queryRAG } from "@/lib/api";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messageIdCounter = useRef(0);

  const generateId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Add loading placeholder for assistant
      const loadingMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setIsLoading(true);

      try {
        const request: RAGQueryRequest = {
          query: content.trim(),
          machine_id: selectedMachineId,
          conversation_id: conversationId,
        };

        const response = await queryRAG(request);

        // Update conversation ID if returned
        if (response.conversation_id) {
          setConversationId(response.conversation_id);
        }

        // Replace loading message with actual response
        const assistantMessage: ChatMessage = {
          id: loadingMessage.id,
          role: "assistant",
          content: response.answer,
          timestamp: new Date(),
          ragResponse: response,
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id ? assistantMessage : msg
          )
        );
      } catch (error) {
        // Replace loading message with error
        const errorMessage: ChatMessage = {
          id: loadingMessage.id,
          role: "assistant",
          content:
            "Sorry, I encountered an error processing your request. Please try again.",
          timestamp: new Date(),
          isError: true,
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id ? errorMessage : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, selectedMachineId, conversationId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    selectedMachineId,
    setSelectedMachineId,
    conversationId,
  };
}
