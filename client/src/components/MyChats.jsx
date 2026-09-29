import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";
import GroupChatModal from "./GroupChatModal";
import AddContactModal from "./AddContactModal";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const MyChats = ({
  fetchAgain,
  activeTab,
  setActiveTab,
  statuses = [],
  onOpenStatus,
}) => {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [activeMenuChatId, setActiveMenuChatId] = useState(null);
  const [activeMenuCallId, setActiveMenuCallId] = useState(null);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [savedContactsMap, setSavedContactsMap] = useState(new Map());

  const [filterCategory, setFilterCategory] = useState("all");

  const [viewedStatuses, setViewedStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem("viewedStatuses");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const mainDropdownRef = useRef(null);
  const navigate = useNavigate();

  const {
    selectedChat,
    setSelectedChat,
    user,
    setUser,
    chats,
    setChats,
    theme,
    toggleTheme,
    socket,
  } = useChatState();

  const isDark = theme === "dark";
  const currentUserId = user?._id || user?.id;

  // Fetch saved contacts map to check if a user is in address book
  const fetchSavedContactsMap = async () => {
    if (!user?.token) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.get(
        `${API_URL}/contacts`,
        config
      );

      const map = new Map();

      (data || []).forEach((c) => {
        const uId = (
          c.contactUser?._id || c.contactUser
        )?.toString();

        const phone = (
          c.phoneNumber ||
          c.contactUser?.phone ||
          ""
        )
          .replace(/\D/g, "")
          .slice(-10);

        if (uId) map.set(uId, c.savedName);
        if (phone) map.set(phone, c.savedName);
      });

      setSavedContactsMap(map);
    } catch (err) {
      console.error("Failed to fetch saved contacts map", err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchSavedContactsMap();
    }
  }, [user, addContactOpen]);

  const getSenderUser = (currentUser, users) => {
    if (!users || users.length < 2) return null;

    const currentId = currentUser?._id || currentUser?.id;

    const u0Id = (
      users[0]?._id || users[0]
    )?.toString();

    const u1Id = (
      users[1]?._id || users[1]
    )?.toString();

    if (u0Id === u1Id) {
      return null;
    }

    return u0Id === currentId?.toString()
      ? users[1]
      : users[0];
  };

  // Helper to determine display name
  const getDisplayChatName = (
    chat,
    currentUser,
    users
  ) => {
    if (chat.isGroupChat) return chat.chatName;

    if (chat.isAIBot) return "AI ChatBot";

    if (users && users.length === 2) {
      const u0Id = (
        users[0]?._id || users[0]
      )?.toString();

      const u1Id = (
        users[1]?._id || users[1]
      )?.toString();

      const currentId = (
        currentUser?._id || currentUser?.id
      )?.toString();

      if (
        u0Id === u1Id &&
        u0Id === currentId
      ) {
        return "You (You)";
      }
    }

    const sender = getSenderUser(
      currentUser,
      users
    );

    if (!sender) return "Unknown User";

    const sId = sender._id?.toString();

    const sPhone = (
      sender.phone || ""
    )
      .replace(/\D/g, "")
      .slice(-10);

    if (
      (sId && savedContactsMap.has(sId)) ||
      (sPhone && savedContactsMap.has(sPhone))
    ) {
      return sId && savedContactsMap.has(sId)
        ? savedContactsMap.get(sId)
        : savedContactsMap.get(sPhone);
    }

    return sender.phone
      ? `+91 ${sender.phone}`
      : sender.name || "Unknown User";
  };

  const getSender = (currentUser, users) => {
    return getDisplayChatName(
      {
        isGroupChat: false,
        isAIBot: false,
      },
      currentUser,
      users
    );
  };

  const statusMap = statuses.reduce(
    (acc, curr) => {
      const uId = curr.user?._id?.toString();

      if (!uId) return acc;

      if (!acc[uId]) {
        acc[uId] = {
          user: curr.user,
          items: [],
        };
      }

      acc[uId].items.push(curr);

      return acc;
    },
    {}
  );

  const myStatusGroup = currentUserId
    ? statusMap[currentUserId?.toString()]
    : null;

  const myHasUnviewedStatus =
    myStatusGroup &&
    myStatusGroup.items.length > 0 &&
    myStatusGroup.items.some(
      (item) => !viewedStatuses[item._id]
    );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setActiveMenuChatId(null);
        setActiveMenuCallId(null);
      }

      if (
        mainDropdownRef.current &&
        !mainDropdownRef.current.contains(e.target)
      ) {
        setMenuDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("userInfo");

    if (setUser) {
      setUser(null);
    }

    navigate("/");

    toast.success("Logged out successfully");
  };

  const fetchChats = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.get(
        `${API_URL}/chat`,
        config
      );

      setChats(data);
    } catch (error) {
      console.error(
        "Error fetching chats:",
        error
      );
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchChats();
    }
  }, [fetchAgain, user]);

  // ============================================================
  // REAL-TIME SOCKET LISTENERS (UI-specific only: Delete & Clear)
  // ============================================================

  useEffect(() => {
    if (!socket) return;

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

      if (!targetChatId || !messageId) {
        return;
      }

      const deletedPlaceholder = {
        ...(message || {}),
        _id: messageId,
        isDeleted: true,
        content:
          "🚫 This message was deleted",
      };

      setChats((prevChats) => {
        if (!prevChats) return prevChats;

        return prevChats.map((chat) => {
          if (
            chat._id?.toString() !==
            targetChatId
          ) {
            return chat;
          }

          return {
            ...chat,
            latestMessage:
              deletedPlaceholder,
          };
        });
      });
    };

    const handleChatCleared = ({
      chatId,
    }) => {
      const targetChatId =
        chatId?.toString();

      if (!targetChatId) return;

      setChats((prevChats) => {
        if (!prevChats) return prevChats;

        return prevChats.map((c) =>
          c._id?.toString() ===
          targetChatId
            ? {
                ...c,
                latestMessage: null,
                unreadCount: 0,
              }
            : c
        );
      });
    };

    socket.on(
      "message deleted",
      handleMessageDeleted
    );

    socket.on(
      "chat cleared",
      handleChatCleared
    );

    return () => {
      socket.off(
        "message deleted",
        handleMessageDeleted
      );

      socket.off(
        "chat cleared",
        handleChatCleared
      );
    };
  }, [
    socket,
    selectedChat,
    currentUserId,
  ]);

  // ============================================================
  // CLEAR CHAT
  // ============================================================

  const handleClearChat = async (
    chatId,
    e
  ) => {
    e.stopPropagation();

    setActiveMenuChatId(null);
    setActiveMenuCallId(null);

    toast(
      (t) => (
        <div className="flex flex-col gap-2.5 p-1">
          <p className="font-semibold text-xs tracking-tight">
            Clear all messages in this chat?
          </p>

          <div className="flex gap-2 justify-end">
            <button
              onClick={async () => {
                toast.dismiss(t.id);

                try {
                  const config = {
                    headers: {
                      Authorization: `Bearer ${user.token}`,
                    },
                  };

                  await axios.delete(
                    `${API_URL}/chat/clear/${chatId}`,
                    config
                  );

                  setChats(
                    chats.map((c) =>
                      c._id === chatId
                        ? {
                            ...c,
                            latestMessage: null,
                            unreadCount: 0,
                          }
                        : c
                    )
                  );

                  if (selectedChat?._id === chatId) {
                    setSelectedChat({
                      ...selectedChat,
                      latestMessage: null,
                    });
                  }

                  toast.success(
                    "Chat cleared successfully"
                  );
                } catch (err) {
                  console.error(
                    "Failed to clear chat:",
                    err
                  );

                  toast.error(
                    "Failed to clear chat"
                  );
                }
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Confirm
            </button>

            <button
              onClick={() =>
                toast.dismiss(t.id)
              }
              className="bg-slate-700/80 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      {
        duration: 6000,
      }
    );
  };

  // ============================================================
  // DELETE CHAT
  // ============================================================

  const handleDeleteChat = async (
    chatId,
    e
  ) => {
    e.stopPropagation();

    setActiveMenuChatId(null);

    toast(
      (t) => (
        <div className="flex flex-col gap-2.5 p-1">
          <p className="font-semibold text-xs tracking-tight">
            Delete this entire chat permanently?
          </p>

          <div className="flex gap-2 justify-end">
            <button
              onClick={async () => {
                toast.dismiss(t.id);

                try {
                  const config = {
                    headers: {
                      Authorization: `Bearer ${user.token}`,
                    },
                  };

                  await axios.delete(
                    `${API_URL}/chat/${chatId}`,
                    config
                  );

                  setChats(
                    chats.filter(
                      (c) =>
                        c._id !== chatId
                    )
                  );

                  if (
                    selectedChat?._id ===
                    chatId
                  ) {
                    setSelectedChat(null);
                  }

                  toast.success(
                    "Chat deleted successfully"
                  );
                } catch (err) {
                  console.error(
                    "Failed to delete chat:",
                    err
                  );

                  toast.error(
                    "Failed to delete chat"
                  );
                }
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Delete
            </button>

            <button
              onClick={() =>
                toast.dismiss(t.id)
              }
              className="bg-slate-700/80 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      {
        duration: 6000,
      }
    );
  };

  // ============================================================
  // PROFILE PHOTO
  // ============================================================

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(
        "Please select a valid image file"
      );
      return;
    }

    try {
      setUploading(true);

      const reader = new FileReader();

      reader.readAsDataURL(file);

      reader.onloadend = async () => {
        const base64Image =
          reader.result;

        const config = {
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        const { data } =
          await axios.put(
            `${API_URL}/auth/profile`,
            {
              profilePicture:
                base64Image,
            },
            config
          );

        const updatedUser = {
          ...user,
          profilePicture:
            data.profilePicture,
        };

        setUser(updatedUser);

        sessionStorage.setItem(
          "userInfo",
          JSON.stringify(updatedUser)
        );

        setUploading(false);

        toast.success(
          "Profile photo updated!"
        );
      };
    } catch (err) {
      console.error(
        "Failed to update profile picture:",
        err
      );

      toast.error(
        "Could not update profile photo"
      );

      setUploading(false);
    }
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const handleSearch = async (
    query
  ) => {
    setSearch(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);

      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } =
        await axios.get(
          `${API_URL}/contacts?search=${encodeURIComponent(
            query.trim()
          )}`,
          config
        );

      const seenPhones = new Set();
      const uniqueResults = [];

      (data || []).forEach((c) => {
        const p = (
          c.phoneNumber ||
          c.contactUser?.phone ||
          ""
        )
          .replace(/\D/g, "")
          .slice(-10);

        if (
          p &&
          !seenPhones.has(p)
        ) {
          seenPhones.add(p);
          uniqueResults.push(c);
        } else if (!p) {
          uniqueResults.push(c);
        }
      });

      setSearchResults(
        uniqueResults
      );
    } catch (error) {
      console.error(
        "Search error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ACCESS CHAT
  // ============================================================

  const accessChat = async (
    userId
  ) => {
    try {
      const config = {
        headers: {
          "Content-type":
            "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } =
        await axios.post(
          `${API_URL}/chat`,
          { userId },
          config
        );

      if (
        !chats.find(
          (c) => c._id === data._id
        )
      ) {
        setChats([
          data,
          ...chats,
        ]);
      }

      setSelectedChat(data);

      setSearch("");
      setSearchResults([]);
    } catch (error) {
      console.error(
        "Error accessing chat:",
        error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to open chat with this contact."
      );
    }
  };

  // ============================================================
  // UNREAD
  // ============================================================

  const isChatUnread = (chat) => {
    return (
      (Number(chat.unreadCount) || 0) >
      0
    );
  };

  // ============================================================
  // SELECT CHAT
  // ============================================================

  const handleSelectChat = async (
    chat
  ) => {
    const wasUnread =
      Number(chat.unreadCount) > 0;

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c._id === chat._id) {
          return {
            ...c,
            unreadCount: 0,
          };
        }

        return c;
      })
    );

    setSelectedChat(chat);

    setSearch("");
    setSearchResults([]);

    if (wasUnread) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        };

        await axios.put(
          `${API_URL}/message/read/${chat._id}`,
          {},
          config
        );
      } catch (error) {
        console.error(
          "Failed to mark messages as read",
          error
        );
      }
    }
  };

  // ============================================================
  // SORT CHATS
  // ============================================================

  const sortedChats = chats
    ? [...chats].sort((a, b) => {
        const dateStrA =
          a.latestMessage?.createdAt ||
          a.updatedAt ||
          a.createdAt;

        const dateStrB =
          b.latestMessage?.createdAt ||
          b.updatedAt ||
          b.createdAt;

        const timeA = dateStrA
          ? new Date(
              dateStrA
            ).getTime()
          : 0;

        const timeB = dateStrB
          ? new Date(
              dateStrB
            ).getTime()
          : 0;

        return timeB - timeA;
      })
    : [];

  const unreadCount = chats
    ? chats.filter(
        (c) => isChatUnread(c)
      ).length
    : 0;

  const favouritesCount = chats
    ? chats.filter(
        (c) => c.isFavourite
      ).length
    : 0;

  const groupsCount = chats
    ? chats.filter(
        (c) => c.isGroupChat
      ).length
    : 0;

  const filteredChats = sortedChats
    ? sortedChats.filter((chat) => {
        if (
          filterCategory ===
          "unread"
        ) {
          return isChatUnread(chat);
        }

        if (
          filterCategory ===
          "favourites"
        ) {
          return chat.isFavourite;
        }

        if (
          filterCategory === "groups"
        ) {
          return chat.isGroupChat;
        }

        return true;
      })
    : [];

  const searchedExistingChats = search.trim()
    ? sortedChats.filter((chat) => {
        const query =
          search.toLowerCase();

        if (
          chat.isGroupChat &&
          chat.chatName
        ) {
          return chat.chatName
            .toLowerCase()
            .includes(query);
        }

        if (chat.isAIBot) {
          return (
            "meta ai".includes(query) ||
            "ai".includes(query)
          );
        }

        const senderName =
          getSender(
            user,
            chat.users
          )?.toLowerCase() || "";

        return senderName.includes(
          query
        );
      })
    : [];

  const existingChatUserIds =
    new Set();

  searchedExistingChats.forEach(
    (chat) => {
      if (
        !chat.isGroupChat &&
        !chat.isAIBot &&
        chat.users
      ) {
        const partnerObj =
          getSenderUser(
            user,
            chat.users
          );

        if (partnerObj?._id) {
          existingChatUserIds.add(
            partnerObj._id.toString()
          );
        }
      }
    }
  );

  const uniqueSearchResults =
    searchResults.filter(
      (contact) => {
        const contactUserId = (
          contact.contactUser?._id ||
          contact.contactUser
        )?.toString();

        return (
          !contactUserId ||
          !existingChatUserIds.has(
            contactUserId
          )
        );
      }
    );

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors duration-300 select-none ${
        isDark
          ? "bg-[#03060c] text-slate-100"
          : "bg-white text-slate-900"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      <GroupChatModal
        isOpen={groupModalOpen}
        onClose={() =>
          setGroupModalOpen(false)
        }
      />

      <AddContactModal
        isOpen={addContactOpen}
        onClose={() =>
          setAddContactOpen(false)
        }
        onContactAdded={() => {
          fetchChats();
        }}
      />

      {/* Header */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between flex-shrink-0 backdrop-blur-2xl transition-colors duration-300 ${
          isDark
            ? "bg-[#060a12]/95 border-slate-800/60 shadow-xl shadow-black/30"
            : "bg-slate-50/95 border-slate-200/90 shadow-xs"
        }`}
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div
            onClick={() => {
              if (
                myStatusGroup &&
                myStatusGroup.items
                  .length > 0
              ) {
                const updated = {
                  ...viewedStatuses,
                };

                myStatusGroup.items.forEach(
                  (item) => {
                    if (item._id) {
                      updated[item._id] =
                        true;
                    }
                  }
                );

                setViewedStatuses(
                  updated
                );

                localStorage.setItem(
                  "viewedStatuses",
                  JSON.stringify(
                    updated
                  )
                );

                onOpenStatus(
                  myStatusGroup
                );
              } else {
                fileInputRef.current?.click();
              }
            }}
            title={
              myStatusGroup &&
              myStatusGroup.items
                .length > 0
                ? "View your status"
                : "Update profile photo"
            }
            className={`relative w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center bg-gradient-to-tr from-teal-500 via-emerald-400 to-teal-400 text-white font-bold text-base flex-shrink-0 cursor-pointer group shadow-lg shadow-teal-500/20 transition-transform active:scale-95 ${
              myHasUnviewedStatus
                ? isDark
                  ? "p-0.5 ring-2 ring-teal-500 ring-offset-2 ring-offset-[#060a12]"
                  : "p-0.5 ring-2 ring-teal-600 ring-offset-2 ring-offset-white"
                : isDark
                ? "p-0.5 border-2 border-slate-700/60"
                : "p-0.5 border-2 border-slate-200"
            }`}
          >
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={
                  user?.name ||
                  "Avatar"
                }
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              user?.name
                ?.charAt(0)
                .toUpperCase() || "U"
            )}

            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-xs text-white">
              {uploading
                ? "..."
                : "📷"}
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <span
              className={`text-xs font-extrabold tracking-tight truncate ${
                isDark
                  ? "text-slate-100"
                  : "text-slate-900"
              }`}
            >
              {user?.name ||
                "My Account"}
            </span>

            <span
              className={`text-[10px] font-mono font-semibold truncate mt-0.5 ${
                isDark
                  ? "text-teal-400"
                  : "text-teal-600"
              }`}
            >
              {user?.phone
                ? `+91 ${user.phone}`
                : "Online Profile"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2.5 rounded-2xl transition-all text-sm cursor-pointer shadow-xs active:scale-95 ${
              isDark
                ? "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80"
                : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
            }`}
            title={`Switch to ${
              isDark
                ? "Light"
                : "Dark"
            } Mode`}
          >
            {isDark ? "☀️" : "🌙"}
          </button>

          <div
            className="relative"
            ref={mainDropdownRef}
          >
            <button
              type="button"
              onClick={() =>
                setMenuDropdownOpen(
                  !menuDropdownOpen
                )
              }
              className={`p-2.5 rounded-2xl transition-all text-sm cursor-pointer shadow-xs active:scale-95 ${
                isDark
                  ? "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80"
                  : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
              }`}
              title="Menu Options"
            >
              ⋮
            </button>

            {menuDropdownOpen && (
              <div
                className={`absolute right-0 mt-2 w-48 rounded-2xl shadow-2xl border py-2 z-50 text-xs backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150 ${
                  isDark
                    ? "bg-[#080d16]/95 border-slate-800/80 text-slate-200 shadow-black/90"
                    : "bg-white border-slate-200 text-slate-800 shadow-xl"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuDropdownOpen(
                      false
                    );
                    setGroupModalOpen(
                      true
                    );
                  }}
                  className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2.5 font-semibold ${
                    isDark
                      ? "hover:bg-slate-800/50"
                      : "hover:bg-slate-100"
                  }`}
                >
                  <span>👥</span>{" "}
                  New group
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuDropdownOpen(
                      false
                    );
                    setAddContactOpen(
                      true
                    );
                  }}
                  className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2.5 font-semibold ${
                    isDark
                      ? "hover:bg-slate-800/50"
                      : "hover:bg-slate-100"
                  }`}
                >
                  <span>➕</span>{" "}
                  New contact
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`px-3.5 py-2 text-xs rounded-2xl transition-all font-bold border cursor-pointer shadow-xs active:scale-95 ${
              isDark
                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20"
                : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
            }`}
            title="Log out of account"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className={`flex border-b text-xs font-semibold transition-colors duration-300 ${
          isDark
            ? "border-slate-800/60 bg-[#04070e]"
            : "border-slate-200/90 bg-slate-100/70"
        }`}
      >
        <button
          onClick={() =>
            setActiveTab &&
            setActiveTab("chats")
          }
          className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 ${
            !activeTab ||
            activeTab === "chats"
              ? isDark
                ? "border-teal-500 text-teal-400 font-extrabold bg-teal-500/5"
                : "border-teal-600 text-teal-700 font-extrabold bg-teal-50"
              : isDark
              ? "border-transparent text-slate-400 hover:text-slate-200"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          💬 Chats
        </button>

        <button
          onClick={() =>
            setActiveTab &&
            setActiveTab("status")
          }
          className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 ${
            activeTab === "status"
              ? isDark
                ? "border-teal-500 text-teal-400 font-extrabold bg-teal-500/5"
                : "border-teal-600 text-teal-700 font-extrabold bg-teal-50"
              : isDark
              ? "border-transparent text-slate-400 hover:text-slate-200"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          ⭕ Status
        </button>

        <button
          onClick={() =>
            setActiveTab &&
            setActiveTab("calls")
          }
          className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 ${
            activeTab === "calls"
              ? isDark
                ? "border-teal-500 text-teal-400 font-extrabold bg-teal-500/5"
                : "border-teal-600 text-teal-700 font-extrabold bg-teal-50"
              : isDark
              ? "border-transparent text-slate-400 hover:text-slate-200"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          📞 Calls
        </button>
      </div>

      {/* Search */}
      <div
        className={`p-3.5 border-b transition-colors duration-300 ${
          isDark
            ? "bg-[#03060c] border-slate-800/60"
            : "bg-white border-slate-200/80"
        }`}
      >
        <div
          className={`flex items-center rounded-2xl px-3.5 py-2.5 border transition-all ${
            isDark
              ? "bg-[#070b14] border-slate-800/80 text-slate-100 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20"
              : "bg-slate-50 border-slate-200 text-slate-900 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20"
          }`}
        >
          <span className="text-sm mr-2.5 opacity-70">
            🔍
          </span>

          <input
            type="text"
            placeholder="Search chats or saved contacts..."
            value={search}
            onChange={(e) =>
              handleSearch(
                e.target.value
              )
            }
            className={`w-full bg-transparent text-xs outline-none font-medium ${
              isDark
                ? "text-slate-100 placeholder-slate-500"
                : "text-slate-900 placeholder-slate-400"
            }`}
          />

          {search && (
            <button
              onClick={() =>
                handleSearch("")
              }
              className={`text-xs px-2 py-0.5 rounded-xl cursor-pointer transition font-bold ${
                isDark
                  ? "bg-slate-800 text-slate-400 hover:text-slate-200"
                  : "bg-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      <div
        className={`px-4 py-2.5 flex items-center gap-2 overflow-x-auto border-b scrollbar-none transition-colors duration-300 ${
          isDark
            ? "border-slate-800/50 bg-[#03060c]"
            : "border-slate-200/80 bg-slate-50/70"
        }`}
      >
        <button
          onClick={() =>
            setFilterCategory("all")
          }
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-xs ${
            filterCategory === "all"
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-teal-500/20"
              : isDark
              ? "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          All
        </button>

        <button
          onClick={() =>
            setFilterCategory(
              "unread"
            )
          }
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
            filterCategory === "unread"
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-teal-500/20"
              : isDark
              ? "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Unread{" "}
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                filterCategory ===
                "unread"
                  ? "bg-white/30 text-white"
                  : isDark
                  ? "bg-slate-800 text-teal-400"
                  : "bg-slate-200 text-teal-700"
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() =>
            setFilterCategory(
              "favourites"
            )
          }
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
            filterCategory ===
            "favourites"
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-teal-500/20"
              : isDark
              ? "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Favourites{" "}
          {favouritesCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                filterCategory ===
                "favourites"
                  ? "bg-white/30 text-white"
                  : isDark
                  ? "bg-slate-800 text-teal-400"
                  : "bg-slate-200 text-teal-700"
              }`}
            >
              {favouritesCount}
            </span>
          )}
        </button>

        <button
          onClick={() =>
            setFilterCategory(
              "groups"
            )
          }
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
            filterCategory === "groups"
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-teal-500/20"
              : isDark
              ? "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Groups{" "}
          {groupsCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                filterCategory ===
                "groups"
                  ? "bg-white/30 text-white"
                  : isDark
                  ? "bg-slate-800 text-teal-400"
                  : "bg-slate-200 text-teal-700"
              }`}
            >
              {groupsCount}
            </span>
          )}
        </button>
      </div>

      {/* Section Header */}
      <div
        className={`px-5 py-2.5 flex items-center justify-between border-b text-xs transition-colors duration-300 ${
          isDark
            ? "border-slate-800/50 text-slate-400 bg-[#03060c]/50"
            : "border-slate-200/80 text-slate-500 bg-slate-50/70"
        }`}
      >
        <span className="uppercase tracking-wider font-extrabold text-[10px]">
          {search
            ? "Search Results (Chats & Contacts)"
            : `${filterCategory.toUpperCase()} CHATS`}
        </span>

        <button
          type="button"
          onClick={() =>
            setAddContactOpen(true)
          }
          className={`font-bold tracking-wide cursor-pointer flex items-center gap-1.5 transition-colors ${
            isDark
              ? "text-teal-400 hover:text-teal-300"
              : "text-teal-600 hover:text-teal-700"
          }`}
        >
          <span>+</span> Add Contact
        </button>
      </div>

      {/* Chat List */}
      <div
        className={`flex-1 overflow-y-auto divide-y transition-colors duration-300 ${
          isDark
            ? "divide-slate-800/40"
            : "divide-slate-100"
        }`}
      >
        {search &&
        (searchedExistingChats.length >
          0 ||
          uniqueSearchResults.length >
            0) ? (
          <>
            {searchedExistingChats.length >
              0 && (
              <div className="py-1">
                <div
                  className={`px-5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    isDark
                      ? "text-teal-400 bg-[#060a12]/50"
                      : "text-teal-600 bg-teal-50/50"
                  }`}
                >
                  Existing Chats & Groups
                </div>

                {searchedExistingChats.map(
                  (chat) => {
                    const isSelected =
                      selectedChat?._id ===
                      chat._id;

                    const isItemSelfChat =
                      !chat.isGroupChat &&
                      !chat.isAIBot &&
                      chat.users &&
                      chat.users.length ===
                        2 &&
                      (
                        chat.users[0]?._id ||
                        chat.users[0]
                      )?.toString() ===
                        (
                          chat.users[1]?._id ||
                          chat.users[1]
                        )?.toString() &&
                      (
                        chat.users[0]?._id ||
                        chat.users[0]
                      )?.toString() ===
                        currentUserId?.toString();

                    const senderUser =
                      !chat.isGroupChat &&
                      !chat.isAIBot &&
                      !isItemSelfChat
                        ? getSenderUser(
                            user,
                            chat.users
                          )
                        : null;

                    const chatDisplayName =
                      isItemSelfChat
                        ? "You (You)"
                        : getDisplayChatName(
                            chat,
                            user,
                            chat.users
                          );

                    return (
                      <div
                        key={`chat-match-${chat._id}`}
                        onClick={() =>
                          handleSelectChat(
                            chat
                          )
                        }
                        className={`flex items-center px-5 py-3.5 cursor-pointer transition-colors ${
                          isSelected
                            ? isDark
                              ? "bg-[#0b1322]"
                              : "bg-slate-100"
                            : isDark
                            ? "hover:bg-[#070b14]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-tr from-teal-500 to-emerald-400 text-white flex items-center justify-center text-sm mr-3.5 flex-shrink-0 font-bold shadow-md shadow-teal-500/20 border border-teal-400/20">
                          {isItemSelfChat ? (
                            user?.profilePicture ? (
                              <img
                                src={
                                  user.profilePicture
                                }
                                alt="You"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              "👤"
                            )
                          ) : chat.isAIBot ? (
                            "🤖"
                          ) : chat.isGroupChat ? (
                            chat.groupImage ? (
                              <img
                                src={
                                  chat.groupImage
                                }
                                alt={
                                  chat.chatName
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#53646f] flex items-center justify-center">
                                <svg
                                  viewBox="0 0 24 24"
                                  className="w-6 h-6 fill-[#cfd6dc]"
                                >
                                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                                </svg>
                              </div>
                            )
                          ) : senderUser?.profilePicture ? (
                            <img
                              src={
                                senderUser.profilePicture
                              }
                              alt={
                                senderUser.name
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            chatDisplayName
                              .charAt(0)
                              .toUpperCase() ||
                            "U"
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4
                            className={`text-xs font-bold truncate mb-0.5 ${
                              isDark
                                ? "text-slate-100"
                                : "text-slate-900"
                            }`}
                          >
                            {chatDisplayName}
                          </h4>

                          <p
                            className={`text-[11px] truncate ${
                              isDark
                                ? "text-slate-400"
                                : "text-slate-500"
                            }`}
                          >
                            {chat.isGroupChat
                              ? "Group Chat"
                              : chat.isAIBot
                              ? "AI Assistant"
                              : isItemSelfChat
                              ? "Message yourself"
                              : "Direct Chat"}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {uniqueSearchResults.length >
              0 && (
              <div className="py-1">
                <div
                  className={`px-5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    isDark
                      ? "text-teal-400 bg-[#060a12]/50"
                      : "text-teal-600 bg-teal-50/50"
                  }`}
                >
                  Contacts Directory
                </div>

                {uniqueSearchResults.map(
                  (contact) => {
                    const contactUserObj =
                      contact.contactUser ||
                      {};

                    const displayName =
                      contact.savedName ||
                      contactUserObj.name ||
                      "Unknown Contact";

                    const displayPhone =
                      contact.phoneNumber ||
                      contactUserObj.phone ||
                      "";

                    const targetUserId =
                      contactUserObj._id ||
                      contact.contactUser;

                    return (
                      <div
                        key={contact._id}
                        onClick={() =>
                          targetUserId &&
                          accessChat(
                            targetUserId
                          )
                        }
                        className={`flex items-center px-5 py-3.5 cursor-pointer transition-colors ${
                          isDark
                            ? "hover:bg-[#070b14]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-tr from-teal-500 to-emerald-400 text-white flex items-center justify-center text-sm mr-3.5 flex-shrink-0 font-bold shadow-md shadow-teal-500/20 border border-teal-400/20">
                          {contactUserObj.profilePicture ? (
                            <img
                              src={
                                contactUserObj.profilePicture
                              }
                              alt={
                                displayName
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            displayName
                              .charAt(0)
                              .toUpperCase()
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4
                            className={`text-xs font-bold truncate mb-0.5 ${
                              isDark
                                ? "text-slate-100"
                                : "text-slate-900"
                            }`}
                          >
                            {displayName}
                          </h4>

                          <p
                            className={`text-[11px] font-mono truncate ${
                              isDark
                                ? "text-slate-400"
                                : "text-slate-500"
                            }`}
                          >
                            {displayPhone
                              ? `+91 ${displayPhone}`
                              : contactUserObj.email}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </>
        ) : search &&
          !loading ? (
          <div
            className={`p-8 text-center text-xs font-medium ${
              isDark
                ? "text-slate-400"
                : "text-slate-500"
            }`}
          >
            No chats or saved contacts found
            matching this query.
          </div>
        ) : filteredChats.length ===
          0 ? (
          <div
            className={`p-8 text-center text-xs font-medium ${
              isDark
                ? "text-slate-400"
                : "text-slate-500"
            }`}
          >
            No chats found in this category.
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected =
              selectedChat?._id ===
              chat._id;

            const isItemSelfChat =
              !chat.isGroupChat &&
              !chat.isAIBot &&
              chat.users &&
              chat.users.length === 2 &&
              (
                chat.users[0]?._id ||
                chat.users[0]
              )?.toString() ===
                (
                  chat.users[1]?._id ||
                  chat.users[1]
                )?.toString() &&
              (
                chat.users[0]?._id ||
                chat.users[0]
              )?.toString() ===
                currentUserId?.toString();

            const senderUser =
              !chat.isGroupChat &&
              !chat.isAIBot &&
              !isItemSelfChat
                ? getSenderUser(
                    user,
                    chat.users
                  )
                : null;

            const senderStatusGroup =
              senderUser
                ? statusMap[
                    senderUser._id?.toString()
                  ]
                : null;

            const latestStatusId =
              senderStatusGroup
                ?.items?.[
                senderStatusGroup.items
                  .length - 1
              ]?._id;

            const hasUnviewedStatus =
              senderStatusGroup &&
              senderStatusGroup.items
                .length > 0 &&
              (!latestStatusId ||
                !viewedStatuses[
                  latestStatusId
                ]);

            const unread =
              isChatUnread(chat);

            const displayCount =
              Number(
                chat.unreadCount
              ) || 0;

            const chatDisplayName =
              isItemSelfChat
                ? "You (You)"
                : getDisplayChatName(
                    chat,
                    user,
                    chat.users
                  );

            return (
              <div
                key={chat._id}
                onClick={() =>
                  handleSelectChat(chat)
                }
                className={`relative flex items-center px-5 py-3.5 cursor-pointer transition-colors ${
                  isSelected
                    ? isDark
                      ? "bg-[#0b1322] border-l-4 border-teal-500"
                      : "bg-slate-100 border-l-4 border-teal-600"
                    : isDark
                    ? "hover:bg-[#070b14]"
                    : "hover:bg-slate-50"
                }`}
              >
                <div
                  onClick={(e) => {
                    if (
                      senderStatusGroup &&
                      senderStatusGroup.items
                        .length > 0
                    ) {
                      e.stopPropagation();

                      if (latestStatusId) {
                        const updated = {
                          ...viewedStatuses,
                          [latestStatusId]:
                            true,
                        };

                        setViewedStatuses(
                          updated
                        );

                        localStorage.setItem(
                          "viewedStatuses",
                          JSON.stringify(
                            updated
                          )
                        );
                      }

                      onOpenStatus(
                        senderStatusGroup
                      );

                      return;
                    }

                    handleSelectChat(chat);
                  }}
                  title={
                    hasUnviewedStatus
                      ? "View status update"
                      : "Open chat"
                  }
                  className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center text-sm mr-3.5 flex-shrink-0 font-bold shadow-xs cursor-pointer transition-transform hover:scale-105 ${
                    hasUnviewedStatus
                      ? isDark
                        ? "p-0.5 ring-2 ring-teal-500 ring-offset-2 ring-offset-[#03060c]"
                        : "p-0.5 ring-2 ring-teal-600 ring-offset-2 ring-offset-white"
                      : senderStatusGroup &&
                        senderStatusGroup.items
                          .length > 0
                      ? isDark
                        ? "p-0.5 border-2 border-slate-600/60"
                        : "p-0.5 border-2 border-slate-300"
                      : isDark
                      ? "border border-slate-700/50"
                      : "border border-slate-200"
                  } ${
                    isDark
                      ? "bg-slate-900 text-slate-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-xl overflow-hidden flex items-center justify-center ${
                      isDark
                        ? "bg-slate-800 text-white"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {isItemSelfChat ? (
                      user?.profilePicture ? (
                        <img
                          src={
                            user.profilePicture
                          }
                          alt="You"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        "👤"
                      )
                    ) : chat.isAIBot ? (
                      "🤖"
                    ) : chat.isGroupChat ? (
                      chat.groupImage ? (
                        <img
                          src={
                            chat.groupImage
                          }
                          alt={
                            chat.chatName ||
                            "Group"
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#53646f] flex items-center justify-center">
                          <svg
                            viewBox="0 0 24 24"
                            className="w-6 h-6 fill-[#cfd6dc]"
                          >
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                          </svg>
                        </div>
                      )
                    ) : senderUser?.profilePicture ? (
                      <img
                        src={
                          senderUser.profilePicture
                        }
                        alt={
                          senderUser.name ||
                          "Sender"
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      chatDisplayName
                        .charAt(0)
                        .toUpperCase() ||
                      "U"
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4
                      className={`text-xs truncate ${
                        unread
                          ? isDark
                            ? "font-extrabold text-emerald-400"
                            : "font-extrabold text-emerald-600"
                          : isDark
                          ? "font-bold text-teal-400"
                          : "font-bold text-slate-900"
                      }`}
                    >
                      {chatDisplayName}
                    </h4>

                    <span
                      className={`text-[10px] font-mono flex-shrink-0 ml-2 ${
                        unread
                          ? isDark
                            ? "text-emerald-400 font-bold"
                            : "text-emerald-600 font-bold"
                          : isDark
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      {chat.latestMessage
                        ? new Date(
                            chat.latestMessage.createdAt
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : chat.isAIBot
                        ? "Assistant"
                        : isItemSelfChat
                        ? "Personal"
                        : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p
                      className={`text-[11px] truncate font-normal ${
                        unread
                          ? isDark
                            ? "font-semibold text-slate-200"
                            : "font-semibold text-slate-900"
                          : isDark
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      {chat.latestMessage
                        ?.isDeleted
                        ? "🚫 This message was deleted"
                        : chat.latestMessage
                            ?.content ||
                          (chat.isAIBot
                            ? "Ask me anything..."
                            : isItemSelfChat
                            ? "Message yourself"
                            : "Tap to start conversation...")}
                    </p>

                    {displayCount >
                      0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 ml-2 min-w-[20px] shadow-xs">
                        {displayCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-Dots Context Menu Button */}
                <div className="absolute right-3.5 top-3.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();

                      setActiveMenuCallId(
                        activeMenuCallId ===
                          chat._id
                          ? null
                          : chat._id
                      );
                    }}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all text-xs font-bold cursor-pointer ${
                      isDark
                        ? "text-slate-400 hover:text-white hover:bg-slate-800"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/80"
                    }`}
                  >
                    ⋮
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuCallId ===
                    chat._id && (
                    <div
                      ref={menuRef}
                      className={`absolute right-0 mt-1.5 w-42 rounded-2xl shadow-2xl border py-2 z-50 text-xs backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150 ${
                        isDark
                          ? "bg-[#080d16]/95 border-slate-800/80 text-slate-200 shadow-black/90"
                          : "bg-white border-slate-200 text-slate-800 shadow-xl"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) =>
                          handleClearChat(
                            chat._id,
                            e
                          )
                        }
                        className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2.5 font-semibold cursor-pointer ${
                          isDark
                            ? "hover:bg-slate-800/50 text-slate-200"
                            : "hover:bg-slate-100 text-slate-800"
                        }`}
                      >
                        🧹 Clear chat
                      </button>

                      <button
                        type="button"
                        onClick={(e) =>
                          handleDeleteChat(
                            chat._id,
                            e
                          )
                        }
                        className={`w-full text-left px-4 py-2.5 text-rose-500 transition-colors flex items-center gap-2.5 font-semibold cursor-pointer ${
                          isDark
                            ? "hover:bg-slate-800/50"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        🗑️ Delete chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MyChats;