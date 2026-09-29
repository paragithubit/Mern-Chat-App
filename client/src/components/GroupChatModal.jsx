import React, { useState, useRef } from "react";
import axios from "axios";
import { useChatState } from "../context/useChatState";

// Cloudinary config constants
const CLOUDINARY_CLOUD_NAME = "qhyxgx1b";
const CLOUDINARY_PRESET = "chat_upload";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const UpdateGroupChatModal = ({ isOpen, onClose, fetchMessages }) => {
  const [groupChatName, setGroupChatName] = useState("");
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const groupImageInputRef = useRef(null);
  const { user, selectedChat, setSelectedChat, chats, setChats, theme } =
    useChatState();

  const isDark = theme === "dark";

  // Check if current logged-in user is one of the group admins
  const currentUserId = (user?._id || user?.id)?.toString();
  const isCurrentUserAdmin = (selectedChat?.groupAdmin || []).some((admin) => {
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

  // Handle Group Picture Upload (Strictly for Group Admins)
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
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      if (fetchMessages) fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update group picture");
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = "";
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
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      setGroupChatName("");
      if (fetchMessages) fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to rename group");
    } finally {
      setRenameLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query.trim()) {
      setSearchResult([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.get(
        `${API_URL}/user?search=${query}`,
        config
      );
      setSearchResult(data);
    } catch (err) {
      setError("Failed to load search results");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userToAdd) => {
    if (selectedChat.users.some((u) => u._id === userToAdd._id)) {
      setError("User already in group!");
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
          userId: userToAdd._id,
        },
        config
      );

      setSelectedChat(data);
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      setSearch("");
      setSearchResult([]);
      if (fetchMessages) fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userToRemove) => {
    if (!isCurrentUserAdmin && userToRemove._id !== user._id) {
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

      const { data } = await axios.put(
        `${API_URL}/chat/groupremove`,
        {
          chatId: selectedChat._id,
          userId: userToRemove._id,
        },
        config
      );

      if (userToRemove._id === user._id) {
        setSelectedChat(null);
        setChats(chats.filter((c) => c._id !== selectedChat._id));
        onClose();
      } else {
        setSelectedChat(data);
        setChats(chats.map((c) => (c._id === data._id ? data : c)));
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
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      if (fetchMessages) fetchMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update admin role");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !selectedChat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-3xl p-7 shadow-2xl border transition-all backdrop-blur-xl ${
          isDark
            ? "bg-[#111722]/95 border-slate-800 text-slate-100 shadow-teal-950/20"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-2xl"
        }`}
      >
        {/* Hidden file input for uploading group profile picture */}
        <input
          type="file"
          ref={groupImageInputRef}
          onChange={handleGroupImageUpload}
          accept="image/*"
          className="hidden"
          disabled={!isCurrentUserAdmin}
        />

        {/* Header with Group Avatar & Default Fallback */}
        <div className="flex justify-between items-center border-b pb-4 border-slate-700/40">
          <div className="flex items-center gap-3">
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

        {/* Existing Member Badges / List */}
        <div className="mt-4">
          <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
            Participants
          </label>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {selectedChat.users.map((u) => {
              const isAdmin = (selectedChat.groupAdmin || []).some(
                (admin) => (admin._id || admin).toString() === u._id.toString()
              );
              const isMe = u._id === user._id;

              return (
                <div
                  key={u._id}
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
                          alt={u.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        u.name?.charAt(0)?.toUpperCase() || "👤"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate block">
                          {isMe ? "You" : u.name}
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

        {/* Add Members (Admin Only) */}
        {isCurrentUserAdmin && (
          <div className="mt-4">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Add Participants (by Name or Phone)
            </label>
            <input
              type="text"
              placeholder="Search by name or phone number..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoComplete="off"
              data-form-type="other"
              className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
                isDark
                  ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
            {searchResult.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-2xl mt-2 space-y-1 pr-1">
                {searchResult.slice(0, 3).map((u) => (
                  <div
                    key={u._id}
                    onClick={() => handleAddUser(u)}
                    className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center text-xs transition border ${
                      isDark
                        ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/80"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold truncate block">{u.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        {u.phone ? `+91 ${u.phone}` : u.email}
                      </span>
                    </div>
                    <span className="text-teal-400 font-bold flex-shrink-0 text-xs px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/20">
                      + Add
                    </span>
                  </div>
                ))}
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