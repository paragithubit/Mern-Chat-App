import React, { useState } from "react";
import axios from "axios";
import { useChatState } from "../context/useChatState";

const GroupChatModal = ({ isOpen, onClose }) => {
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, chats, setChats, setSelectedChat, theme } = useChatState();
  const isDark = theme === "dark";

  // UPDATED SEARCH HANDLER: Queries /api/contacts to search through saved contacts book
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
        `http://localhost:7000/api/contacts?search=${encodeURIComponent(query.trim())}`,
        config
      );
      setSearchResult(data);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search saved contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleGroup = (contactToAdd) => {
    // Extract the actual user object from the contact record
    const userObj = contactToAdd.contactUser || contactToAdd;
    const userToAddNormalized = {
      _id: userObj._id || contactToAdd._id,
      name: contactToAdd.savedName || userObj.name,
      phone: contactToAdd.phoneNumber || userObj.phone,
      profilePicture: userObj.profilePicture,
      email: userObj.email,
    };

    if (selectedUsers.some((u) => u._id === userToAddNormalized._id)) {
      return;
    }
    setSelectedUsers([...selectedUsers, userToAddNormalized]);
  };

  const handleDelete = (delUser) => {
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleSubmit = async () => {
    if (!groupChatName.trim() || selectedUsers.length < 1) {
      setError("Please provide a group name and select at least 1 participant");
      return;
    }

    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.post(
        "http://localhost:7000/api/chat/group",
        {
          name: groupChatName.trim(),
          users: JSON.stringify(selectedUsers.map((u) => u._id)),
        },
        config
      );

      setChats([data, ...(chats || [])]);
      setSelectedChat(data);
      onClose();

      // Reset form
      setGroupChatName("");
      setSelectedUsers([]);
      setSearch("");
      setSearchResult([]);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create group");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-3xl p-7 shadow-2xl border transition-all backdrop-blur-xl ${
          isDark
            ? "bg-[#111722]/95 border-slate-800 text-slate-100 shadow-teal-950/20"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 border-slate-700/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center text-base shadow-md shadow-teal-500/20">
              👥
            </div>
            <h2 className="text-base font-extrabold tracking-tight">Create New Group</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer text-xs font-bold ${
              isDark ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
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

        {/* Group Name Input */}
        <div className="mt-4">
          <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
            Group Subject
          </label>
          <input
            type="text"
            placeholder="Type group name..."
            value={groupChatName}
            onChange={(e) => setGroupChatName(e.target.value)}
            autoComplete="off"
            data-form-type="other"
            name="group_subject_input_field"
            className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
              isDark
                ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        {/* Selected Users Badges */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 my-3.5 max-h-24 overflow-y-auto pr-1">
            {selectedUsers.map((u) => (
              <span
                key={u._id}
                className="bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs px-3 py-1.5 rounded-xl flex items-center gap-2 font-semibold shadow-xs"
              >
                {u.name}
                <button
                  type="button"
                  onClick={() => handleDelete(u)}
                  className="hover:text-rose-400 font-bold cursor-pointer transition"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add Users Input */}
        <div className="mt-3">
          <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
            Add Members
          </label>
          <input
            type="text"
            placeholder="Search saved contacts by name or phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            autoComplete="off"
            data-form-type="other"
            name="group_member_search_field"
            className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
              isDark
                ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        {/* Search Results Dropdown List */}
        <div className="max-h-40 overflow-y-auto rounded-2xl my-3 space-y-1.5 pr-1">
          {loading ? (
            <div className="text-center py-4 text-xs text-slate-400 animate-pulse font-medium">
              Searching saved contacts...
            </div>
          ) : (
            searchResult.slice(0, 4).map((c) => {
              const contactUserObj = c.contactUser || {};
              const displayName = c.savedName || contactUserObj.name || "Unknown";
              const displayPhone = c.phoneNumber || contactUserObj.phone || "";
              const avatar = contactUserObj.profilePicture;

              return (
                <div
                  key={c._id}
                  onClick={() => handleGroup(c)}
                  className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center text-xs transition border ${
                    isDark
                      ? "bg-slate-900/50 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                      {avatar ? (
                        <img src={avatar} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold block truncate">{displayName}</span>
                      <span className="text-[10px] text-slate-400 block truncate font-mono">
                        {displayPhone ? `+91 ${displayPhone}` : contactUserObj.email}
                      </span>
                    </div>
                  </div>
                  <span className="w-6 h-6 rounded-lg bg-teal-500/15 text-teal-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                    +
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/40 mt-3">
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer border ${
              isDark
                ? "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl transition cursor-pointer shadow-lg shadow-teal-500/25"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChatModal;