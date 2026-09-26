import { useContext } from "react";
import { ChatContext } from "./ChatProvider";

export const useChatState = () => useContext(ChatContext);