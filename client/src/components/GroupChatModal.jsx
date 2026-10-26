import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

// Cloudinary config constants
const CLOUDINARY_CLOUD_NAME = "qhyxgx1b";
const CLOUDINARY_PRESET = "chat_upload";

// Automatically switches between local development and your live Render backend
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://chat-app-backend-1-ib4u.onrender.com/api";

const UpdateGroupChatModal = ({
  isOpen,
  onClose,
  fetchMessages,
  mode = "update", // "create" when opened from MyChats '+ -> New group', "update" when viewing existing group
  savedContacts: propSavedContacts,
  savedContactsMap: propSavedContactsMap,
}) => {
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newGroupImage, setNewGroupImage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [localSavedContacts, setLocalSavedContacts] = useState([]);
  const [localContactsMap, setLocalContactsMap] = useState(new Map());

  const groupImageInputRef = useRef(null);
  const {
    user,
    selectedChat,
    setSelectedChat,
    chats,
    setChats,
    theme,
    socket,
  } = useChatState();

  const isDark = theme === "dark";
  const currentUserId = (user?._id || user?.id)?.toString();

  // Determine if we are in "Create New Group" mode
  const isCreateMode = mode === "create" || !selectedChat || !selectedChat.isGroupChat;

  // Fetch user's saved contacts so ONLY saved contacts can be added and displayed with their saved name
  useEffect(() => {
    if (!isOpen || !user?.token) return;

    setError("");
    setSearch("");

    if (propSavedContacts && propSavedContacts.length > 0 && propSavedContactsMap) {
      setLocalSavedContacts(propSavedContacts);
      setLocalContactsMap(propSavedContactsMap);
      return;
    }

    const fetchMySavedContacts = async () => {
      try {
        const config = {
          headers: { Authorization: `Bearer ${user.token}` },
        };
        const { data } = await axios.get(`${API_URL}/contacts`, config);

        const map = new Map();
        const validList = [];
        const seenIds = new Set();

        (data || []).forEach((c) => {
          const uId = (c.contactUser?._id || c.contactUser)?.toString();
          const phone = (c.phoneNumber || c.contactUser?.phone || "")
            .replace(/\D/g, "")
            .slice(-10);

          if (uId) map.set(uId, c.savedName);
          if (phone) map.set(phone, c.savedName);

          if (uId && !seenIds.has(uId) && uId !== currentUserId) {
            seenIds.add(uId);
            validList.push(c);
          }
        });

        setLocalContactsMap(map);
        setLocalSavedContacts(validList);
      } catch (err) {
        console.error("Failed to fetch saved contacts", err);
      }
    };

    fetchMySavedContacts();
  }, [isOpen, user, propSavedContacts, propSavedContactsMap, currentUserId]);

  // Reset form states when opening Create Mode
  useEffect(() => {
    if (isOpen && isCreateMode) {
      setGroupChatName("");
      setSelectedUsers([]);
      setNewGroupImage("");
      setSearch("");
      setError("");
    }
  }, [isOpen, isCreateMode]);

  // Helper to get saved contact name for any user object
  const getSavedDisplayName = (u) => {
    if (!u) return "Unknown";
    const uId = (u._id || u.id || u)?.toString();
    if (uId === currentUserId) return "You";

    const uPhone = (u.phone || "").replace(/\D/g, "").slice(-10);
    if (uId && localContactsMap.has(uId)) return localContactsMap.get(uId);
    if (uPhone && localContactsMap.has(uPhone)) return localContactsMap.get(uPhone);

    return u.phone ? `+91 ${u.phone}` : u.name || "Unknown";
  };

  // Check if current logged-in user is one of the group admins
  const isCurrentUserAdmin = isCreateMode
    ? true
    : (selectedChat?.groupAdmin || []).some((admin) => {
        const adminId = (admin?._id || admin?.id || admin)?.toString();
        return adminId === currentUserId;
      });

  // Helper to upload image to Cloudinary
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

  // Handle Group Picture Upload (Works for both Create Mode & Admin Update Mode)
  const handleGroupImageUpload = async (e) => {
    if (!isCurrentUserAdmin) {
      setError("Only group admins can change the group profile picture!");
      if (e.target) e.target.value = "";
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    try {
      setUploadingImage(true);
      setError("");
      const uploadedUrl = await uploadToCloudinary(file);

      if (isCreateMode) {
        setNewGroupImage(uploadedUrl);
        toast.success("Group icon ready!");
      } else {
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
        if (fetchMessages) fetchMessages();
        toast.success("Group icon updated!");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update group picture");
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  // Handle Group Picture Removal (Admin Only)
  const handleRemoveGroupImage = async () => {
    if (!isCurrentUserAdmin) {
      setError("Only group admins can remove the group profile picture!");
      return;
    }

    if (isCreateMode) {
      setNewGroupImage("");
      return;
    }

    try {
      setUploadingImage(true);
      setError("");
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
      if (fetchMessages) fetchMessages();
      toast.success("Group icon removed!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove group picture");
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle Creating a Brand-New Group
  const handleCreateGroup = async () => {
    if (!groupChatName.trim()) {
      setError("Please enter a group name");
      return;
    }

    if (selectedUsers.length < 1) {
      setError("Please select at least 1 saved contact to create a group");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const userIds = selectedUsers.map((c) =>
        (c.contactUser?._id || c.contactUser || c._id).toString()
      );

      const { data } = await axios.post(
        `${API_URL}/chat/group`,
        {
          name: groupChatName.trim(),
          users: JSON.stringify(userIds),
          groupImage: newGroupImage || "",
        },
        config
      );

      setChats((prev) => [data, ...(prev || [])]);
      setSelectedChat(data);
      toast.success(`Group "${data.chatName}" created!`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create group chat");
    } finally {
      setLoading(false);
    }
  };

  // Toggle contact selection in Create Mode
  const toggleSelectContactForNewGroup = (contact) => {
    const contactUserId = (
      contact.contactUser?._id ||
      contact.contactUser ||
      contact._id
    )?.toString();

    if (!contactUserId) return;

    const alreadySelected = selectedUsers.some(
      (item) =>
        (item.contactUser?._id || item.contactUser || item._id)?.toString() ===
        contactUserId
    );

    if (alreadySelected) {
      setSelectedUsers(
        selectedUsers.filter(
          (item) =>
            (
              item.contactUser?._id ||
              item.contactUser ||
              item._id
            )?.toString() !== contactUserId
        )
      );
    } else {
      setSelectedUsers([...selectedUsers, contact]);
    }
  };

  const handleRename = async () => {
    if (!groupChatName.trim()) return;

    try {
      setRenameLoading(true);
      setError("");
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
          chatName: groupChatName,
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      setGroupChatName("");
      if (socket) socket.emit("group updated", data);
      if (fetchMessages) fetchMessages();
      toast.success("Group renamed!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to rename group");
    } finally {
      setRenameLoading(false);
    }
  };

  const handleAddUser = async (contactItem) => {
    const targetUserId = (
      contactItem.contactUser?._id ||
      contactItem.contactUser ||
      contactItem._id
    )?.toString();

    if (!targetUserId) return;

    if (
      selectedChat.users.some(
        (u) => (u._id || u)?.toString() === targetUserId
      )
    ) {
      setError("Contact is already in the group!");
      return;
    }

    if (!isCurrentUserAdmin) {
      setError("Only admins can add members!");
      return;
    }

    try {
      setLoading(true);
      setError("");
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
      setSearch("");
      if (socket) socket.emit("group updated", data);
      if (fetchMessages) fetchMessages();
      toast.success("Member added to group!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userToRemove) => {
    const removeId = (userToRemove._id || userToRemove)?.toString();
    const isSelfLeave = removeId === currentUserId;

    if (!isCurrentUserAdmin && !isSelfLeave) {
      setError("Only admins can remove members!");
      return;
    }

    try {
      setLoading(true);
      setError("");
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
            userId: removeId,
          },
          config
        );
        setSelectedChat(data);
        setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
        if (socket) socket.emit("group updated", data);
        toast.success("Member removed");
      }

      if (fetchMessages) fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove user");
    } finally {
      setLoading(false);
    }
  };

  // Promote or demote group admin
  const handleToggleAdmin = async (targetUser) => {
    if (!isCurrentUserAdmin) {
      setError("Only admins can change admin permissions!");
      return;
    }

    try {
      setLoading(true);
      setError("");
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
          targetUserId: targetUser._id,
        },
        config
      );

      setSelectedChat(data);
      setChats((prev) => (prev || []).map((c) => (c._id === data._id ? data : c)));
      if (socket) socket.emit("group updated", data);
      if (fetchMessages) fetchMessages();
      toast.success("Admin permissions updated!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update admin role");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter saved contacts based on search query
  const filteredSavedContacts = localSavedContacts.filter((c) => {
    const contactUserObj = c.contactUser || {};
    const contactUserId = (contactUserObj._id || c.contactUser)?.toString();
    if (!contactUserId) return false;

    // In update mode, hide contacts who are already members of the group
    if (
      !isCreateMode &&
      selectedChat?.users?.some(
        (u) => (u._id || u)?.toString() === contactUserId
      )
    ) {
      return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const sName = (c.savedName || "").toLowerCase();
    const sPhone = (c.phoneNumber || contactUserObj.phone || "").toLowerCase();
    return sName.includes(q) || sPhone.includes(q);
  });

  // ============================================================================
  // VIEW 1: CREATE NEW GROUP MODAL (Opened when clicking "+ -> New group")
  // ============================================================================
  if (isCreateMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
        <div
          className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transition-all backdrop-blur-xl ${
            isDark
              ? "bg-[#111722]/95 border-slate-800 text-slate-100 shadow-teal-950/20"
              : "bg-white/95 border-slate-200 text-slate-900 shadow-2xl"
          }`}
        >
          <input
            type="file"
            ref={groupImageInputRef}
            onChange={handleGroupImageUpload}
            accept="image/*"
            className="hidden"
          />

          {/* Header */}
          <div className="flex justify-between items-center border-b pb-4 border-slate-700/40">
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Create New Group
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Set group icon, name & add saved contacts
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer text-xs font-bold ${
                isDark
                  ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 my-3 font-semibold text-center">
              {error}
            </div>
          )}

          {/* Group Icon & Name Input */}
          <div className="mt-4 flex items-center gap-3.5">
            <div className="flex flex-col items-center gap-1">
              <div
                onClick={() => groupImageInputRef.current?.click()}
                title="Click to upload group icon"
                className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-base flex-shrink-0 shadow-md cursor-pointer group relative ${
                  newGroupImage ? "bg-slate-900" : "bg-[#53646f]"
                }`}
              >
                {newGroupImage ? (
                  <img
                    src={newGroupImage}
                    alt="Group Icon"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-7 h-7 fill-[#cfd6dc]"
                  >
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition">
                  {uploadingImage ? "..." : "📷"}
                </div>
              </div>
              {newGroupImage && (
                <button
                  type="button"
                  onClick={handleRemoveGroupImage}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer font-semibold"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex-1">
              <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Group Name
              </label>
              <input
                type="text"
                placeholder="Enter group name..."
                value={groupChatName}
                onChange={(e) => setGroupChatName(e.target.value)}
                autoComplete="off"
                className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                  isDark
                    ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>
          </div>

          {/* Selected Contacts Pills */}
          {selectedUsers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selectedUsers.map((c) => {
                const uId = (
                  c.contactUser?._id ||
                  c.contactUser ||
                  c._id
                )?.toString();
                return (
                  <span
                    key={uId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  >
                    {c.savedName || c.contactUser?.name}
                    <button
                      type="button"
                      onClick={() => toggleSelectContactForNewGroup(c)}
                      className="hover:text-rose-400 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search & Select From Saved Contacts Only */}
          <div className="mt-4">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Select Members (Saved Contacts Only)
            </label>
            <input
              type="text"
              placeholder="Search your saved contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full text-xs px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all mb-2.5 ${
                isDark
                  ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {filteredSavedContacts.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  No saved contacts found. Save a contact first to add them to a group.
                </div>
              ) : (
                filteredSavedContacts.map((c) => {
                  const contactUserObj = c.contactUser || {};
                  const uId = (
                    contactUserObj._id || c.contactUser
                  )?.toString();
                  const isChecked = selectedUsers.some(
                    (item) =>
                      (
                        item.contactUser?._id ||
                        item.contactUser ||
                        item._id
                      )?.toString() === uId
                  );
                  const displayName = c.savedName || contactUserObj.name || "Saved Contact";
                  const displayPhone = c.phoneNumber || contactUserObj.phone || "";

                  return (
                    <div
                      key={c._id || uId}
                      onClick={() => toggleSelectContactForNewGroup(c)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-teal-500/15 border-teal-500/50"
                          : isDark
                          ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/70"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                          {contactUserObj.profilePicture ? (
                            <img
                              src={contactUserObj.profilePicture}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold truncate block">
                            {displayName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block truncate">
                            {displayPhone ? `+91 ${displayPhone}` : ""}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold border ${
                          isChecked
                            ? "bg-teal-500 border-teal-500 text-white"
                            : "border-slate-500"
                        }`}
                      >
                        {isChecked ? "✓" : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Create Group Submit Button */}
          <div className="mt-5 pt-4 border-t border-slate-700/40">
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={loading || uploadingImage}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              {loading ? "Creating Group..." : `Create Group (${selectedUsers.length} selected)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: MANAGE EXISTING GROUP MODAL (Admin Controls & Saved Contact Names)
  // ============================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-3xl p-7 shadow-2xl border transition-all backdrop-blur-xl ${
          isDark
            ? "bg-[#111722]/95 border-slate-800 text-slate-100 shadow-teal-950/20"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-2xl"
        }`}
      >
        <input
          type="file"
          ref={groupImageInputRef}
          onChange={handleGroupImageUpload}
          accept="image/*"
          className="hidden"
          disabled={!isCurrentUserAdmin}
        />

        {/* Header with Group Avatar & Admin Remove Icon Option */}
        <div className="flex justify-between items-center border-b pb-4 border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div
                onClick={() => {
                  if (isCurrentUserAdmin) {
                    groupImageInputRef.current?.click();
                  } else {
                    setError("Only group admins can change the group picture");
                  }
                }}
                title={
                  isCurrentUserAdmin
                    ? "Click to change group picture"
                    : "Only admins can change the group picture"
                }
                className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-base flex-shrink-0 shadow-md ${
                  selectedChat.groupImage ? "bg-slate-900" : "bg-[#53646f]"
                } ${
                  isCurrentUserAdmin
                    ? "cursor-pointer group relative"
                    : "cursor-default relative"
                }`}
              >
                {selectedChat.groupImage ? (
                  <img
                    src={selectedChat.groupImage}
                    alt={selectedChat.chatName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-7 h-7 fill-[#cfd6dc]"
                  >
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                )}
                {isCurrentUserAdmin && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition">
                    {uploadingImage ? "..." : "📷"}
                  </div>
                )}
              </div>

              {isCurrentUserAdmin && selectedChat.groupImage && (
                <button
                  type="button"
                  onClick={handleRemoveGroupImage}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer font-semibold"
                >
                  Remove Icon
                </button>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-extrabold truncate max-w-[200px] tracking-tight">
                {selectedChat.chatName}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {selectedChat.users?.length} participants
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer text-xs font-bold ${
              isDark
                ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 my-3 font-semibold text-center">
            {error}
          </div>
        )}

        {/* Existing Member Badges / List (Showing Saved Contact Names) */}
        <div className="mt-4">
          <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
            Participants
          </label>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {selectedChat.users.map((u) => {
              const uIdStr = (u._id || u)?.toString();
              const isAdmin = (selectedChat.groupAdmin || []).some(
                (admin) => (admin._id || admin).toString() === uIdStr
              );
              const isMe = uIdStr === currentUserId;
              const savedDisplayName = getSavedDisplayName(u);

              return (
                <div
                  key={uIdStr}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isDark
                      ? "bg-slate-900/50 border-slate-800"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden shadow-xs">
                      {u.profilePicture ? (
                        <img
                          src={u.profilePicture}
                          alt={savedDisplayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        savedDisplayName?.charAt(0)?.toUpperCase() || "👤"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate block">
                          {savedDisplayName}
                        </span>
                        {isAdmin && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-400 font-bold border border-teal-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        {u.phone ? `+91 ${u.phone}` : u.email}
                      </span>
                    </div>
                  </div>

                  {/* Admin controls for other members */}
                  {isCurrentUserAdmin && !isMe && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAdmin(u)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition font-semibold cursor-pointer ${
                          isAdmin
                            ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                            : "border-teal-500/40 text-teal-400 bg-teal-500/10 hover:bg-teal-500/20"
                        }`}
                      >
                        {isAdmin ? "Dismiss" : "Make Admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(u)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition font-semibold cursor-pointer"
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

        {/* Rename Input (Admin Only) */}
        {isCurrentUserAdmin && (
          <div className="mt-4">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Rename Group
            </label>
            <div className="flex gap-2.5">
              <input
                type="text"
                placeholder="New group name..."
                value={groupChatName}
                onChange={(e) => setGroupChatName(e.target.value)}
                autoComplete="off"
                data-form-type="other"
                className={`flex-1 text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
                  isDark
                    ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
              <button
                type="button"
                onClick={handleRename}
                disabled={renameLoading}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-xs px-5 py-3 rounded-xl font-bold transition disabled:opacity-50 cursor-pointer shadow-md shadow-teal-500/20"
              >
                {renameLoading ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        )}

        {/* Add Members from Saved Contacts Only (Admin Only) */}
        {isCurrentUserAdmin && (
          <div className="mt-4">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Add Participants (Saved Contacts Only)
            </label>
            <input
              type="text"
              placeholder="Search your saved contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              data-form-type="other"
              className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
                isDark
                  ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
            {filteredSavedContacts.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-2xl mt-2 space-y-1 pr-1">
                {filteredSavedContacts.map((c) => {
                  const contactUserObj = c.contactUser || {};
                  const displayName =
                    c.savedName || contactUserObj.name || "Saved Contact";
                  const displayPhone =
                    c.phoneNumber || contactUserObj.phone || "";

                  return (
                    <div
                      key={c._id}
                      onClick={() => handleAddUser(c)}
                      className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center text-xs transition border ${
                        isDark
                          ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/80"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold truncate block">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          {displayPhone ? `+91 ${displayPhone}` : ""}
                        </span>
                      </div>
                      <span className="text-teal-400 font-bold flex-shrink-0 text-xs px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/20">
                        + Add
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Leave Group Button */}
        <div className="flex justify-end pt-4 border-t border-slate-700/40 mt-5">
          <button
            type="button"
            onClick={() => handleRemove(user)}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-rose-600/20"
          >
            Exit Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateGroupChatModal;