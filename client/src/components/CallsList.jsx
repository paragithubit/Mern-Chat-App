import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";
import UpdateGroupChatModal from "./UpdateGroupChatModal";
import MediaDrawer from "./MediaDrawer";
import CallModal from "./CallModal";
import CallsList from "./CallsList";
import ChatInfoDrawer from "./ChatInfoDrawer";
import ForwardMessageModal from "./ForwardMessageModal";
import SaveContactModal from "./SaveContactModal";
import { encryptText, decryptText, importKey } from "../utils/crypto";

const CLOUDINARY_CLOUD_NAME = "qhyxgx1b";
const CLOUDINARY_PRESET = "chat_upload";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const AVAILABLE_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const PRESET_WALLPAPERS = [
  { name: "WhatsApp Dark", value: "#0b141a" },
  { name: "Default Subtle", value: "default" },
  { name: "Midnight Onyx", value: "#090d16" },
  { name: "Emerald Minimal", value: "#071a14" },
  { name: "Graphite Noir", value: "#16181d" },
  { name: "Warm Alabaster", value: "#f4f1ea" },
  { name: "Cool Frost", value: "#e8eff5" },
];

const renderTextWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 dark:text-cyan-300 hover:underline break-all font-medium inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {part} <span className="text-xs">↗</span>
        </a>
      );
    }
    return part;
  });
};

const formatDateDivider = (dateString) => {
  const messageDate = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return "Today";
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return messageDate.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
};

const ChatBox = ({ activeTab }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
  const [chatInfoOpen, setChatInfoOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [savedContactsMap, setSavedContactsMap] = useState(new Map());

  // WhatsApp-style Reply, Edit & Forward State
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

  // Multi-Select Message State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Highlight flash state for replied message jump
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Poll Voter Breakdown Modal State
  const [pollVoterModalData, setPollVoterModalData] = useState(null);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [savedContactsList, setSavedContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Save Contact Modal state for incoming shared contact cards
  const [selectedContactCard, setSelectedContactCard] = useState(null);
  const [isSaveContactModalOpen, setIsSaveContactModalOpen] = useState(false);

  const [activeContextMenuMessageId, setActiveContextMenuMessageId] =
    useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [deleteModalMessage, setDeleteModalMessage] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [wallpaperModalOpen, setWallpaperModalOpen] = useState(false);

  const {
    user,
    setUser,
    selectedChat,
    setSelectedChat,
    onlineUsers,
    setNotification,
    chats,
    setChats,
    socket,
    theme,
  } = useChatState();

  const isDark = theme === "dark";

  // Bind the wallpaper storage key to the logged-in user's ID
  const currentUserId = user?._id || user?.id;
  const wallpaperKey = currentUserId ? `chat_wallpaper_user_${currentUserId}` : "chat_wallpaper_default";

  const [wallpaper, setWallpaper] = useState(() => {
    return localStorage.getItem(wallpaperKey) || "default";
  });

  useEffect(() => {
    if (currentUserId) {
      const userKey = `chat_wallpaper_user_${currentUserId}`;
      setWallpaper(localStorage.getItem(userKey) || "default");
    }
  }, [currentUserId]);

  const wallpaperInputRef = useRef(null);
  const menuRef = useRef(null);
  const contextMenuRef = useRef(null);

  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const attachmentMenuRef = useRef(null);
  const galleryInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState("video");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);

  // Fetch saved contacts map
  useEffect(() => {
    const fetchContactsMap = async () => {
      if (!user?.token) return;
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get(`${API_URL}/contacts`, config);
        const map = new Map();
        (data || []).forEach((c) => {
          const uId = (c.contactUser?._id || c.contactUser)?.toString();
          const phone = (c.phoneNumber || c.contactUser?.phone || "").replace(/\D/g, "").slice(-10);
          if (uId) map.set(uId, c.savedName);
          if (phone) map.set(phone, c.savedName);
        });
        setSavedContactsMap(map);
      } catch (err) {
        console.error("Failed to load contacts map in ChatBox", err);
      }
    };
    fetchContactsMap();
  }, [user]);

  // Helper to resolve contact name or phone number for any user ID
  const resolveUserName = (userObj) => {
    if (!userObj) return "Unknown User";
    const uId = (userObj._id || userObj.id || userObj)?.toString();
    const uPhone = (userObj.phone || "").replace(/\D/g, "").slice(-10);
    const uName = userObj.name;

    if (uId && savedContactsMap.has(uId)) {
      return savedContactsMap.get(uId);
    }
    if (uPhone && savedContactsMap.has(uPhone)) {
      return savedContactsMap.get(uPhone);
    }
    if (uPhone) {
      return `+91 ${uPhone}`;
    }
    return uName || "User";
  };

  const myId = (user?._id || user?.id)?.toString();

  const isSelfChat =
    selectedChat &&
    !selectedChat.isGroupChat &&
    selectedChat.users &&
    selectedChat.users.length === 2 &&
    selectedChat.users[0] &&
    selectedChat.users[1] &&
    (selectedChat.users[0]?._id || selectedChat.users[0])?.toString() ===
      (selectedChat.users[1]?._id || selectedChat.users[1])?.toString() &&
    (selectedChat.users[0]?._id || selectedChat.users[0])?.toString() === myId;

  const getPartnerUser = () => {
    if (!selectedChat || selectedChat.isGroupChat || !user || isSelfChat)
      return null;
    return selectedChat.users?.find(
      (u) => (u._id || u?.id || u)?.toString() !== myId,
    );
  };

  const partner = getPartnerUser();

  const getPartnerDisplayName = () => {
    if (isSelfChat) return "You (You)";
    if (!partner) return "Chat";
    const pId = partner._id?.toString();
    const pPhone = (partner.phone || "").replace(/\D/g, "").slice(-10);

    if ((pId && savedContactsMap.has(pId)) || (pPhone && savedContactsMap.has(pPhone))) {
      return pId && savedContactsMap.has(pId) ? savedContactsMap.get(pId) : savedContactsMap.get(pPhone);
    }
    return partner.phone ? `+91 ${partner.phone}` : partner.name || "Chat";
  };

  const partnerDisplayName = getPartnerDisplayName();

  const updateSidebarChatTop = (updatedMsg) => {
    if (!selectedChat) return;
    const activeId = selectedChat._id?.toString();

    setChats((prevChats) => {
      if (!prevChats) return prevChats;
      const targetIndex = prevChats.findIndex(
        (c) => c._id?.toString() === activeId
      );
      if (targetIndex === -1) return prevChats;

      const targetChat = prevChats[targetIndex];
      const updatedChat = {
        ...targetChat,
        latestMessage: updatedMsg,
        updatedAt: new Date().toISOString(),
      };

      const remainingChats = prevChats.filter(
        (c) => c._id?.toString() !== activeId
      );
      return [updatedChat, ...remainingChats];
    });
  };

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    setSearchOpen(false);
    setSearchQuery("");
    setMenuOpen(false);
    setAttachmentMenuOpen(false);
    setActiveContextMenuMessageId(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setForwardingMessage(null);
    setHighlightedMessageId(null);
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  }, [selectedChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!searchOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, searchOpen]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(e.target)
      ) {
        setAttachmentMenuOpen(false);
      }
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target)
      ) {
        setActiveContextMenuMessageId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return `last seen today at ${timeStr}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return `last seen yesterday at ${timeStr}`;

    return `last seen on ${date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
    })} at ${timeStr}`;
  };

  const handleDirectDownload = (fileUrl, fileName) => {
    if (!fileUrl) return;

    const proxyDownloadUrl = `${API_URL}/message/download?url=${encodeURIComponent(
      fileUrl,
    )}&filename=${encodeURIComponent(fileName || "download")}`;

    const link = document.createElement("a");
    link.href = proxyDownloadUrl;
    link.setAttribute("download", fileName || "download");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const markMessagesRead = async (chatId) => {
    if (!chatId || !user) return;
    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      await axios.put(
        `${API_URL}/message/read/${chatId}`,
        {},
        config,
      );
      if (socket) {
        socket.emit("mark as read", {
          chatId: chatId.toString(),
          userId: (user._id || user.id)?.toString(),
        });
      }
    } catch (err) {
      console.error("Failed to mark messages as read", err);
    }
  };

  const decryptMessagesList = async (msgs) => {
    const privateKeyJwk = localStorage.getItem("chat_private_key");
    if (!privateKeyJwk) return msgs;

    try {
      const privateKey = await window.crypto.subtle.importKey(
        "jwk",
        JSON.parse(privateKeyJwk),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"],
      );

      const processed = await Promise.all(
        msgs.map(async (m) => {
          if (m.isDeleted) {
            return { ...m, content: "🚫 This message was deleted" };
          }
          if (m.content && !m.fileType) {
            const decrypted = await decryptText(m.content, privateKey);
            return { ...m, content: decrypted };
          }
          return m;
        }),
      );
      return processed;
    } catch (e) {
      console.error("Batch decryption failure:", e);
      return msgs;
    }
  };

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.get(
        `${API_URL}/message/${selectedChat._id}`,
        config,
      );

      const decryptedData = await decryptMessagesList(data);
      setMessages(decryptedData);

      if (socket) {
        socket.emit("join chat", selectedChat._id.toString());
      }

      markMessagesRead(selectedChat._id);
    } catch (error) {
      console.error("Failed to load messages", error);
    }
  };

  useEffect(() => {
    fetchMessages();
    setIsTyping(false);
  }, [selectedChat, socket]);

  useEffect(() => {
    if (!socket) return;

    const messageHandler = async (newMessageReceived) => {
      const currentActive = selectedChatRef.current;
      const activeChatId = (currentActive?._id || currentActive)?.toString();
      const incomingChatId = (
        newMessageReceived.chat?._id || newMessageReceived.chat
      )?.toString();

      try {
        const audio = new Audio("/notification.mp3");
        audio.play().catch(() => {});
      } catch (e) {}

      let processedMsg = newMessageReceived;
      if (processedMsg.isDeleted) {
        processedMsg = { ...processedMsg, content: "🚫 This message was deleted" };
      } else if (
        processedMsg.content &&
        !processedMsg.fileType
      ) {
        const privateKeyJwk = localStorage.getItem("chat_private_key");
        if (privateKeyJwk) {
          try {
            const privKey = await window.crypto.subtle.importKey(
              "jwk",
              JSON.parse(privateKeyJwk),
              { name: "RSA-OAEP", hash: "SHA-256" },
              true,
              ["decrypt"],
            );
            const decryptedText = await decryptText(
              processedMsg.content,
              privKey,
            );
            processedMsg = { ...processedMsg, content: decryptedText };
          } catch (err) {
            console.error("Live socket decryption error:", err);
          }
        }
      }

      if (activeChatId && activeChatId === incomingChatId) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === processedMsg._id)) {
            return prev;
          }
          return [...prev, processedMsg];
        });
        markMessagesRead(incomingChatId);
      } else {
        setNotification((prev) => {
          if (!prev?.some((n) => n._id === processedMsg._id)) {
            return [processedMsg, ...(prev || [])];
          }
          return prev;
        });
      }
    };

    const messageEditedHandler = (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      );
    };

    const typingHandlerEvent = () => setIsTyping(true);
    const stopTypingHandlerEvent = () => setIsTyping(false);

    const readReceiptHandler = ({ chatId, userId }) => {
      const activeChatId = selectedChatRef.current?._id?.toString();
      if (activeChatId === chatId?.toString()) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            const currentReadBy = (msg.readBy || []).map((id) =>
              (id?._id || id?.id || id)?.toString(),
            );
            if (!currentReadBy.includes(userId.toString())) {
              return { ...msg, readBy: [...(msg.readBy || []), userId] };
            }
            return msg;
          }),
        );
      }
    };

    const messageDeletedHandler = ({ messageId, chatId, message }) => {
      const activeChatId = selectedChatRef.current?._id?.toString();
      const targetChatId = (chatId || message?.chat?._id || message?.chat)?.toString();

      const deletedPlaceholder = message || {
        _id: messageId,
        isDeleted: true,
        content: "🚫 This message was deleted",
        fileUrl: "",
        fileType: "",
        poll: { question: "", options: [] },
        reactions: [],
      };

      if (activeChatId && targetChatId === activeChatId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, ...deletedPlaceholder } : msg,
          ),
        );
      }

      setChats((prevChats) => {
        if (!prevChats) return prevChats;
        return prevChats.map((c) => {
          if (c._id?.toString() === targetChatId) {
            if (c.latestMessage?._id?.toString() === messageId?.toString()) {
              return {
                ...c,
                latestMessage: deletedPlaceholder,
              };
            }
          }
          return c;
        });
      });
    };

    const chatClearedHandler = ({ chatId }) => {
      const activeChatId = selectedChatRef.current?._id?.toString();
      if (activeChatId === chatId?.toString()) {
        setMessages([]);
      }
    };

    const messageReactedHandler = (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      );
    };

    const pollUpdatedHandler = (updatedMessage) => {
      const activeChatId = selectedChatRef.current?._id?.toString();
      const incomingChatId = (updatedMessage.chat?._id || updatedMessage.chat)?.toString();
      if (activeChatId && activeChatId === incomingChatId) {
        setMessages((prev) =>
          prev.map((msg) => (msg._id === updatedMessage._id ? updatedMessage : msg))
        );
      }
    };

    const userOfflineHandler = ({ userId, lastSeen }) => {
      setSelectedChat((prevChat) => {
        if (!prevChat || prevChat.isGroupChat) return prevChat;
        const updatedUsers = prevChat.users?.map((u) => {
          const uId = (u._id || u?.id || u)?.toString();
          if (uId === userId?.toString()) {
            return { ...u, lastSeen };
          }
          return u;
        });
        return { ...prevChat, users: updatedUsers };
      });
    };

    const chatAddedHandler = (newChat) => {
      setChats((prevChats) => {
        if (!prevChats) return [newChat];
        if (prevChats.some((c) => c._id === newChat._id)) return prevChats;
        return [newChat, ...prevChats];
      });
    };

    const chatRemovedHandler = ({ chatId }) => {
      setChats((prevChats) =>
        prevChats ? prevChats.filter((c) => c._id !== chatId) : [],
      );
      const currentActive = selectedChatRef.current;
      if (
        currentActive &&
        currentActive._id?.toString() === chatId?.toString()
      ) {
        setSelectedChat(null);
        toast.error("You were removed from this group");
      }
      if (socket) {
        socket.emit("leave chat room", chatId);
      }
    };

    socket.on("message received", messageHandler);
    socket.on("message edited", messageEditedHandler);
    socket.on("typing", typingHandlerEvent);
    socket.on("stop typing", stopTypingHandlerEvent);
    socket.on("messages read", readReceiptHandler);
    socket.on("message deleted", messageDeletedHandler);
    socket.on("chat cleared", chatClearedHandler);
    socket.on("message reacted", messageReactedHandler);
    socket.on("poll updated", pollUpdatedHandler);
    socket.on("user offline", userOfflineHandler);
    socket.on("chat added", chatAddedHandler);
    socket.on("chat removed", chatRemovedHandler);

    return () => {
      socket.off("message received", messageHandler);
      socket.off("message edited", messageEditedHandler);
      socket.off("typing", typingHandlerEvent);
      socket.off("stop typing", stopTypingHandlerEvent);
      socket.off("messages read", readReceiptHandler);
      socket.off("message deleted", messageDeletedHandler);
      socket.off("chat cleared", chatClearedHandler);
      socket.off("message reacted", messageReactedHandler);
      socket.off("poll updated", pollUpdatedHandler);
      socket.off("user offline", userOfflineHandler);
      socket.off("chat added", chatAddedHandler);
      socket.off("chat removed", chatRemovedHandler);
    };
  }, [socket, setSelectedChat, setChats, setNotification]);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!socket || !selectedChat) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id.toString());
    }

    const lastTypingTime = new Date().getTime();
    const timerLength = 2500;

    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime;

      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id.toString());
        setTyping(false);
      }
    }, timerLength);
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        formData,
      );
      return res.data.secure_url;
    } catch (error) {
      console.error(
        "Cloudinary Upload Error Details:",
        error.response?.data || error.message,
      );
      toast.error("File upload failed. Please check network settings.");
      throw error;
    }
  };

  const handleForwardMessage = async (targetChatId) => {
    if (!forwardingMessage) return;

    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const payload = {
        content: forwardingMessage.content || "",
        chatId: targetChatId,
        fileUrl: forwardingMessage.fileUrl || "",
        fileType: forwardingMessage.fileType || "",
        poll: forwardingMessage.poll || { question: "", options: [] },
      };

      await axios.post(
        `${API_URL}/message`,
        payload,
        config,
      );

      toast.success("Message forwarded!");
    } catch (err) {
      console.error("Failed to forward message:", err);
      toast.error("Failed to forward message.");
      throw err;
    }
  };

  const partnerId = (partner?._id || partner?.id)?.toString();
  const isPartnerOnline =
    partnerId && onlineUsers?.some((id) => id?.toString() === partnerId);

  const isUserBlocked = user?.blockedUsers?.includes(partnerId);

  const sendMessage = async (triggerEvent) => {
    if (
      (triggerEvent?.key === "Enter" ||
        triggerEvent?.type === "click" ||
        triggerEvent?.type === "instant") &&
      (newMessage.trim() || attachedFile) &&
      !uploading
    ) {
      if (socket && selectedChat) {
        socket.emit("stop typing", selectedChat._id.toString());
      }
      setTyping(false);

      if (editingMessage) {
        try {
          setUploading(true);
          const config = {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user.token}`,
            },
          };
          const { data } = await axios.put(
            `${API_URL}/message/edit/${editingMessage._id}`,
            { newContent: newMessage.trim() },
            config,
          );

          setMessages((prev) =>
            prev.map((msg) => (msg._id === data._id ? data : msg)),
          );

          setNewMessage("");
          setEditingMessage(null);
          toast.success("Message edited");
          setTimeout(() => inputRef.current?.focus(), 50);
        } catch (error) {
          console.error("Failed to edit message", error);
          toast.error(error.response?.data?.message || "Could not edit message");
        } finally {
          setUploading(false);
        }
        return;
      }

      let uploadedUrl = "";
      let resolvedFileType = "";

      try {
        setUploading(true);

        if (attachedFile) {
          const isImage = attachedFile.type.startsWith("image/");
          const isVideo = attachedFile.type.startsWith("video/");
          resolvedFileType = isImage ? "image" : isVideo ? "video" : "document";

          uploadedUrl = await uploadToCloudinary(attachedFile);
        }

        const rawText =
          newMessage.trim() || (attachedFile ? attachedFile.name : "");
        let finalContent = rawText;

        if (
          !attachedFile &&
          rawText &&
          !selectedChat.isGroupChat &&
          !isSelfChat
        ) {
          const partnerObj = getPartnerUser();
          if (partnerObj?.publicKey) {
            try {
              const recipientPubKey = await importKey(
                partnerObj.publicKey,
                "spki",
                ["encrypt"],
              );
              finalContent = await encryptText(rawText, recipientPubKey);
            } catch (cryptoErr) {
              console.error(
                "Encryption process failed, sending plaintext fallback:",
                cryptoErr,
              );
            }
          }
        }

        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        const payload = {
          content: finalContent,
          chatId: selectedChat._id,
          fileUrl: uploadedUrl,
          fileType: resolvedFileType,
          replyTo: replyingTo ? replyingTo._id : undefined,
        };

        setNewMessage("");
        setAttachedFile(null);
        setReplyingTo(null);

        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);

        const { data } = await axios.post(
          `${API_URL}/message`,
          payload,
          config,
        );

        const displayData = { ...data, content: rawText };

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === displayData._id)) {
            return prev;
          }
          return [...prev, displayData];
        });

        updateSidebarChatTop(displayData);
      } catch (error) {
        console.error("Failed to send message", error);
        toast.error(error.response?.data?.message || "Failed to send message");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSendLocation = () => {
    setAttachmentMenuOpen(false);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

        try {
          const config = {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user.token}`,
            },
          };
          const payload = {
            content: `${latitude},${longitude}`,
            chatId: selectedChat._id,
            fileUrl: mapsUrl,
            fileType: "location",
            replyTo: replyingTo ? replyingTo._id : undefined,
          };
          const { data } = await axios.post(
            `${API_URL}/message`,
            payload,
            config,
          );
          setReplyingTo(null);
          setTimeout(() => inputRef.current?.focus(), 50);
          setMessages((prev) => {
            if (prev.some((msg) => msg._id === data._id)) return prev;
            return [...prev, data];
          });
          updateSidebarChatTop(data);
          toast.success("Location shared!");
        } catch (err) {
          console.error("Failed to send location", err);
          toast.error(err.response?.data?.message || "Failed to send location");
        }
      },
      (error) => toast.error("Could not retrieve your location: " + error.message),
      { enableHighAccuracy: true },
    );
  };

  const fetchSavedContacts = async () => {
    try {
      setLoadingContacts(true);
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.get(
        `${API_URL}/contacts`,
        config,
      );
      setSavedContactsList(data);
    } catch (err) {
      console.error("Failed to fetch saved contacts", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSendContactCard = async (contactItem) => {
    setContactModalOpen(false);
    setAttachmentMenuOpen(false);

    const contactName = contactItem.savedName;
    const contactPhone =
      contactItem.phoneNumber || contactItem.contactUser?.phone || "No phone";
    const contactPic = contactItem.contactUser?.profilePicture || "";

    const contactCardContent = `👤 Contact Card\nName: ${contactName}\nPhone: ${contactPhone}`;

    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };
      const payload = {
        content: contactCardContent,
        chatId: selectedChat._id,
        fileUrl: contactPic,
        fileType: "contact",
        replyTo: replyingTo ? replyingTo._id : undefined,
      };

      const { data } = await axios.post(
        `${API_URL}/message`,
        payload,
        config,
      );

      setReplyingTo(null);
      setTimeout(() => inputRef.current?.focus(), 50);

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === data._id)) return prev;
        return [...prev, data];
      });
      updateSidebarChatTop(data);
      toast.success("Contact sent!");
    } catch (err) {
      console.error("Failed to send contact card", err);
      toast.error(err.response?.data?.message || "Failed to send contact card");
    }
  };

  const handleCreatePoll = async () => {
    if (
      !pollQuestion.trim() ||
      pollOptions.filter((o) => o.trim()).length < 2
    ) {
      toast.error("Please provide a poll question and at least 2 options.");
      return;
    }

    try {
      setUploading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const payload = {
        content: `📊 Poll: ${pollQuestion}`,
        chatId: selectedChat._id,
        fileType: "poll",
        replyTo: replyingTo ? replyingTo._id : undefined,
        poll: {
          question: pollQuestion.trim(),
          options: pollOptions
            .filter((o) => o.trim())
            .map((text) => ({ text: text.trim(), votes: [] })),
        },
      };

      const { data } = await axios.post(
        `${API_URL}/message`,
        payload,
        config,
      );

      setReplyingTo(null);
      setTimeout(() => inputRef.current?.focus(), 50);

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === data._id)) return prev;
        return [...prev, data];
      });
      updateSidebarChatTop(data);
      setPollModalOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setAttachmentMenuOpen(false);
      toast.success("Poll published!");
    } catch (err) {
      console.error("Failed to create poll", err);
      toast.error(err.response?.data?.message || "Could not create poll");
    } finally {
      setUploading(false);
    }
  };

  const handleVote = async (messageId, optionId) => {
    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/message/vote`,
        { messageId, optionId },
        config,
      );

      setMessages((prev) => prev.map((m) => (m._id === messageId ? data : m)));
    } catch (err) {
      console.error("Failed to vote", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Audio recording permission denied", err);
      toast.error("Microphone permission is required to record voice notes.");
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;

    clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: "audio/webm",
      });

      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingDuration(0);

      try {
        setUploading(true);
        const uploadedAudioUrl = await uploadToCloudinary(audioFile);

        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        const payload = {
          content: "",
          chatId: selectedChat._id,
          fileUrl: uploadedAudioUrl,
          fileType: "audio",
          replyTo: replyingTo ? replyingTo._id : undefined,
        };

        const { data } = await axios.post(
          `${API_URL}/message`,
          payload,
          config,
        );

        setReplyingTo(null);
        setTimeout(() => inputRef.current?.focus(), 50);

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === data._id)) return prev;
          return [...prev, data];
        });

        updateSidebarChatTop(data);
        toast.success("Voice note sent!");
      } catch (error) {
        console.error("Failed to upload/send voice message", error);
        toast.error(error.response?.data?.message || "Failed to send voice message");
      } finally {
        setUploading(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current.stream
      .getTracks()
      .forEach((track) => track.stop());
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const handleCopyMessage = (text, messageId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 1500);
    setActiveContextMenuMessageId(null);
    toast.success("Copied to clipboard!");
  };

  const executeDelete = async (deleteType) => {
    if (!deleteModalMessage) return;

    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        data: { deleteType },
      };

      await axios.delete(
        `${API_URL}/message/${deleteModalMessage._id}`,
        config,
      );

      if (deleteType === "forEveryone") {
        const deletedPlaceholder = {
          ...deleteModalMessage,
          isDeleted: true,
          content: "🚫 This message was deleted",
          fileUrl: "",
          fileType: "",
          poll: { question: "", options: [] },
          reactions: [],
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === deleteModalMessage._id ? deletedPlaceholder : msg,
          ),
        );

        setChats((prevChats) => {
          if (!prevChats) return prevChats;
          return prevChats.map((c) => {
            if (c._id?.toString() === selectedChat._id?.toString()) {
              if (c.latestMessage?._id?.toString() === deleteModalMessage._id?.toString()) {
                return {
                  ...c,
                  latestMessage: deletedPlaceholder,
                };
              }
            }
            return c;
          });
        });

        if (socket) {
          socket.emit("delete message", {
            messageId: deleteModalMessage._id,
            chatId: selectedChat._id.toString(),
            isForEveryone: true,
          });
        }
        toast.success("Message deleted for everyone");
      } else if (deleteType === "forMe") {
        const remainingMsgs = messages.filter(
          (msg) => msg._id !== deleteModalMessage._id,
        );
        setMessages(remainingMsgs);

        const newLatest = remainingMsgs[remainingMsgs.length - 1] || null;
        setChats((prevChats) => {
          if (!prevChats) return prevChats;
          return prevChats.map((c) => {
            if (c._id?.toString() === selectedChat._id?.toString()) {
              if (c.latestMessage?._id?.toString() === deleteModalMessage._id?.toString()) {
                return {
                  ...c,
                  latestMessage: newLatest,
                };
              }
            }
            return c;
          });
        });

        toast.success("Message deleted for you");
      }
    } catch (error) {
      console.error("Failed to delete message", error);
      toast.error(error.response?.data?.message || "Could not delete message");
    } finally {
      setDeleteModalMessage(null);
    }
  };

  const executeBulkDelete = async (deleteType) => {
    if (selectedMessageIds.length === 0) return;

    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      await axios.delete(`${API_URL}/message/bulk-delete`, {
        headers: config.headers,
        data: { messageIds: selectedMessageIds, deleteType },
      });

      if (deleteType === "forEveryone") {
        setMessages((prev) =>
          prev.map((msg) =>
            selectedMessageIds.includes(msg._id)
              ? { ...msg, isDeleted: true, content: "🚫 This message was deleted", fileUrl: "", fileType: "", poll: { question: "", options: [] }, reactions: [] }
              : msg
          )
        );
        toast.success(`${selectedMessageIds.length} messages deleted for everyone`);
      } else {
        const remainingMsgs = messages.filter(
          (msg) => !selectedMessageIds.includes(msg._id)
        );
        setMessages(remainingMsgs);
        toast.success(`${selectedMessageIds.length} messages deleted for you`);
      }

      setIsSelectionMode(false);
      setSelectedMessageIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error(err.response?.data?.message || "Failed to delete messages");
      setIsBulkDeleteModalOpen(false);
    }
  };

  const handleToggleFavourite = async () => {
    if (!selectedChat) return;
    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.put(
        `${API_URL}/chat/favourite/${selectedChat._id}`,
        {},
        config,
      );

      setSelectedChat(data);
      setChats((prev) =>
        prev.map((c) => (c._id === data._id ? data : c))
      );
      setMenuOpen(false);
      toast.success(data.isFavourite ? "Added to favourites" : "Removed from favourites");
    } catch (err) {
      console.error("Failed to toggle favourite:", err);
      toast.error("Could not update favourites");
    }
  };

  const handleClearChat = async () => {
    if (selectedChat.isGroupChat) {
      const isAdmin =
        selectedChat.groupAdmin &&
        (selectedChat.groupAdmin._id || selectedChat.groupAdmin)?.toString() ===
          myId;
      if (!isAdmin) {
        toast.error("Only the group admin can clear messages in this group.");
        return;
      }
    }

    toast((t) => (
      <div className={`flex flex-col gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
        <p className="font-semibold text-sm">Clear all messages in this chat?</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const config = {
                  headers: { Authorization: `Bearer ${user.token}` },
                };
                await axios.put(
                  `${API_URL}/message/clear/${selectedChat._id}`,
                  {},
                  config,
                );
                setMessages([]);
                setMenuOpen(false);

                setChats((prevChats) => {
                  if (!prevChats) return prevChats;
                  return prevChats.map((c) =>
                    c._id?.toString() === selectedChat._id?.toString()
                      ? { ...c, latestMessage: null }
                      : c
                  );
                });

                if (socket) {
                  socket.emit("clear chat", { chatId: selectedChat._id.toString() });
                }
                toast.success("Chat cleared successfully");
              } catch (err) {
                toast.error("Failed to clear chat");
              }
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
              isDark 
                ? "bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const handleDeleteChat = async () => {
    toast((t) => (
      <div className={`flex flex-col gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
        <p className="font-semibold text-sm">Are you sure you want to delete this entire chat?</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const config = {
                  headers: { Authorization: `Bearer ${user.token}` },
                };
                const chatId = selectedChat._id;
                await axios.delete(`${API_URL}/chat/${chatId}`, config);

                if (socket) {
                  socket.emit("delete chat", { chatId, users: selectedChat.users });
                }

                setChats((prev) => prev.filter((c) => c._id !== chatId));
                setSelectedChat(null);
                setMenuOpen(false);
                toast.success("Chat deleted successfully");
              } catch (err) {
                toast.error("Failed to delete chat");
              }
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
              isDark 
                ? "bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const handleDeleteAccount = async () => {
    toast((t) => (
      <div className={`flex flex-col gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
        <p className="font-semibold text-sm text-rose-500">Permanently delete your account? Cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const config = {
                  headers: { Authorization: `Bearer ${user.token}` },
                };
                await axios.delete(`${API_URL}/users/delete`, config);
                localStorage.removeItem("userInfo");
                setUser(null);
                setSelectedChat(null);
                window.location.reload();
              } catch (err) {
                toast.error(err.response?.data?.message || "Could not delete account");
              }
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            Delete Permanently
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
              isDark 
                ? "bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const handleReact = async (messageId, emoji) => {
    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.put(
        `${API_URL}/message/react/${messageId}`,
        { emoji },
        config,
      );

      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? data : msg)),
      );

      if (socket) {
        socket.emit("react message", data);
      }
      setActiveContextMenuMessageId(null);
    } catch (error) {
      console.error("Failed to react to message", error);
    }
  };

  const handleBlockToggle = async () => {
    if (!partnerId) return;
    const action = isUserBlocked ? "unblock" : "block";

    toast((t) => (
      <div className={`flex flex-col gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
        <p className="font-semibold text-sm capitalize">Are you sure you want to {action} this user?</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const config = {
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user.token}`,
                  },
                };
                const endpoint = isUserBlocked ? "unblock" : "block";
                const payload = isUserBlocked
                  ? { userIdToUnblock: partnerId }
                  : { userIdToBlock: partnerId };

                const { data } = await axios.put(
                  `${API_URL}/user/${endpoint}`,
                  payload,
                  config,
                );

                const updatedBlockedUsers = isUserBlocked
                  ? user.blockedUsers.filter((id) => id.toString() !== partnerId)
                  : [...(user.blockedUsers || []), partnerId];

                const updatedUser = { ...user, blockedUsers: updatedBlockedUsers };
                setUser(updatedUser);
                localStorage.setItem("userInfo", JSON.stringify(updatedUser));

                toast.success(data.message || `User ${action}ed successfully`);
                setMenuOpen(false);
              } catch (err) {
                toast.error(err.response?.data?.message || `Failed to ${action} user`);
              }
            }}
            className="bg-[#00a884] hover:bg-[#019574] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
              isDark 
                ? "bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const handleSelectWallpaper = (val) => {
    setWallpaper(val);
    if (currentUserId) {
      const userKey = `chat_wallpaper_user_${currentUserId}`;
      localStorage.setItem(userKey, val);
      toast.success("Wallpaper updated for all your chats!");
    }
    setWallpaperModalOpen(false);
  };

  const handleCustomWallpaperUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleSelectWallpaper(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const query = searchQuery.toLowerCase();
        const contentMatch = m.content?.toLowerCase().includes(query);
        const fileTypeMatch = m.fileType?.toLowerCase().includes(query);
        return contentMatch || fileTypeMatch;
      })
    : messages;

  const renderMessageTicks = (m) => {
    if (isSelfChat) {
      return (
        <span className="text-[#53bdeb] font-bold tracking-tighter text-sm" title="Saved">
          ✓✓
        </span>
      );
    }

    if (selectedChat.isGroupChat) {
      const otherMembers = (selectedChat.users || []).filter(
        (u) => (u._id || u?.id || u)?.toString() !== myId,
      );

      const allRead =
        otherMembers.length > 0 &&
        otherMembers.every((member) => {
          const memId = (member._id || member?.id || member)?.toString();
          return m.readBy?.some(
            (id) => (id?._id || id?.id || id)?.toString() === memId,
          );
        });

      if (allRead) {
        return (
          <span
            className="text-[#53bdeb] font-bold tracking-tighter text-sm"
            title="Read by all"
          >
            ✓✓
          </span>
        );
      }

      const anyOnline = otherMembers.some((member) => {
        const memId = (member._id || member?.id || member)?.toString();
        return onlineUsers?.some((onlineId) => onlineId?.toString() === memId);
      });

      if (anyOnline) {
        return (
          <span className={`tracking-tighter text-sm ${isDark ? "text-slate-300" : "text-slate-500"}`} title="Delivered">
            ✓✓
          </span>
        );
      }

      return (
        <span className={`text-sm ${isDark ? "text-slate-400" : "text-slate-400"}`} title="Sent">
          ✓
        </span>
      );
    }

    const isReadByPartner =
      partnerId &&
      m.readBy?.some(
        (id) => (id?._id || id?.id || id)?.toString() === partnerId,
      );

    if (isReadByPartner) {
      return (
        <span className="text-[#53bdeb] font-bold tracking-tighter text-sm" title="Read">
          ✓✓
        </span>
      );
    }

    if (isPartnerOnline) {
      return (
        <span className={`tracking-tighter text-sm ${isDark ? "text-slate-300" : "text-slate-500"}`} title="Delivered">
          ✓✓
        </span>
      );
    }

    return (
      <span className={`text-sm ${isDark ? "text-slate-400" : "text-slate-400"}`} title="Sent">
        ✓
      </span>
    );
  };

  const getChatBackgroundStyle = () => {
    if (wallpaper === "default" || wallpaper === "#0b141a" || wallpaper === "#efeae2") {
      return {
        backgroundColor: isDark ? "#0b141a" : "#efeae2",
        backgroundImage: isDark
          ? `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)`
          : `radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      };
    }

    if (wallpaper.startsWith("#")) {
      return { backgroundColor: wallpaper };
    }

    return {
      backgroundImage: `url(${wallpaper})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  };

  if (activeTab === "calls") {
    return <CallsList />;
  }

  if (!selectedChat) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center text-center px-6 min-w-0 flex-1 select-text transition-all duration-300 ${
          isDark ? "bg-[#0b141a] text-slate-200" : "bg-[#f0f2f5] text-slate-800"
        }`}
      >
        <div
          className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl mb-6 shadow-xl select-none transition-colors ${
            isDark
              ? "bg-[#111b21] text-[#00a884] border border-[#222d34]"
              : "bg-white text-[#00a884] border border-slate-200 shadow-slate-200/50"
          }`}
        >
          💬
        </div>
        <h2 className={`text-3xl font-light tracking-tight mb-2 select-text ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          WhatsApp Web Clone
        </h2>
        <p
          className={`text-sm max-w-md leading-relaxed select-text ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Send and receive messages without keeping your phone online. Use up to
          4 companion devices and 1 phone at the same time.
        </p>
        <div
          className={`mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium shadow-sm select-none transition-colors ${
            isDark
              ? "bg-[#111b21] text-slate-400 border border-[#222d34]"
              : "bg-white text-slate-600 border border-slate-200 shadow-xs"
          }`}
        >
          <span className="text-[#00a884]">🔒</span> End-to-end encrypted
        </div>

        <button
          onClick={handleDeleteAccount}
          className="mt-6 text-xs text-rose-500 hover:text-rose-600 underline cursor-pointer font-medium select-none"
        >
          Delete My Account
        </button>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col relative overflow-hidden min-w-0 flex-1 transition-colors duration-300 ${
        isDark ? "bg-[#0b141a]" : "bg-[#efeae2]"
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between z-20 flex-shrink-0 transition-all duration-300 select-none ${
          isDark
            ? "bg-[#202c33] border-[#222d34] text-slate-100"
            : "bg-[#f0f2f5] border-slate-200 text-slate-900"
        }`}
      >
        {isSelectionMode ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedMessageIds([]);
                }}
                className={`p-1.5 cursor-pointer font-bold text-lg ${isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                ✕
              </button>
              <span className="font-semibold text-base">{selectedMessageIds.length} selected</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                disabled={selectedMessageIds.length === 0}
                className="p-2 text-rose-500 hover:text-rose-600 disabled:opacity-40 cursor-pointer text-xl"
                title="Delete selected messages"
              >
                🗑️
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              onClick={() => !isSelfChat && setChatInfoOpen(true)}
              className={`flex items-center gap-3.5 min-w-0 ${!isSelfChat ? "cursor-pointer group" : ""}`}
              title={isSelfChat ? "Personal Storage Space" : "Click for contact info"}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChat(null);
                }}
                className={`md:hidden text-xl p-2 rounded-lg transition cursor-pointer flex-shrink-0 ${
                  isDark
                    ? "hover:bg-[#374248] text-slate-300"
                    : "hover:bg-slate-200 text-slate-600"
                }`}
                title="Back to Chats"
              >
                ←
              </button>

              {isSelfChat ? (
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-tr from-[#00a884] to-emerald-600 text-white font-bold shadow-sm">
                    {user?.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt="You"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      "👤"
                    )}
                  </div>
                </div>
              ) : !selectedChat.isGroupChat ? (
                <div className="relative flex-shrink-0">
                  <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold shadow-sm ${isDark ? "bg-[#222d34] text-white" : "bg-slate-200 text-slate-700"}`}>
                    {partner?.profilePicture ? (
                      <img
                        src={partner.profilePicture}
                        alt={partner?.name || "User"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      partner?.name?.charAt(0)?.toUpperCase() || "U"
                    )}
                  </div>
                  {isPartnerOnline && (
                    <span
                      className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 rounded-full"
                      style={{ borderColor: isDark ? "#202c33" : "#f0f2f5" }}
                    />
                  )}
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full overflow-hidden bg-[#53646f] text-white flex items-center justify-center font-bold text-base shadow-sm flex-shrink-0">
                  {selectedChat.groupImage ? (
                    <img
                      src={selectedChat.groupImage}
                      alt={selectedChat.chatName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-6 h-6 fill-[#cfd6dc]"
                    >
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  )}
                </div>
              )}

              <div className="flex flex-col min-w-0">
                <h3 className={`text-sm sm:text-base font-semibold tracking-tight truncate select-text ${!isSelfChat ? "group-hover:text-[#00a884]" : "text-[#00a884]"} transition-colors`}>
                  {isSelfChat
                    ? "You (You)"
                    : selectedChat.isGroupChat
                    ? selectedChat.chatName
                    : partnerDisplayName}
                </h3>
                <p
                  className={`text-xs truncate select-text ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {isSelfChat
                    ? "Message yourself"
                    : selectedChat.isGroupChat
                    ? `${selectedChat.users?.length || 0} participants`
                    : isPartnerOnline
                      ? "online"
                      : formatLastSeen(partner?.lastSeen)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0 relative">
              {!isSelfChat && (
                <div className="flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCallType("audio");
                      setCallModalOpen(true);
                    }}
                    className={`p-2 rounded-xl transition text-base cursor-pointer ${
                      isDark
                        ? "hover:bg-[#374248] text-slate-300"
                        : "hover:bg-slate-200 text-slate-700"
                    }`}
                    title={selectedChat.isGroupChat ? "Start Group Voice Call" : "Start Voice Call"}
                  >
                    📞
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCallType("video");
                      setCallModalOpen(true);
                    }}
                    className={`p-2 rounded-xl transition text-base cursor-pointer ${
                      isDark
                        ? "hover:bg-[#374248] text-slate-300"
                        : "hover:bg-slate-200 text-slate-700"
                    }`}
                    title={selectedChat.isGroupChat ? "Start Group Video Call" : "Start Video Call"}
                  >
                    📹
                  </button>
                </div>
              )}

              <button
                onClick={() => setSearchOpen((prev) => !prev)}
                title="Search in chat"
                className={`p-2 rounded-xl transition text-base cursor-pointer ${
                  searchOpen
                    ? "bg-[#00a884] text-white"
                    : isDark
                      ? "hover:bg-[#374248] text-slate-300"
                      : "hover:bg-slate-200 text-slate-700"
                }`}
              >
                🔍
              </button>

              <button
                onClick={() => setMediaDrawerOpen(true)}
                title="Shared Media & Docs"
                className={`hidden sm:flex text-sm px-3 py-2 rounded-xl transition font-medium items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? "hover:bg-[#374248] text-slate-300"
                    : "hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>📁</span> Media
              </button>

              {selectedChat.isGroupChat && (
                <button
                  onClick={() => setGroupModalOpen(true)}
                  className={`hidden md:flex text-sm px-3 py-2 rounded-xl transition font-medium cursor-pointer items-center gap-1 ${
                    isDark
                      ? "hover:bg-[#374248] text-slate-300"
                      : "hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  ⚙️ Info
                </button>
              )}

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className={`p-2 rounded-xl transition text-lg font-bold cursor-pointer ${
                    isDark
                      ? "hover:bg-[#374248] text-slate-300"
                      : "hover:bg-slate-200 text-slate-700"
                  }`}
                  title="Menu"
                >
                  ⋮
                </button>

                {menuOpen && (
                  <div
                    className={`absolute right-0 top-12 w-56 rounded-2xl shadow-xl border py-2.5 z-50 text-sm backdrop-blur-xl ${
                      isDark
                        ? "bg-[#233138] border-[#2a3942] text-slate-200"
                        : "bg-white border-slate-200 text-slate-800 shadow-slate-300/60"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setSearchOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer font-medium ${
                        isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">🔍</span> Search messages
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setMediaDrawerOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer font-medium ${
                        isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">📁</span> Media, links and docs
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setWallpaperModalOpen(true);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer font-medium ${
                        isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">🖼️</span> Change wallpaper
                    </button>

                    <button
                      onClick={handleToggleFavourite}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer border-t font-medium ${
                        isDark ? "border-[#2a3942] hover:bg-[#182229]" : "border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">{selectedChat.isFavourite ? "❤️" : "🤍"}</span>
                      {selectedChat.isFavourite ? "Remove from favourites" : "Add to favourites"}
                    </button>

                    {selectedChat.isGroupChat && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setGroupModalOpen(true);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer border-t font-medium ${
                          isDark
                            ? "border-[#2a3942] hover:bg-[#182229]"
                            : "border-slate-100 hover:bg-slate-100"
                        }`}
                      >
                        <span className="w-5 text-center">⚙️</span> Group info
                      </button>
                    )}

                    {!selectedChat.isGroupChat && !isSelfChat && partnerId && (
                      <button
                        onClick={handleBlockToggle}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer border-t font-medium text-rose-500 ${
                          isDark
                            ? "border-[#2a3942] hover:bg-[#182229]"
                            : "border-slate-100 hover:bg-slate-100"
                        }`}
                      >
                        <span className="w-5 text-center">🚫</span> {isUserBlocked ? "Unblock user" : "Block user"}
                      </button>
                    )}

                    {(!selectedChat.isGroupChat ||
                      (
                        selectedChat.groupAdmin?._id || selectedChat.groupAdmin
                      )?.toString() === (user?._id || user?.id)?.toString()) && (
                      <button
                        onClick={handleClearChat}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer border-t font-medium ${
                          isDark
                            ? "border-[#2a3942] hover:bg-[#182229]"
                            : "border-slate-100 hover:bg-slate-100"
                        }`}
                      >
                        <span className="w-5 text-center">🧹</span> Clear chat
                      </button>
                    )}

                    <button
                      onClick={handleDeleteChat}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer font-medium text-rose-500 border-t ${
                        isDark ? "border-[#2a3942] hover:bg-[#182229]" : "border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">🗑️</span> Delete chat
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleDeleteAccount();
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer font-medium text-rose-500 border-t ${
                        isDark
                          ? "border-[#2a3942] hover:bg-[#182229]"
                          : "border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">⚠️</span> Delete Account
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setSelectedChat(null);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3.5 transition cursor-pointer border-t font-medium ${
                        isDark
                          ? "border-[#2a3942] text-slate-400 hover:bg-[#182229]"
                          : "border-slate-100 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <span className="w-5 text-center">✕</span> Close chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {searchOpen && (
        <div
          className={`px-4 py-2.5 border-b flex items-center gap-3 z-10 transition-all duration-300 ${
            isDark
              ? "bg-[#202c33] border-[#222d34] text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <span className="text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className={`flex-1 text-sm px-3.5 py-2.5 rounded-xl outline-none border focus:ring-1 focus:ring-[#00a884] transition-all ${
              isDark
                ? "bg-[#2a3942] border-transparent text-slate-100 placeholder-slate-400"
                : "bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-500"
            }`}
          />
          {searchQuery && (
            <span className="text-xs text-[#00a884] font-semibold px-2.5 py-1 rounded-full bg-[#00a884]/15">
              {filteredMessages.length} results
            </span>
          )}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 cursor-pointer"
            title="Close search"
          >
            ✕
          </button>
        </div>
      )}

      {selectedChat.isGroupChat && (
        <UpdateGroupChatModal
          isOpen={groupModalOpen}
          onClose={() => setGroupModalOpen(false)}
          fetchMessages={fetchMessages}
        />
      )}

      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        onClose={() => {
          setIsForwardModalOpen(false);
          setForwardingMessage(null);
        }}
        onForward={handleForwardMessage}
      />

      {isSaveContactModalOpen && (
        <SaveContactModal
          isOpen={isSaveContactModalOpen}
          onClose={() => {
            setIsSaveContactModalOpen(false);
            setSelectedContactCard(null);
          }}
          contactData={selectedContactCard}
        />
      )}

      {/* Poll Voter Breakdown Modal */}
      {pollVoterModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-slate-700/40">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📊</span> {pollVoterModalData.optionText} ({pollVoterModalData.voters.length})
              </h3>
              <button
                onClick={() => setPollVoterModalData(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 mb-4">
              {pollVoterModalData.voters.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No votes for this option yet.</p>
              ) : (
                pollVoterModalData.voters.map((v, i) => {
                  const resolvedName = resolveUserName(v);
                  const userPhone = v.phone ? `+91 ${v.phone}` : "";
                  const userPic = v.profilePicture;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border ${
                        isDark ? "bg-[#111b21] border-[#2a3942]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-emerald-500/20 text-[#00a884] flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {userPic ? (
                          <img src={userPic} alt={resolvedName} className="w-full h-full object-cover" />
                        ) : (
                          resolvedName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{resolvedName}</p>
                        {userPhone && resolvedName !== userPhone && (
                          <p className="text-xs font-mono text-slate-400 truncate">{userPhone}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setPollVoterModalData(null)}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer border ${
                isDark
                  ? "bg-[#111b21] border-[#2a3942] text-slate-200 hover:bg-[#182229]"
                  : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {contactModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-slate-700/40">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>👤</span> Select Contact to Share
              </h3>
              <button
                onClick={() => setContactModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 mb-4">
              {loadingContacts ? (
                <div className="text-center py-6 text-sm text-slate-400 animate-pulse">
                  Loading contacts...
                </div>
              ) : savedContactsList.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  No saved contacts found.
                </div>
              ) : (
                savedContactsList.map((c) => {
                  const avatar = c.contactUser?.profilePicture;
                  const name = c.savedName;
                  const phone = c.phoneNumber || c.contactUser?.phone;

                  return (
                    <div
                      key={c._id}
                      onClick={() => handleSendContactCard(c)}
                      className={`flex items-center gap-3.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                        isDark
                          ? "bg-[#111b21] border-[#2a3942] hover:bg-[#182229]"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          name?.charAt(0)?.toUpperCase() || "C"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{name}</p>
                        <p className="text-xs font-mono text-slate-400 truncate">
                          {phone ? `+91 ${phone}` : "No phone"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#00a884]">
                        Send →
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className={`w-full py-3 rounded-2xl text-sm font-semibold transition cursor-pointer border ${
                isDark
                  ? "bg-[#111b21] border-[#2a3942] text-slate-200 hover:bg-[#182229]"
                  : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pollModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-5 border-b pb-3 border-slate-200 dark:border-slate-700/40">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📊</span> Create Poll
              </h3>
              <button
                onClick={() => setPollModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                  Question
                </label>
                <input
                  type="text"
                  placeholder="Ask a question..."
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className={`w-full text-sm px-3.5 py-2.5 rounded-xl border outline-none focus:ring-1 focus:ring-[#00a884] ${
                    isDark
                      ? "bg-[#111b21] border-[#2a3942] text-slate-100"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                  Options
                </label>
                <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = e.target.value;
                          setPollOptions(newOpts);
                        }}
                        className={`flex-1 text-sm px-3.5 py-2.5 rounded-xl border outline-none focus:ring-1 focus:ring-[#00a884] ${
                          isDark
                            ? "bg-[#111b21] border-[#2a3942] text-slate-100"
                            : "bg-slate-50 border-slate-200 text-slate-900"
                        }`}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPollOptions(
                              pollOptions.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-rose-400 text-sm font-bold w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="mt-3 text-xs text-[#00a884] hover:underline font-semibold cursor-pointer block"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreatePoll}
              disabled={uploading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#019574] text-white rounded-2xl text-sm font-semibold shadow-md transition cursor-pointer"
            >
              {uploading ? "Publishing..." : "Send Poll"}
            </button>
          </div>
        </div>
      )}

      <MediaDrawer
        isOpen={mediaDrawerOpen}
        onClose={() => setMediaDrawerOpen(false)}
        messages={messages}
      />

      <ChatInfoDrawer
        isOpen={chatInfoOpen}
        onClose={() => setChatInfoOpen(false)}
        messages={messages}
        isBlocked={isUserBlocked}
        onBlockToggle={handleBlockToggle}
        onClearChat={handleClearChat}
        onDeleteChat={handleDeleteChat}
        onOpenMediaDrawer={() => {
          setChatInfoOpen(false);
          setMediaDrawerOpen(true);
        }}
      />

      <CallModal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        callType={callType}
        isIncoming={false}
        targetUserId={partnerId}
        chatId={selectedChat?._id}
        isGroup={selectedChat?.isGroupChat}
        isGroupChat={selectedChat?.isGroupChat}
        groupName={selectedChat?.chatName}
        groupUsers={selectedChat?.users}
      />

      {/* Messages Container */}
      <div
        className="flex-1 overflow-y-auto px-6 py-5 space-y-3 min-w-0"
        style={getChatBackgroundStyle()}
      >
        {searchQuery && filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-10 select-text">
            <span className="text-3xl mb-2">🔍</span>
            <p>No matches found for "{searchQuery}"</p>
          </div>
        ) : (
          filteredMessages.map((m, index) => {
            const senderId = (
              m.sender?._id ||
              m.sender?.id ||
              m.sender
            )?.toString();
            const isMe = senderId === myId;
            const isHovered = hoveredMessageId === m._id;
            const isContextMenuOpen = activeContextMenuMessageId === m._id;
            const isHighlighted = highlightedMessageId === m._id;
            const isSelected = selectedMessageIds.includes(m._id);

            const currentDate = new Date(m.createdAt).toDateString();
            const prevMessage = filteredMessages[index - 1];
            const prevDate = prevMessage
              ? new Date(prevMessage.createdAt).toDateString()
              : null;
            const showDateHeader = currentDate !== prevDate;

            const isSystemMessage =
              Boolean(m.isSystemMessage) ||
              (!m.fileType &&
                !m.fileUrl &&
                !m.poll?.question &&
                (m.content?.includes(" added ") ||
                  m.content?.includes(" removed ") ||
                  m.content?.includes(" left ") ||
                  m.content?.includes(" created group ") ||
                  m.content?.includes(" changed the group name ") ||
                  m.content?.includes(" changed this group's icon") ||
                  m.content?.includes(" made ") ||
                  m.content?.includes(" dismissed ") ||
                  m.content?.includes(" turned disappearing messages ")));

            const isCallLog =
              m.fileType === "call" || m.content?.includes("call");

            return (
              <React.Fragment key={m._id || index}>
                {showDateHeader && (
                  <div className="flex justify-center my-4 select-none">
                    <span
                      className={`text-xs px-4 py-1.5 rounded-xl uppercase tracking-wide font-medium shadow-xs select-text ${
                        isDark
                          ? "bg-[#182229] text-slate-300"
                          : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      {formatDateDivider(m.createdAt)}
                    </span>
                  </div>
                )}

                {isSystemMessage || isCallLog ? (
                  <div className="flex justify-center my-3 select-none">
                    <span
                      className={`text-xs px-4 py-2 rounded-xl shadow-xs font-medium flex items-center gap-2 select-text ${
                        isDark
                          ? "bg-[#182229] text-slate-300"
                          : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      {isCallLog && (
                        <span>
                          {m.content?.includes("Video") ? "📹" : "📞"}
                        </span>
                      )}
                      {m.content}
                    </span>
                  </div>
                ) : (
                  <div
                    id={`msg-${m._id}`}
                    onMouseEnter={() => setHoveredMessageId(m._id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    className={`flex items-center gap-3 relative py-1 w-full min-w-0 ${
                      isMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    {isSelectionMode && !m.isDeleted && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedMessageIds((prev) =>
                            prev.includes(m._id)
                              ? prev.filter((id) => id !== m._id)
                              : [...prev, m._id]
                          );
                        }}
                        className="w-5 h-5 accent-[#00a884] cursor-pointer"
                      />
                    )}

                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isSelectionMode) {
                          setActiveContextMenuMessageId(m._id);
                        }
                      }}
                      onClick={() => {
                        if (isSelectionMode && !m.isDeleted) {
                          setSelectedMessageIds((prev) =>
                            prev.includes(m._id)
                              ? prev.filter((id) => id !== m._id)
                              : [...prev, m._id]
                          );
                        }
                      }}
                      className="relative group w-fit max-w-[85%] sm:max-w-[75%] md:max-w-[480px] overflow-visible"
                    >
                      {!isSelectionMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveContextMenuMessageId(
                              isContextMenuOpen ? null : m._id,
                            );
                          }}
                          className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 text-slate-200 transition-all cursor-pointer ${
                            isHovered || isContextMenuOpen
                              ? "opacity-100 scale-100"
                              : "opacity-0 scale-90"
                          }`}
                          title="Menu"
                        >
                          <span className="text-sm leading-none">⌄</span>
                        </button>
                      )}

                      {isContextMenuOpen && (
                        <div
                          ref={contextMenuRef}
                          className={`absolute z-50 top-0 flex flex-col gap-2 select-none animate-in fade-in zoom-in-95 duration-150 ${
                            isMe
                              ? "right-0 sm:right-full sm:mr-3 items-end"
                              : "left-0 sm:left-full sm:ml-3 items-start"
                          }`}
                        >
                          {!m.isDeleted && (
                            <div
                              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl border whitespace-nowrap select-none ${
                                isDark
                                  ? "bg-[#233138] border-[#2a3942]"
                                  : "bg-white border-slate-200"
                              }`}
                            >
                              {AVAILABLE_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(m._id, emoji);
                                  }}
                                  className="hover:scale-125 transition-transform text-xl p-1 cursor-pointer"
                                  title={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          <div
                            className={`w-52 rounded-2xl shadow-xl border py-2 text-xs overflow-hidden select-none ${
                              isDark
                                ? "bg-[#233138] border-[#2a3942] text-slate-200"
                                : "bg-white border-slate-200 text-slate-800"
                            }`}
                          >
                            {!m.isDeleted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(m);
                                    setActiveContextMenuMessageId(null);
                                  }}
                                  className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer font-medium ${
                                    isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                                  }`}
                                >
                                  <span className="text-base">↩</span> Reply
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setForwardingMessage(m);
                                    setIsForwardModalOpen(true);
                                    setActiveContextMenuMessageId(null);
                                  }}
                                  className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer font-medium ${
                                    isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                                  }`}
                                >
                                  <span className="text-base">↗️</span> Forward
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSelectionMode(true);
                                    setSelectedMessageIds([m._id]);
                                    setActiveContextMenuMessageId(null);
                                  }}
                                  className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer font-medium ${
                                    isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                                  }`}
                                >
                                  <span className="text-base">☑️</span> Select messages
                                </button>

                                {isMe && !m.fileType && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessage(m);
                                      setNewMessage(m.content);
                                      setActiveContextMenuMessageId(null);
                                      inputRef.current?.focus();
                                    }}
                                    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer font-medium text-[#00a884] ${
                                      isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                                    }`}
                                  >
                                    <span className="text-base">✏️</span> Edit
                                  </button>
                                )}

                                {m.fileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDirectDownload(
                                        m.fileUrl,
                                        m.content ||
                                          (m.fileType === "image"
                                            ? "image.jpg"
                                            : "document"),
                                      );
                                      setActiveContextMenuMessageId(null);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer font-medium ${
                                      isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                                    }`}
                                  >
                                    <span className="text-base">⬇</span> Download
                                  </button>
                                )}

                                {m.content && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyMessage(m.content, m._id)
                                    }
                                    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer font-medium ${
                                      isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                                    }`}
                                  >
                                    <span className="text-base">📋</span>{" "}
                                    {copiedMessageId === m._id
                                      ? "Copied!"
                                      : "Copy"}
                                  </button>
                                )}
                              </>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                setActiveContextMenuMessageId(null);
                                setDeleteModalMessage(m);
                              }}
                              className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition cursor-pointer text-rose-500 font-medium ${
                                !m.isDeleted ? "border-t" : ""
                              } ${
                                isDark
                                  ? "border-[#2a3942] hover:bg-[#182229]"
                                  : "border-slate-100 hover:bg-slate-100"
                              }`}
                            >
                              <span className="text-base">🗑</span> Delete
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className={`rounded-xl px-4 py-2.5 relative shadow-xs overflow-hidden w-full transition-all duration-200 select-text ${
                          isHighlighted
                            ? "ring-2 ring-[#00a884] bg-[#00a884]/30 scale-[1.01]"
                            : isMe
                              ? isDark
                                ? "bg-[#005c4b] text-slate-100 rounded-tr-none text-base"
                                : "bg-[#d9fdd3] text-slate-900 rounded-tr-none text-base border border-[#c4f0bd]"
                              : isDark
                                ? "bg-[#202c33] text-slate-100 rounded-tl-none text-base"
                                : "bg-white text-slate-900 rounded-tl-none text-base border border-slate-200/80 shadow-xs"
                        } ${
                          m.isDeleted
                            ? isDark
                              ? "bg-[#182229] text-slate-400"
                              : "bg-slate-100 text-slate-500"
                            : ""
                        }`}
                      >
                        {m.replyTo && (
                          <div
                            onClick={() => {
                              const targetId = m.replyTo._id || m.replyTo;
                              const el = document.getElementById(
                                `msg-${targetId}`,
                              );
                              if (el) {
                                el.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                setHighlightedMessageId(targetId);
                                setTimeout(() => {
                                  setHighlightedMessageId(null);
                                }, 1500);
                              }
                            }}
                            className={`mb-2.5 p-2.5 rounded-lg border-l-4 cursor-pointer text-xs sm:text-sm ${
                              isMe
                                ? isDark
                                  ? "bg-black/20 border-white/70 text-white/95"
                                  : "bg-black/5 border-[#00a884] text-slate-800"
                                : isDark
                                  ? "bg-[#111b21] border-[#00a884] text-slate-200"
                                  : "bg-slate-100 border-[#00a884] text-slate-700"
                            }`}
                          >
                            <p className="font-bold truncate text-[#00a884]">
                              {m.replyTo.sender?.name || "Original Message"}
                            </p>
                            <p className="truncate opacity-90 mt-0.5">
                              {m.replyTo.fileType === "image" && "🖼️ Photo"}
                              {m.replyTo.fileType === "document" &&
                                "📄 Document"}
                              {m.replyTo.fileType === "audio" &&
                                "🎙️ Voice Message"}
                              {m.replyTo.fileType === "video" && "📹 Video"}
                              {m.replyTo.fileType === "location" &&
                                "📍 Location"}
                              {m.replyTo.fileType === "poll" && "📊 Poll"}
                              {m.replyTo.fileType === "contact" && "👤 Contact"}
                              {!m.replyTo.fileType && m.replyTo.content}
                            </p>
                          </div>
                        )}

                        {!isMe && selectedChat.isGroupChat && !m.isDeleted && (
                          <p className="text-xs sm:text-sm text-[#00a884] dark:text-[#53bdeb] font-bold px-0.5 mb-1.5 truncate">
                            {m.sender?.name}
                          </p>
                        )}

                        {m.isDeleted ? (
                          <div className="flex items-center gap-2.5 px-1 py-1.5 text-sm sm:text-base select-text">
                            <span className="text-base">🚫</span>
                            <span className="italic">
                              This message was deleted
                            </span>
                          </div>
                        ) : m.fileType === "poll" && m.poll ? (
                          <div className="w-[280px] sm:w-[340px] p-1.5 select-text">
                            <div className="flex items-center gap-2.5 mb-3">
                              <span className="text-lg">📊</span>
                              <p className="text-sm sm:text-base font-bold tracking-tight truncate">
                                {m.poll.question}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {m.poll.options.map((opt, idx) => {
                                const totalVotes = m.poll.options.reduce(
                                  (sum, o) => sum + (o.votes?.length || 0),
                                  0,
                                );
                                const optVotes = opt.votes?.length || 0;
                                const percentage =
                                  totalVotes > 0
                                    ? Math.round((optVotes / totalVotes) * 100)
                                    : 0;
                                const hasVoted = opt.votes?.some(
                                  (vId) =>
                                    (vId?._id || vId)?.toString() === myId,
                                );

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => handleVote(m._id, opt._id)}
                                    className={`relative p-2.5 rounded-xl border cursor-pointer transition-all overflow-hidden text-xs sm:text-sm ${
                                      hasVoted
                                        ? "border-[#00a884] bg-[#00a884]/20 font-bold"
                                        : isDark
                                          ? "border-[#2a3942] bg-[#111b21] hover:bg-[#182229]"
                                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                                    }`}
                                  >
                                    <div
                                      className="absolute inset-y-0 left-0 bg-[#00a884]/30 transition-all duration-300 pointer-events-none"
                                      style={{ width: `${percentage}%` }}
                                    />
                                    <div className="relative flex items-center justify-between pointer-events-none">
                                      <span
                                        className={`truncate pr-2 pointer-events-auto ${hasVoted ? "text-[#00a884]" : ""}`}
                                      >
                                        {hasVoted ? "✓ " : ""}
                                        {opt.text}
                                      </span>
                                      <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPollVoterModalData({
                                              optionText: opt.text,
                                              voters: opt.votes || [],
                                            });
                                          }}
                                          className="text-xs opacity-90 font-mono hover:underline cursor-pointer bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-md"
                                          title="View voters"
                                        >
                                          {optVotes} ({percentage}%)
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.fileUrl && m.fileType === "image" && (
                              <div className="w-[280px] sm:w-[360px] max-w-full rounded-xl overflow-hidden bg-black/20 mb-2 aspect-[4/3]">
                                <img
                                  src={m.fileUrl}
                                  alt={m.content || "Attached image"}
                                  className="w-full h-full object-cover block cursor-pointer hover:scale-102 transition-transform duration-200"
                                  onClick={() =>
                                    window.open(m.fileUrl, "_blank")
                                  }
                                />
                              </div>
                            )}

                            {m.fileUrl && m.fileType === "document" && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDirectDownload(
                                    m.fileUrl,
                                    m.content || "document.pdf",
                                  );
                                }}
                                className={`flex items-center gap-3.5 p-3 rounded-xl border my-1.5 transition-all cursor-pointer group select-text ${
                                  isMe
                                    ? isDark
                                      ? "bg-black/15 border-white/20 hover:bg-black/25"
                                      : "bg-black/5 border-[#00a884]/30 hover:bg-black/10"
                                    : isDark
                                      ? "bg-[#111b21] hover:bg-[#182229] border-[#2a3942]"
                                      : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                                }`}
                                title="Click to download"
                              >
                                <span className="text-3xl flex-shrink-0">
                                  📄
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm sm:text-base font-semibold truncate">
                                    {m.content || "Document"}
                                  </p>
                                  <span className={`text-xs block truncate mt-0.5 ${isDark ? "opacity-80" : "text-slate-500"}`}>
                                    Download document
                                  </span>
                                </div>
                                <span className="text-lg">⬇️</span>
                              </div>
                            )}

                            {m.fileType === "contact" && (() => {
                              const lines = (m.content || "").split("\n");
                              const extractedName = lines.find(l => l.startsWith("Name:"))?.replace("Name:", "").trim() || "Contact";
                              const extractedPhone = lines.find(l => l.startsWith("Phone:"))?.replace("Phone:", "").trim() || "";

                              return (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedContactCard({
                                      name: extractedName,
                                      phone: extractedPhone,
                                      avatar: m.fileUrl || ""
                                    });
                                    setIsSaveContactModalOpen(true);
                                  }}
                                  className={`w-[280px] sm:w-[340px] p-3 rounded-2xl border my-1.5 cursor-pointer transition-all hover:scale-[1.01] select-text flex items-center gap-3.5 group ${
                                    isMe
                                      ? isDark
                                        ? "bg-black/20 border-white/20 hover:bg-black/30"
                                        : "bg-black/5 border-[#00a884]/30 hover:bg-black/10"
                                      : isDark
                                        ? "bg-[#111b21] border-[#2a3942] hover:bg-[#182229]"
                                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                  }`}
                                  title="Click to view & save contact"
                                >
                                  <div className="w-12 h-12 rounded-full overflow-hidden bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-base flex-shrink-0 shadow-sm">
                                    {m.fileUrl ? (
                                      <img
                                        src={m.fileUrl}
                                        alt="Contact"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      "👤"
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm sm:text-base font-bold whitespace-pre-wrap leading-relaxed group-hover:text-[#00a884] transition-colors">
                                      {m.content}
                                    </p>
                                    <span className="text-[11px] text-[#00a884] font-semibold block mt-0.5">
                                      Tap to Save Contact →
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {(m.fileType === "location" ||
                              m.fileUrl?.includes("google.com/maps")) && (
                              <div
                                onClick={() =>
                                  window.open(
                                    m.fileUrl ||
                                      `https://www.google.com/maps?q=${m.content}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                                className={`w-[280px] sm:w-[340px] rounded-2xl overflow-hidden border my-1.5 cursor-pointer transition-all hover:opacity-95 select-text ${
                                  isDark
                                    ? "bg-[#111b21] border-[#2a3942]"
                                    : "bg-slate-50 border-slate-200"
                                }`}
                              >
                                <div className="relative h-32 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                  <div
                                    className="absolute inset-0 opacity-30"
                                    style={{
                                      backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
                                      backgroundSize: "16px 16px",
                                    }}
                                  />
                                  <span className="text-3xl">📍</span>
                                </div>
                                <div className="p-3 flex items-center justify-between text-sm sm:text-base">
                                  <span className="font-semibold truncate">
                                    Shared Location
                                  </span>
                                  <span className="text-[#00a884] font-bold">
                                    View →
                                  </span>
                                </div>
                              </div>
                            )}

                            {m.fileUrl && m.fileType === "audio" && (
                              <div className="py-1 px-1 select-none">
                                <div className="flex items-center gap-2 mb-1.5 text-xs sm:text-sm font-semibold select-text">
                                  <span>🎙️</span> Voice Message
                                </div>
                                <audio
                                  controls
                                  src={m.fileUrl}
                                  className="h-10 w-56 sm:w-64 rounded-xl outline-none"
                                />
                              </div>
                            )}

                            {m.content &&
                              m.fileType !== "document" &&
                              m.fileType !== "location" &&
                              m.fileType !== "poll" &&
                              m.fileType !== "contact" &&
                              !m.fileUrl?.includes("google.com/maps") &&
                              (m.fileType !== "image" ||
                                m.content !== m.fileUrl) && (
                                <p className="px-1.5 pt-1 pb-1.5 break-words leading-relaxed text-sm sm:text-base select-text">
                                  {renderTextWithLinks(m.content)}
                                </p>
                              )}
                          </>
                        )}

                        <div
                          className={`text-xs mt-1.5 px-1 flex items-center justify-end gap-1.5 select-none font-medium ${
                            isMe
                              ? isDark ? "text-white/85" : "text-slate-500"
                              : isDark
                                ? "text-slate-400"
                                : "text-slate-500"
                          }`}
                        >
                          {m.isEdited && (
                            <span className="italic opacity-80 mr-1">
                              edited
                            </span>
                          )}
                          <span>{formatTime(m.createdAt)}</span>
                          {isMe && !m.isDeleted && renderMessageTicks(m)}
                        </div>
                      </div>
                    </div>

                    {!m.isDeleted && m.reactions && m.reactions.length > 0 && (
                      <div
                        className={`flex items-center gap-1.5 mt-1 border px-3 py-1 rounded-full text-xs shadow-xs select-none ${
                          isMe ? "mr-1" : "ml-1"
                        } ${
                          isDark
                            ? "bg-[#202c33] border-[#2a3942] text-slate-200"
                            : "bg-white border-slate-200 text-slate-700 shadow-xs"
                        }`}
                      >
                        {Array.from(
                          new Set(m.reactions.map((r) => r.emoji)),
                        ).map((emoji) => (
                          <span key={emoji} className="text-sm">
                            {emoji}
                          </span>
                        ))}
                        <span className="text-xs font-bold opacity-90">
                          {m.reactions.length}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {isTyping && (
          <div className="flex justify-start">
            <div
              className={`border px-4 py-2.5 rounded-2xl rounded-tl-none text-sm flex items-center gap-2 shadow-xs select-none ${
                isDark
                  ? "bg-[#202c33] border-[#2a3942] text-[#00a884]"
                  : "bg-white border-slate-200 text-[#00a884]"
              }`}
            >
              <span className="w-2 h-2 bg-[#00a884] rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              <span className="font-semibold ml-1">typing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Replying Preview Bar */}
      {replyingTo && (
        <div
          className={`px-5 py-2.5 border-t flex items-center justify-between flex-shrink-0 select-none ${
            isDark
              ? "bg-[#202c33] border-[#2a3942] text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-3 border-l-4 border-[#00a884] pl-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#00a884] truncate select-text">
                Replying to {replyingTo.sender?.name || "User"}
              </span>
              <span className="text-xs opacity-90 truncate mt-0.5 select-text">
                {replyingTo.fileType === "image" && "🖼️ Photo"}
                {replyingTo.fileType === "document" && "📄 Document"}
                {replyingTo.fileType === "audio" && "🎙️ Voice Message"}
                {replyingTo.fileType === "video" && "📹 Video"}
                {replyingTo.fileType === "location" && "📍 Location"}
                {replyingTo.fileType === "poll" && "📊 Poll"}
                {replyingTo.fileType === "contact" && "👤 Contact"}
                {!replyingTo.fileType && replyingTo.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="w-8 h-8 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Editing Preview Bar */}
      {editingMessage && (
        <div
          className={`px-5 py-2.5 border-t flex items-center justify-between flex-shrink-0 select-none ${
            isDark
              ? "bg-[#202c33] border-[#2a3942] text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-3 border-l-4 border-amber-500 pl-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-amber-500 dark:text-amber-400 truncate select-text">
                Editing Message
              </span>
              <span className="text-xs opacity-90 truncate mt-0.5 select-text">
                {editingMessage.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setNewMessage("");
            }}
            className="w-8 h-8 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {attachedFile && (
        <div
          className={`px-5 py-3.5 border-t flex items-center gap-3.5 flex-shrink-0 select-none ${
            isDark
              ? "bg-[#202c33] border-[#2a3942] text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          {attachedFile.type.startsWith("image/") ? (
            <img
              src={URL.createObjectURL(attachedFile)}
              alt="Preview"
              className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-14 h-14 bg-[#00a884]/15 text-[#00a884] rounded-xl flex items-center justify-center text-2xl border border-[#00a884]/30">
              📄
            </div>
          )}
          <div className="flex-1 text-sm truncate">
            <span className="font-semibold block truncate mb-1 select-text">
              {attachedFile.name}
            </span>
            <span className="text-xs text-slate-400 font-mono select-text">
              {(attachedFile.size / 1024).toFixed(1)} KB • Ready to send
            </span>
          </div>
          <button
            onClick={() => setAttachedFile(null)}
            className="w-8 h-8 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Footer */}
      <div
        className={`p-3.5 border-t flex-shrink-0 relative transition-all duration-300 select-none ${
          isDark
            ? "bg-[#202c33] border-[#222d34]"
            : "bg-[#f0f2f5] border-slate-200"
        }`}
      >
        {isUserBlocked ? (
          <div className="text-center py-3 text-sm text-rose-500 font-medium bg-rose-500/10 rounded-2xl border border-rose-500/20 select-text">
            🚫 You have blocked this contact. Unblock them from the menu to
            resume communication.
          </div>
        ) : isRecording ? (
          <div className="flex items-center justify-between bg-rose-500/10 px-5 py-3 rounded-2xl border border-rose-500/30 animate-pulse select-none">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>
              <span className="text-sm font-bold text-rose-500">
                Recording Audio • {formatDuration(recordingDuration)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={cancelRecording}
                className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl cursor-pointer ${
                  isDark ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                }`}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                disabled={uploading}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm px-4.5 py-2 rounded-xl font-semibold shadow-xs cursor-pointer"
              >
                {uploading ? "Sending..." : "Send Voice Note"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0 relative">
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setAttachedFile(e.target.files[0]);
                  setAttachmentMenuOpen(false);
                }
              }}
            />
            <input
              type="file"
              ref={documentInputRef}
              accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setAttachedFile(e.target.files[0]);
                  setAttachmentMenuOpen(false);
                }
              }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setAttachedFile(e.target.files[0]);
                  setAttachmentMenuOpen(false);
                }
              }}
            />

            <div className="relative flex-shrink-0" ref={attachmentMenuRef}>
              <button
                type="button"
                onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                className={`p-3 rounded-xl transition text-xl cursor-pointer ${
                  attachmentMenuOpen
                    ? "text-[#00a884] bg-[#00a884]/20 rotate-45 transform"
                    : isDark
                      ? "hover:bg-[#374248] text-slate-400"
                      : "hover:bg-slate-200 text-slate-600"
                }`}
                title="Attach"
              >
                📎
              </button>

              {attachmentMenuOpen && (
                <div
                  className={`absolute bottom-16 left-0 w-80 rounded-2xl shadow-2xl border p-4.5 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 select-none ${
                    isDark
                      ? "bg-[#233138] border-[#2a3942] text-slate-100"
                      : "bg-white border-slate-200 text-slate-900 shadow-slate-300/50"
                  }`}
                >
                  <div className="grid grid-cols-3 gap-3.5 text-center select-none">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg group-hover:scale-110 transition-all">
                        🖼️
                      </div>
                      <span className="text-xs font-medium">Gallery</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        cameraInputRef.current?.click();
                        setAttachmentMenuOpen(false);
                      }}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-lg group-hover:scale-110 transition-all">
                        📷
                      </div>
                      <span className="text-xs font-medium">Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendLocation}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg group-hover:scale-110 transition-all">
                        📍
                      </div>
                      <span className="text-xs font-medium">Location</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setContactModalOpen(true);
                        fetchSavedContacts();
                        setAttachmentMenuOpen(false);
                      }}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg group-hover:scale-110 transition-all">
                        👤
                      </div>
                      <span className="text-xs font-medium">Contact</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg group-hover:scale-110 transition-all">
                        📄
                      </div>
                      <span className="text-xs font-medium">Document</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPollModalOpen(true);
                        setAttachmentMenuOpen(false);
                      }}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg group-hover:scale-110 transition-all">
                        📊
                      </div>
                      <span className="text-xs font-medium">Poll</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input
              type="text"
              ref={inputRef}
              placeholder={
                uploading ? "Uploading media..." : "Type a message"
              }
              value={newMessage}
              disabled={uploading}
              onChange={handleTyping}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              className={`flex-1 min-w-0 px-4 py-3 text-sm sm:text-base rounded-2xl outline-none border focus:ring-1 focus:ring-[#00a884] transition-all disabled:opacity-50 select-text ${
                isDark
                  ? "bg-[#2a3942] border-transparent text-slate-100 placeholder-slate-400"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-xs"
              }`}
            />

            <button
              type="button"
              onClick={startRecording}
              disabled={uploading}
              className={`p-3 rounded-xl transition text-lg cursor-pointer flex-shrink-0 ${
                isDark
                  ? "hover:bg-[#374248] text-slate-400"
                  : "hover:bg-slate-200 text-slate-600"
              }`}
              title="Record Voice Note"
            >
              🎙️
            </button>

            <button
              onClick={sendMessage}
              disabled={uploading || (!newMessage.trim() && !attachedFile)}
              className="p-3 bg-[#00a884] hover:bg-[#019574] text-white rounded-2xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-xs flex-shrink-0"
              title="Send Message"
            >
              <svg
                className="w-5 h-5 fill-current transform rotate-45 -mr-0.5"
                viewBox="0 0 24 24"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {wallpaperModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border select-none ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>🖼️</span> Wallpaper
              </h3>
              <button
                onClick={() => setWallpaperModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              {PRESET_WALLPAPERS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleSelectWallpaper(p.value)}
                  className={`h-20 rounded-2xl border flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer shadow-xs ${
                    wallpaper === p.value
                      ? "ring-2 ring-[#00a884] border-transparent font-bold"
                      : isDark ? "border-slate-700/60" : "border-slate-200"
                  }`}
                  style={{
                    backgroundColor: p.value.startsWith("#")
                      ? p.value
                      : isDark
                        ? "#0b141a"
                        : "#efeae2",
                  }}
                >
                  <span className={`text-xs truncate w-full font-medium ${!p.value.startsWith("#") && !isDark ? "text-slate-800" : "text-slate-200"}`}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>

            <input
              type="file"
              ref={wallpaperInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleCustomWallpaperUpload}
            />

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => wallpaperInputRef.current?.click()}
                className="flex-1 py-3 bg-[#00a884] hover:bg-[#019574] text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
              >
                Upload Image
              </button>
              <button
                type="button"
                onClick={() => handleSelectWallpaper("default")}
                className={`py-3 px-4 rounded-xl text-sm font-semibold cursor-pointer border ${
                  isDark
                    ? "bg-[#111b21] border-[#2a3942] text-slate-200 hover:bg-[#182229]"
                    : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                }`}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border select-none ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="font-bold text-base mb-2">Delete message?</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {deleteModalMessage.isDeleted
                ? "This message is already deleted."
                : "Choose how to remove this message."}
            </p>

            <div className="flex flex-col gap-2.5">
              {!deleteModalMessage.isDeleted &&
                (() => {
                  const senderId = (
                    deleteModalMessage.sender?._id ||
                    deleteModalMessage.sender?.id ||
                    deleteModalMessage.sender
                  )?.toString();
                  const isOwner = senderId === myId;
                  const isGroup = selectedChat?.isGroupChat;
                  const isAdmin =
                    isGroup &&
                    selectedChat.groupAdmin &&
                    (
                      selectedChat.groupAdmin._id || selectedChat.groupAdmin
                    )?.toString() === myId;

                  const canDeleteForEveryone = isGroup
                    ? isAdmin || isOwner
                    : isOwner;

                  if (canDeleteForEveryone) {
                    return (
                      <button
                        type="button"
                        onClick={() => executeDelete("forEveryone")}
                        className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
                      >
                        Delete for everyone
                      </button>
                    );
                  }
                  return null;
                })()}

              <button
                type="button"
                onClick={() => executeDelete("forMe")}
                className={`w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border ${
                  isDark
                    ? "bg-[#111b21] border-[#2a3942] text-slate-200 hover:bg-[#182229]"
                    : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                }`}
              >
                Delete for me
              </button>

              <button
                type="button"
                onClick={() => setDeleteModalMessage(null)}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-medium mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border select-none ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="font-bold text-base mb-2">Delete {selectedMessageIds.length} messages?</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Choose how to remove the selected messages.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => executeBulkDelete("forEveryone")}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
              >
                Delete for everyone
              </button>

              <button
                type="button"
                onClick={() => executeBulkDelete("forMe")}
                className={`w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border ${
                  isDark
                    ? "bg-[#111b21] border-[#2a3942] text-slate-200 hover:bg-[#182229]"
                    : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                }`}
              >
                Delete for me
              </button>

              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-medium mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;