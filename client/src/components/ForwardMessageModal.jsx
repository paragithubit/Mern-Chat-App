import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

const ForwardMessageModal = ({ isOpen, onClose, onForward }) => {
  const { chats, user, theme, setSelectedChat } = useChatState();
  const [selectedTargetIds, setSelectedTargetIds] = useState([]); // Array of selected target identifiers
  const [savedContactsList, setSavedContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDark = theme === "dark";

  const currentUserId = user?._id || user?.id;

  useEffect(() => {
    if (isOpen && user?.token) {
      fetchSavedContacts();
    }
    if (!isOpen) {
      setSelectedTargetIds([]);
      setIsSubmitting(false);
    }
  }, [isOpen, user]);

  const fetchSavedContacts = async () => {
    try {
      setLoadingContacts(true);
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.get(
        "http://localhost:7000/api/users/directory",
        config
      );
      setSavedContactsList(data);
    } catch (err) {
      console.error("Failed to fetch saved contacts for forwarding", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const getChatName = (chat) => {
    if (chat.isGroupChat) return chat.chatName;
    const partner = chat.users?.find(
      (u) => (u._id || u?.id)?.toString() !== currentUserId?.toString()
    );
    return partner?.name || "Chat";
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) return chat.groupImage || null;
    const partner = chat.users?.find(
      (u) => (u._id || u?.id)?.toString() !== currentUserId?.toString()
    );
    return partner?.profilePicture || null;
  };

  // Check if self chat room already exists in current chats
  const selfChatRoom = chats ? chats.find(
    (c) => !c.isGroupChat && c.users?.length === 2 && (c.users[0]?._id || c.users[0])?.toString() === (c.users[1]?._id || c.users[1])?.toString() && (c.users[0]?._id || c.users[0])?.toString() === currentUserId?.toString()
  ) : null;

  // Toggle selection for checkboxes
  const handleToggleSelect = (targetKey) => {
    setSelectedTargetIds((prev) =>
      prev.includes(targetKey)
        ? prev.filter((id) => id !== targetKey)
        : [...prev, targetKey]
    );
  };

  const handleExecuteForward = async () => {
    if (selectedTargetIds.length === 0 || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      for (const targetKey of selectedTargetIds) {
        let chatIdToForward = targetKey;

        // If user selected "You (You)" personal space
        if (targetKey === "self_chat_target") {
          if (selfChatRoom) {
            chatIdToForward = selfChatRoom._id;
          } else {
            try {
              const { data: newSelfChat } = await axios.post(
                "http://localhost:7000/api/chat",
                { userId: currentUserId },
                config
              );
              chatIdToForward = newSelfChat._id;
            } catch (selfErr) {
              console.error("Failed to initialize self chat for forwarding:", selfErr);
              continue;
            }
          }
        } 
        // If targetKey is a contact user ID rather than an existing chat ID
        else if (targetKey.startsWith("user_")) {
          const userId = targetKey.replace("user_", "");
          try {
            const { data: newChat } = await axios.post(
              "http://localhost:7000/api/chat",
              { userId },
              config
            );
            chatIdToForward = newChat._id;
          } catch (chatErr) {
            console.error("Failed to initialize chat for contact:", chatErr);
            continue;
          }
        }

        await onForward(chatIdToForward);
      }

      toast.success("Message forwarded successfully!");
      onClose();
    } catch (err) {
      console.error("Error executing bulk forward:", err);
      toast.error("Failed to forward message to some recipients.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
          isDark
            ? "bg-[#111722] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-700/40">
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>↗️</span> Forward Message to...
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-3 pr-1 mb-5">
          {/* Section 0: Personal Space / Message Yourself */}
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1">
              Personal Space
            </p>
            <div
              onClick={() => handleToggleSelect("self_chat_target")}
              className={`flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all ${
                selectedTargetIds.includes("self_chat_target")
                  ? "border-teal-500 bg-teal-500/20 shadow-sm"
                  : isDark
                  ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/70"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTargetIds.includes("self_chat_target")}
                onChange={() => {}}
                className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
              />
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="You" className="w-full h-full object-cover" />
                ) : (
                  "👤"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-teal-400">You (You)</p>
                <p className="text-[10px] text-slate-400 truncate">Message yourself</p>
              </div>
            </div>
          </div>

          {/* Section 1: Active Conversations */}
          <div className="pt-2 border-t border-slate-700/30">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1">
              Recent Chats
            </p>
            <div className="space-y-2">
              {chats
                .filter((chat) => {
                  const isItemSelfChat =
                    chat.users &&
                    chat.users.length === 2 &&
                    (chat.users[0]?._id || chat.users[0])?.toString() ===
                      (chat.users[1]?._id || chat.users[1])?.toString() &&
                    (chat.users[0]?._id || chat.users[0])?.toString() ===
                      currentUserId?.toString();
                  return !isItemSelfChat && !chat.isAIBot;
                })
                .map((chat) => {
                  const name = getChatName(chat);
                  const avatar = getChatAvatar(chat);
                  const targetKey = chat._id;
                  const isChecked = selectedTargetIds.includes(targetKey);

                  return (
                    <div
                      key={chat._id}
                      onClick={() => handleToggleSelect(targetKey)}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? "border-teal-500 bg-teal-500/20 shadow-sm"
                          : isDark
                          ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/70"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                      />

                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {avatar ? (
                          <img src={avatar} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {chat.isGroupChat ? "Group Chat" : "Direct Message"}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Section 2: Saved Phone Contacts Directory */}
          <div className="pt-2 border-t border-slate-700/30">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 px-1">
              Saved Contacts
            </p>
            {loadingContacts ? (
              <div className="text-center py-4 text-xs text-slate-400 animate-pulse">
                Loading contacts...
              </div>
            ) : savedContactsList.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                No saved contacts found.
              </div>
            ) : (
              <div className="space-y-2">
                {savedContactsList.map((c) => {
                  const avatar = c.contactUser?.profilePicture;
                  const name = c.savedName;
                  const phone = c.phoneNumber || c.contactUser?.phone;
                  const targetUserObjId = c.contactUser?._id || c.contactUser;
                  if (!targetUserObjId) return null;

                  const targetKey = `user_${targetUserObjId}`;
                  const isChecked = selectedTargetIds.includes(targetKey);

                  return (
                    <div
                      key={c._id}
                      onClick={() => handleToggleSelect(targetKey)}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? "border-teal-500 bg-teal-500/20 shadow-sm"
                          : isDark
                          ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/70"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                      />

                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {avatar ? (
                          <img src={avatar} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{name}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          {phone ? `+91 ${phone}` : "Saved Contact"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={selectedTargetIds.length === 0 || isSubmitting}
            onClick={handleExecuteForward}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Forwarding..." : `Forward (${selectedTargetIds.length})`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`py-3 px-4 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              isDark
                ? "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal;