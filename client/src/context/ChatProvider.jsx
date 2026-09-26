import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";

export const ChatContext = createContext();
const ENDPOINT = "http://localhost:7000";

export const ChatProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notification, setNotification] = useState([]);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme ? savedTheme : "dark";
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Strictly use sessionStorage so each browser tab has its own independent user
  useEffect(() => {
    const rawUserInfo = sessionStorage.getItem("userInfo");

    const isPublicRoute =
      location.pathname === "/" ||
      location.pathname.startsWith("/reset-password") ||
      location.pathname === "/auth";

    if (
      rawUserInfo &&
      rawUserInfo !== "undefined" &&
      rawUserInfo !== "null"
    ) {
      try {
        const parsedUser = JSON.parse(rawUserInfo);
        setUser(parsedUser);
      } catch (err) {
        console.error(
          "Corrupt user data in sessionStorage, clearing:",
          err
        );

        sessionStorage.removeItem("userInfo");
        setUser(null);

        if (!isPublicRoute) {
          navigate("/");
        }
      }
    } else {
      setUser(null);

      if (!isPublicRoute) {
        navigate("/");
      }
    }
  }, [navigate, location.pathname]);

  // Connect socket per tab user
  useEffect(() => {
    const currentUserId = user?._id || user?.id;

    if (!currentUserId) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setSocketConnected(false);
      }

      return;
    }

    const newSocket = io(ENDPOINT, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.emit("setup", user);

    newSocket.on("connected", () => {
      setSocketConnected(true);
    });

    newSocket.on("get online users", (users) => {
      setOnlineUsers(users);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id, user?.id]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (newMessage) => {
      const currentUser = userRef.current;
      const currentUserId = (
        currentUser?._id || currentUser?.id
      )?.toString();

      const activeChat = selectedChatRef.current;
      const activeChatId = (
        activeChat?._id || activeChat
      )?.toString();

      const incomingChatId = (
        newMessage.chat?._id || newMessage.chat
      )?.toString();

      if (!incomingChatId) return;

      const senderId = (
        newMessage.sender?._id ||
        newMessage.sender?.id ||
        newMessage.sender
      )?.toString();

      const isMyMessage = senderId === currentUserId;

      const isCurrentChatActive =
        activeChatId && activeChatId === incomingChatId;

      setChats((prevChats) => {
        const chatsList = prevChats || [];

        let targetChat = chatsList.find(
          (c) => c._id?.toString() === incomingChatId
        );

        if (
          !targetChat &&
          typeof newMessage.chat === "object" &&
          newMessage.chat !== null
        ) {
          targetChat = {
            ...newMessage.chat,
            unreadCount: 0,
          };
        }

        if (!targetChat) return chatsList;

        let currentCount = Number(targetChat.unreadCount) || 0;

        // FIXED: Only increment unread count if it's not our message and chat is not active
        if (!isMyMessage && !isCurrentChatActive) {
          currentCount += 1;
        } else if (isCurrentChatActive) {
          currentCount = 0;
        }

        const updatedChat = {
          ...targetChat,
          latestMessage: newMessage,
          unreadCount: currentCount,
          updatedAt: new Date().toISOString(),
        };

        const otherChats = chatsList.filter(
          (c) => c._id?.toString() !== incomingChatId
        );

        return [updatedChat, ...otherChats];
      });

      if (!isMyMessage && !isCurrentChatActive) {
        setNotification((prev) => [newMessage, ...(prev || [])]);
      }
    };

    // ---------------------------------------------------------
    // MESSAGE DELETED
    // ---------------------------------------------------------
    const handleMessageDeleted = ({
      messageId,
      chatId,
      message,
    }) => {
      const targetChatId = (
        chatId ||
        message?.chat?._id ||
        message?.chat
      )?.toString();

      if (!targetChatId) return;

      const deletedMessage = message || {
        _id: messageId,
        isDeleted: true,
        content: "🚫 This message was deleted",
      };

      setChats((prevChats) => {
        if (!prevChats) return prevChats;

        return prevChats.map((chat) => {
          if (chat._id?.toString() !== targetChatId) {
            return chat;
          }

          return {
            ...chat,
            latestMessage: {
              ...(chat.latestMessage || {}),
              ...deletedMessage,
              _id: messageId || deletedMessage._id,
              isDeleted: true,
              content: "🚫 This message was deleted",
            },
          };
        });
      });
    };

    socket.on("message received", handleMessageReceived);
    socket.on("message deleted", handleMessageDeleted);

    return () => {
      socket.off("message received", handleMessageReceived);
      socket.off("message deleted", handleMessageDeleted);
    };
  }, [socket]);

  return (
    <ChatContext.Provider
      value={{
        user,
        setUser,
        selectedChat,
        setSelectedChat,
        chats,
        setChats,
        onlineUsers,
        setOnlineUsers,
        notification,
        setNotification,
        socket,
        socketConnected,
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatState = () => {
  return useContext(ChatContext);
};

export default ChatProvider;