"use client";

import { createContext } from "react";
import {
  CopilotChatView,
  type CopilotChatViewProps,
} from "@copilotkit/react-core/v2";

export const HistoryLoadingContext = createContext(false);

function HistoryAwareChatViewComponent({
  isConnecting = false,
  isRunning,
  onSubmitMessage,
  onSelectSuggestion,
  ...props
}: CopilotChatViewProps) {
  return (
    <HistoryLoadingContext.Provider value={isConnecting}>
      <CopilotChatView
        {...props}
        isConnecting={isConnecting}
        isRunning={!isConnecting && isRunning}
        onSubmitMessage={isConnecting ? undefined : onSubmitMessage}
        onSelectSuggestion={isConnecting ? undefined : onSelectSuggestion}
      />
    </HistoryLoadingContext.Provider>
  );
}

export const HistoryAwareChatView = Object.assign(
  HistoryAwareChatViewComponent,
  {
    ScrollView: CopilotChatView.ScrollView,
    ScrollToBottomButton: CopilotChatView.ScrollToBottomButton,
    Feather: CopilotChatView.Feather,
    WelcomeMessage: CopilotChatView.WelcomeMessage,
    WelcomeScreen: CopilotChatView.WelcomeScreen,
  },
);
