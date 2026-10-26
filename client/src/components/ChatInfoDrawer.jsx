import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

const CLOUDINARY_CLOUD_NAME = "qhyxgx1b";
const CLOUDINARY_PRESET = "chat_upload";

// Automatically switches between local development and your live Render backend
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://chat-app-backend-1-ib4u.onrender.com/api";

const ChatInfoDrawer = ({
  isOpen,
  onClose,
  messages = [],
  onBlockToggle,
  isBlocked,
  onDeleteChat,
  onClearChat,
  onOpenMediaDrawer,
}) => {
  const { selectedChat, setSelectedChat, user, theme, setChats, chats, socket } =
    useChatState();
  const isDark = theme === "dark";

  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [loadingTimer, setLoadingTimer] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Group Admin Management States
  const [groupChatName, setGroupChatName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [searchContact, setSearchContact] = useState("");
  const [savedContactsList, setSavedContactsList] = useState([]);
  const [savedContactsMap, setSavedContactsMap] = useState(new Map());
  const [groupActionLoading, setGroupActionLoading] = useState(false);

  const groupImageInputRef = useRef(null);

  const myId = (user?._id || user?.id)?.toString();

  // Fetch user's saved contacts so participant names & Add Member use ONLY saved contacts
  useEffect(() => {
    if (!isOpen || !user?.token) return;

    const fetchSavedContacts = async () => {
      try {
        const config = {
          headers: { Authorization: `Bearer ${user.token}` },
        };
        const { data } = await axios.get(`${API_URL}/contacts`, config);

        const map = new Map();
        const list = [];
        const seenIds = new Set();

        (data || []).forEach((c) => {
          const uId = (c.contactUser?._id || c.contactUser)?.toString();
          const phone = (c.phoneNumber || c.contactUser?.phone || "")
            .replace(/\D/g, "")
            .slice(-10);

          if (uId) map.set(uId, c.savedName);
          if (phone) map.set(phone, c.savedName);

          if (uId && !seenIds.has(uId) && uId !== myId) {
            seenIds.add(uId);
            list.push(c);
          }
        });

        setSavedContactsMap(map);
        setSavedContactsList(list);
      } catch (err) {
        console.error("Failed to fetch saved contacts in drawer:", err);
      }
    };

    fetchSavedContacts();
  }, [isOpen, user, myId]);

  if (!isOpen || !selectedChat) return null;

  // Helper to resolve saved contact name
  const getSavedUserName = (u) => {
    if (!u) return "User";
    const uId = (u._id || u.id || u)?.toString();
    if (uId === myId) return "You";

    const uPhone = (u.phone || "").replace(/\D/g, "").slice(-10);
    if (uId && savedContactsMap.has(uId)) return savedContactsMap.get(uId);
    if (uPhone && savedContactsMap.has(uPhone))
      return savedContactsMap.get(uPhone);

    return u.phone ? `+91 ${u.phone}` : u.name || "User";
  };

  const partner = !selectedChat.isGroupChat
    ? selectedChat.users?.find((u) => (u._id || u?.id)?.toString() !== myId)
    : null;

  const chatName = selectedChat.isGroupChat
    ? selectedChat.chatName
    : getSavedUserName(partner);
  const chatPhone = partner?.phone
    ? `+91 ${partner.phone}`
    : partner?.email || "";
  const profilePic = selectedChat.isGroupChat
    ? selectedChat.groupImage
    : partner?.profilePicture;

  // Check if current user is an admin of this group
  const isCurrentUserAdmin = Boolean(
    selectedChat.isGroupChat &&
      (selectedChat.groupAdmin || []).some(
        (admin) => (admin._id || admin)?.toString() === myId
      )
  );

  const currentDuration = selectedChat.disappearingMessages?.duration || 0;

  const getTimerLabel = (duration) => {
    if (duration === 86400) return "24 hours";
    if (duration === 604800) return "7 days";
    if (duration === 7776000) return "90 days";
    return "Off";
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    );
    return res.data.secure_url;
  };

  // Admin-only group profile picture upload handler
  const handleGroupImageUpload = async (e) => {
    if (!isCurrentUserAdmin) {
      toast.error("Only group admins can change the group picture");
      if (e.target) e.target.value = "";
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    try {
      setUploadingImage(true);
      const uploadedUrl = await uploadToCloudinary(file);

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/chat/grouppicture`,
        {
          chatId: selectedChat._id,
          groupImage: uploadedUrl,
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      if (socket) socket.emit("group updated", data);
      toast.success("Group picture updated!");
    } catch (err) {
      console.error("Failed to update group picture:", err);
      toast.error(
        err.response?.data?.message || "Failed to update group picture"
      );
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  // Admin-only group profile picture removal handler
  const handleRemoveGroupImage = async () => {
    if (!isCurrentUserAdmin) {
      toast.error("Only group admins can remove the group picture");
      return;
    }

    try {
      setUploadingImage(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/chat/grouppicture`,
        {
          chatId: selectedChat._id,
          groupImage: "",
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      if (socket) socket.emit("group updated", data);
      toast.success("Group picture removed!");
    } catch (err) {
      console.error("Failed to remove group picture:", err);
      toast.error(
        err.response?.data?.message || "Failed to remove group picture"
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // Admin-only Rename Group
  const handleRenameGroup = async () => {
    if (!groupChatName.trim()) return;
    if (!isCurrentUserAdmin) {
      toast.error("Only group admins can rename the group");
      return;
    }

    try {
      setRenameLoading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/chat/rename`,
        {
          chatId: selectedChat._id,
          chatName: groupChatName.trim(),
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      setGroupChatName("");
      if (socket) socket.emit("group updated", data);
      toast.success("Group renamed!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rename group");
    } finally {
      setRenameLoading(false);
    }
  };

  // Admin-only Add Saved Contact to Group
  const handleAddMemberToGroup = async (contactItem) => {
    if (!isCurrentUserAdmin) {
      toast.error("Only group admins can add members");
      return;
    }

    const targetUserId = (
      contactItem.contactUser?._id ||
      contactItem.contactUser ||
      contactItem._id
    )?.toString();

    if (!targetUserId) return;

    try {
      setGroupActionLoading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/chat/groupadd`,
        {
          chatId: selectedChat._id,
          userId: targetUserId,
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      setSearchContact("");
      if (socket) socket.emit("group updated", data);
      toast.success("Member added to group!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add member");
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Admin-only Toggle Admin Role
  const handleToggleAdminRole = async (targetUser) => {
    if (!isCurrentUserAdmin) {
      toast.error("Only group admins can change admin roles");
      return;
    }

    try {
      setGroupActionLoading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/chat/groupadmin`,
        {
          chatId: selectedChat._id,
          targetUserId: targetUser._id || targetUser,
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      if (socket) socket.emit("group updated", data);
      toast.success("Admin permissions updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update admin role");
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Admin Remove Member OR User Exit Group
  const handleRemoveOrLeaveMember = async (targetUser) => {
    const targetId = (targetUser._id || targetUser)?.toString();
    const isSelfLeave = targetId === myId;

    if (!isCurrentUserAdmin && !isSelfLeave) {
      toast.error("Only group admins can remove members");
      return;
    }

    try {
      setGroupActionLoading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      if (isSelfLeave) {
        await axios.put(
          `${API_URL}/chat/groupleave`,
          { chatId: selectedChat._id },
          config
        );
        setSelectedChat(null);
        setChats((prev) =>
          (prev || []).filter((c) => c._id !== selectedChat._id)
        );
        toast.success("You exited the group");
        onClose();
      } else {
        const { data } = await axios.put(
          `${API_URL}/chat/groupremove`,
          {
            chatId: selectedChat._id,
            userId: targetId,
          },
          config
        );
        setSelectedChat(data);
        setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
        if (socket) socket.emit("group updated", data);
        toast.success("Member removed from group");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleUpdateDisappearingTimer = async (durationInSeconds) => {
    try {
      setLoadingTimer(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/chat/disappearing`,
        { chatId: selectedChat._id, duration: durationInSeconds },
        config
      );

      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      selectedChat.disappearingMessages = data.disappearingMessages;
      setShowDisappearingModal(false);
      toast.success("Disappearing messages setting updated");
    } catch (error) {
      console.error("Failed to update disappearing messages timer:", error);
      toast.error("Could not update disappearing messages setting");
    } finally {
      setLoadingTimer(false);
    }
  };

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const mediaMessages = messages.filter(
    (m) =>
      (m.fileUrl &&
        !m.isDeleted &&
        (m.fileType === "image" ||
          m.fileType === "video" ||
          m.fileType === "document" ||
          m.fileType === "location")) ||
      (m.content && !m.isDeleted && m.content.match(urlRegex))
  );

  // Filter saved contacts not yet in the group
  const availableSavedContactsToAdd = savedContactsList.filter((c) => {
    const contactUserObj = c.contactUser || {};
    const cUserId = (contactUserObj._id || c.contactUser)?.toString();
    if (!cUserId) return false;

    const alreadyInGroup = (selectedChat.users || []).some(
      (u) => (u._id || u)?.toString() === cUserId
    );
    if (alreadyInGroup) return false;

    if (!searchContact.trim()) return true;
    const q = searchContact.toLowerCase();
    const sName = (c.savedName || "").toLowerCase();
    const sPhone = (c.phoneNumber || contactUserObj.phone || "").toLowerCase();
    return sName.includes(q) || sPhone.includes(q);
  });

  return (
    <div
      className={`fixed inset-y-0 right-0 w-80 sm:w-96 shadow-2xl border-l z-50 flex flex-col backdrop-blur-2xl animate-in slide-in-from-right duration-200 select-none ${
        isDark
          ? "bg-[#070a0f]/95 border-slate-800/90 text-slate-100"
          : "bg-white/95 border-slate-200/90 text-slate-900"
      }`}
    >
      {/* Hidden file input for Admin-only Group Picture */}
      {selectedChat.isGroupChat && (
        <input
          type="file"
          ref={groupImageInputRef}
          onChange={handleGroupImageUpload}
          accept="image/*"
          className="hidden"
          disabled={!isCurrentUserAdmin}
        />
      )}

      {/* Drawer Header */}
      <div
        className={`px-5 py-4 flex items-center gap-4 border-b flex-shrink-0 backdrop-blur-md ${
          isDark
            ? "border-slate-800/80 bg-[#0b1017]/85"
            : "border-slate-200/80 bg-slate-50/85"
        }`}
      >
        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition cursor-pointer text-xs font-bold ${
            isDark
              ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
          }`}
          title="Close panel"
        >
          ✕
        </button>
        <h3 className="font-bold text-sm tracking-tight">
          {selectedChat.isGroupChat ? "Group info" : "Contact info"}
        </h3>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <div
            onClick={() => {
              if (selectedChat.isGroupChat) {
                if (isCurrentUserAdmin) {
                  groupImageInputRef.current?.click();
                } else {
                  toast.error("Only group admins can change the group picture");
                }
              }
            }}
            title={
              selectedChat.isGroupChat
                ? isCurrentUserAdmin
                  ? "Click to change group picture"
                  : "Only admins can change group picture"
                : ""
            }
            className={`w-28 h-28 rounded-3xl overflow-hidden flex items-center justify-center font-bold text-3xl shadow-xl shadow-teal-500/20 mb-3 border border-teal-400/20 relative ${
              profilePic
                ? "bg-slate-900 text-white"
                : selectedChat.isGroupChat
                ? "bg-[#53646f] text-white"
                : "bg-gradient-to-tr from-teal-500 to-emerald-500 text-white"
            } ${
              selectedChat.isGroupChat && isCurrentUserAdmin
                ? "cursor-pointer group"
                : "cursor-default"
            }`}
          >
            {profilePic ? (
              <img
                src={profilePic}
                alt={chatName}
                className="w-full h-full object-cover"
              />
            ) : selectedChat.isGroupChat ? (
              <svg
                viewBox="0 0 24 24"
                className="w-14 h-14 fill-[#cfd6dc]"
              >
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            ) : (
              chatName.charAt(0).toUpperCase()
            )}

            {/* Admin Camera Hover Overlay */}
            {selectedChat.isGroupChat && isCurrentUserAdmin && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex items-center justify-center text-sm text-white transition">
                {uploadingImage ? "..." : "📷"}
              </div>
            )}
          </div>

          {/* Admin-Only Remove Group Icon Button */}
          {selectedChat.isGroupChat && isCurrentUserAdmin && profilePic && (
            <button
              type="button"
              onClick={handleRemoveGroupImage}
              disabled={uploadingImage}
              className="text-[11px] font-bold text-rose-400 hover:underline mb-2 cursor-pointer"
            >
              Remove group icon
            </button>
          )}

          <h2 className="text-base font-extrabold tracking-tight">
            {chatName}
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {selectedChat.isGroupChat
              ? `Group · ${selectedChat.users?.length || 0} participants`
              : chatPhone}
          </p>
        </div>

        {/* GROUP ADMIN CONTROLS & PARTICIPANTS SECTION */}
        {selectedChat.isGroupChat && (
          <div className="space-y-4">
            {/* Rename Group (Admin Only) */}
            {isCurrentUserAdmin && (
              <div
                className={`p-3.5 rounded-2xl border ${
                  isDark
                    ? "bg-[#0b1017]/85 border-slate-800/80"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  Rename Group (Admin)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter new group name..."
                    value={groupChatName}
                    onChange={(e) => setGroupChatName(e.target.value)}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-slate-100"
                        : "bg-white border-slate-200 text-slate-900"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleRenameGroup}
                    disabled={renameLoading}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
                  >
                    {renameLoading ? "..." : "Save"}
                  </button>
                </div>
              </div>
            )}

            {/* Add Members from Saved Contacts (Admin Only) */}
            {isCurrentUserAdmin && (
              <div
                className={`p-3.5 rounded-2xl border ${
                  isDark
                    ? "bg-[#0b1017]/85 border-slate-800/80"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  Add Members (Saved Contacts Only)
                </label>
                <input
                  type="text"
                  placeholder="Search saved contacts..."
                  value={searchContact}
                  onChange={(e) => setSearchContact(e.target.value)}
                  className={`w-full text-xs px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 mb-2 ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-slate-100"
                      : "bg-white border-slate-200 text-slate-900"
                  }`}
                />
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {availableSavedContactsToAdd.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-2">
                      No additional saved contacts available to add.
                    </p>
                  ) : (
                    availableSavedContactsToAdd.map((c) => {
                      const cUser = c.contactUser || {};
                      const dName = c.savedName || cUser.name || "Saved Contact";
                      const dPhone = c.phoneNumber || cUser.phone || "";
                      return (
                        <div
                          key={c._id}
                          onClick={() => handleAddMemberToGroup(c)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                            isDark
                              ? "bg-slate-900/70 border-slate-800 hover:bg-slate-800"
                              : "bg-white border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold truncate block">
                              {dName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              {dPhone ? `+91 ${dPhone}` : ""}
                            </span>
                          </div>
                          <span className="text-teal-400 font-bold text-[10px] px-2 py-1 rounded-lg bg-teal-500/15 border border-teal-500/20">
                            + Add
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Participants List (Displays Saved Contact Names & Admin Controls) */}
            <div
              className={`p-3.5 rounded-2xl border ${
                isDark
                  ? "bg-[#0b1017]/85 border-slate-800/80"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2.5">
                {selectedChat.users?.length || 0} Participants
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(selectedChat.users || []).map((u) => {
                  const uIdStr = (u._id || u)?.toString();
                  const isMemberAdmin = (selectedChat.groupAdmin || []).some(
                    (a) => (a._id || a)?.toString() === uIdStr
                  );
                  const isMe = uIdStr === myId;
                  const displayMemberName = getSavedUserName(u);

                  return (
                    <div
                      key={uIdStr}
                      className={`flex items-center justify-between p-2 rounded-xl border ${
                        isDark
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                          {u.profilePicture ? (
                            <img
                              src={u.profilePicture}
                              alt={displayMemberName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            displayMemberName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate block">
                              {displayMemberName}
                            </span>
                            {isMemberAdmin && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-400 font-bold border border-teal-500/30">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block truncate">
                            {u.phone ? `+91 ${u.phone}` : u.email || ""}
                          </span>
                        </div>
                      </div>

                      {isCurrentUserAdmin && !isMe && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            disabled={groupActionLoading}
                            onClick={() => handleToggleAdminRole(u)}
                            className={`text-[9px] px-2 py-1 rounded-lg border font-bold cursor-pointer transition ${
                              isMemberAdmin
                                ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                                : "border-teal-500/40 text-teal-400 bg-teal-500/10 hover:bg-teal-500/20"
                            }`}
                          >
                            {isMemberAdmin ? "Dismiss" : "Make Admin"}
                          </button>
                          <button
                            type="button"
                            disabled={groupActionLoading}
                            onClick={() => handleRemoveOrLeaveMember(u)}
                            className="text-[9px] px-2 py-1 rounded-lg border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 font-bold cursor-pointer transition"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Media, Links and Docs Section */}
        <div
          onClick={() => {
            if (onOpenMediaDrawer) {
              onOpenMediaDrawer();
            }
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 group shadow-xs ${
            isDark
              ? "bg-[#0b1017]/85 border-slate-800/80 hover:bg-[#111823] hover:border-slate-700"
              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 group-hover:text-teal-400 transition-colors">
              Media, links and docs
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-teal-400 font-bold px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/20">
                {mediaMessages.length}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenMediaDrawer) onOpenMediaDrawer();
                }}
                className="text-xs text-slate-400 hover:text-teal-400 transition cursor-pointer font-bold px-1"
                title="Open media drawer"
              >
                ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {mediaMessages.slice(0, 4).map((m, idx) => {
              const isImage = m.fileType === "image" && m.fileUrl;
              const linkMatch = m.content?.match(urlRegex);

              return (
                <div
                  key={idx}
                  className="aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-700/50 flex flex-col items-center justify-center relative text-center p-1 shadow-xs"
                >
                  {isImage ? (
                    <img
                      src={m.fileUrl}
                      alt="media"
                      className="w-full h-full object-cover"
                    />
                  ) : linkMatch ? (
                    <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-1 overflow-hidden">
                      <span className="text-[9px] text-cyan-400 font-medium truncate w-full">
                        {linkMatch[0]}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-1 overflow-hidden">
                      <span className="text-[9px] text-teal-300 font-medium truncate w-full">
                        {m.content || m.fileType || "File"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {mediaMessages.length === 0 && (
              <p className="col-span-4 text-center text-[11px] text-slate-500 py-3 font-medium">
                No media shared yet
              </p>
            )}
          </div>
        </div>

        {/* Options List */}
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs ${
              isDark
                ? "bg-[#0b1017]/85 border-slate-800/80 hover:bg-[#111823]"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-base">⭐</span>
              <div>
                <h4 className="text-xs font-bold tracking-tight">
                  Starred messages
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">None</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setShowDisappearingModal(!showDisappearingModal)}
            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs ${
              isDark
                ? "bg-[#0b1017]/85 border-slate-800/80 hover:bg-[#111823]"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-base">⏰</span>
              <div>
                <h4 className="text-xs font-bold tracking-tight">
                  Disappearing messages
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {getTimerLabel(currentDuration)}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-bold">›</span>
          </div>

          {/* Disappearing Messages Options Dropdown */}
          {showDisappearingModal && (
            <div
              className={`p-4 rounded-2xl border space-y-2 text-xs animate-in fade-in duration-150 shadow-lg ${
                isDark
                  ? "bg-[#070b10] border-slate-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed font-medium">
                New messages will disappear from this chat after the selected
                duration.
              </p>

              {[
                { label: "24 hours", val: 86400 },
                { label: "7 days", val: 604800 },
                { label: "90 days", val: 7776000 },
                { label: "Off", val: 0 },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    currentDuration === opt.val
                      ? "bg-teal-500/15 border border-teal-500/30 text-teal-400 font-bold"
                      : isDark
                      ? "hover:bg-slate-800/60"
                      : "hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <input
                    type="radio"
                    name="disappearingTimer"
                    checked={currentDuration === opt.val}
                    onChange={() => handleUpdateDisappearingTimer(opt.val)}
                    disabled={loadingTimer}
                    className="accent-teal-500 w-4 h-4 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Danger Actions */}
        <div className="space-y-2 pt-4 border-t border-slate-800/80">
          {!selectedChat.isGroupChat && (
            <button
              onClick={onBlockToggle}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-rose-500 font-bold text-xs hover:bg-rose-500/10 transition-all duration-200 cursor-pointer shadow-xs border border-rose-500/20"
            >
              <span>🚫</span> {isBlocked ? "Unblock contact" : "Block contact"}
            </button>
          )}

          {selectedChat.isGroupChat && (
            <button
              onClick={() => handleRemoveOrLeaveMember(user)}
              disabled={groupActionLoading}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-rose-400 font-bold text-xs bg-rose-500/10 hover:bg-rose-500/20 transition-all duration-200 cursor-pointer shadow-xs border border-rose-500/20"
            >
              <span>🚪</span> Exit group
            </button>
          )}

          <button
            onClick={onClearChat}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-xs transition-all duration-200 cursor-pointer shadow-xs border ${
              isDark
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
            }`}
          >
            <span>🧹</span> Clear chat
          </button>

          <button
            onClick={onDeleteChat}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-white font-bold text-xs bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 transition-all duration-200 cursor-pointer shadow-lg shadow-rose-600/20"
          >
            <span>🗑️</span> Delete chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInfoDrawer;