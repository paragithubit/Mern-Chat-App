import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";
import CallModal from "./CallModal";

const CallsList = () => {
  const [calls, setCalls] = useState([]);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState("video");
  const [targetUserId, setTargetUserId] = useState(null);
  const [targetChatId, setTargetChatId] = useState(null);
  const [isGroupCallTarget, setIsGroupCallTarget] = useState(false);
  const [targetGroupUsers, setTargetGroupUsers] = useState([]);
  const [targetGroupName, setTargetGroupName] = useState("");
  const [activeMenuCallId, setActiveMenuCallId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedContactsMap, setSavedContactsMap] = useState(new Map());

  const menuRef = useRef(null);
  const { user, socket, theme } = useChatState();
  const isDark = theme === "dark";

  // Fetch saved contacts to resolve real names/phones like WhatsApp
  useEffect(() => {
    const fetchContactsMap = async () => {
      if (!user?.token) return;
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get("http://localhost:7000/api/contacts", config);
        const map = new Map();
        (data || []).forEach((c) => {
          const uId = (c.contactUser?._id || c.contactUser)?.toString();
          const phone = (c.phoneNumber || c.contactUser?.phone || "").replace(/\D/g, "").slice(-10);
          if (uId) map.set(uId, c.savedName);
          if (phone) map.set(phone, c.savedName);
        });
        setSavedContactsMap(map);
      } catch (err) {
        console.error("Failed to load contacts map in CallsList", err);
      }
    };
    fetchContactsMap();
  }, [user]);

  const fetchCalls = async () => {
    if (!user?.token) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("http://localhost:7000/api/calls", config);
      setCalls(data || []);
    } catch (error) {
      console.error("Failed to fetch call logs", error);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchCalls();
    }
  }, [user?.token]);

  // Real-time socket listener to update call history instantly (including missed calls)
  useEffect(() => {
    if (!socket) return;

    const handleCallUpdate = () => {
      fetchCalls();
    };

    socket.on("callAccepted", handleCallUpdate);
    socket.on("callEnded", handleCallUpdate);
    socket.on("incomingCall", handleCallUpdate);
    socket.on("callLogUpdated", handleCallUpdate);

    return () => {
      socket.off("callAccepted", handleCallUpdate);
      socket.off("callEnded", handleCallUpdate);
      socket.off("incomingCall", handleCallUpdate);
      socket.off("callLogUpdated", handleCallUpdate);
    };
  }, [socket, user?.token]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuCallId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Strict WhatsApp-style group call detector
  const checkIfGroupCall = (call) => {
    return Boolean(
      call.isGroupCall || 
      call.chatId?.isGroupChat === true || 
      (call.chatId && call.chatId.users && call.chatId.users.length > 2) ||
      (call.chatId && call.chatId.chatName && call.chatId.chatName !== "sender" && !call.receiver)
    );
  };

  // Helper to determine the target peer for a 1-on-1 call
  const getCallPartner = (call) => {
    const myId = (user?._id || user?.id)?.toString();
    const callerId = (call.caller?._id || call.caller?.id || call.caller)?.toString();
    const receiverId = (call.receiver?._id || call.receiver?.id || call.receiver)?.toString();

    if (callerId === myId) {
      return call.receiver;
    } else if (receiverId === myId) {
      return call.caller;
    }
    return callerId === myId ? call.receiver : call.caller;
  };

  // Resolve display name strictly favoring Group Name for group calls
  const getCallDisplayName = (call, isGroup) => {
    if (isGroup) {
      return call.chatId?.chatName && call.chatId?.chatName !== "sender"
        ? call.chatId.chatName
        : "Group Call";
    }

    const partner = getCallPartner(call);
    if (!partner) return "Unknown User";

    const pId = (partner._id || partner?.id || partner)?.toString();
    const pPhone = (partner.phone || "").replace(/\D/g, "").slice(-10);

    if (pId && savedContactsMap.has(pId)) {
      return savedContactsMap.get(pId);
    }
    if (pPhone && savedContactsMap.has(pPhone)) {
      return savedContactsMap.get(pPhone);
    }

    if (partner.name && partner.name !== "sender") {
      return partner.name;
    }

    return partner.phone ? `+91 ${partner.phone}` : "Unknown User";
  };

  const handleCallback = (call, type) => {
    const isGroup = checkIfGroupCall(call);

    if (isGroup) {
      setTargetChatId(call.chatId?._id || call.chatId);
      setIsGroupCallTarget(true);
      setTargetUserId(null);
      setTargetGroupUsers(call.chatId?.users || []);
      setTargetGroupName(call.chatId?.chatName || "Group Call");
    } else {
      const partner = getCallPartner(call);
      const uId = (partner?._id || partner?.id || partner)?.toString();
      if (!uId) {
        toast.error("Could not find user to call back");
        return;
      }
      setTargetUserId(uId);
      setIsGroupCallTarget(false);
      setTargetChatId(call.chatId?._id || call.chatId || null);
      setTargetGroupUsers([]);
      setTargetGroupName("");
    }
    setCallType(type || call.callType || "audio");
    setCallModalOpen(true);
  };

  const handleDeleteCall = async (callId, e) => {
    if (e) e.stopPropagation();
    setActiveMenuCallId(null);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`http://localhost:7000/api/calls/${callId}`, config);
      setCalls((prevCalls) => prevCalls.filter((c) => c._id !== callId));
      toast.success("Call log deleted");
    } catch (error) {
      console.error("Failed to delete call log", error);
      toast.error("Failed to delete call log");
    }
  };

  const handleClearAllCalls = () => {
    if (calls.length === 0) return;

    toast(
      (t) => (
        <div className="flex flex-col gap-2.5 p-1">
          <p className="font-semibold text-xs tracking-tight">
            Are you sure you want to remove this call history?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  const config = { headers: { Authorization: `Bearer ${user.token}` } };
                  await axios.delete("http://localhost:7000/api/calls/clear", config);
                  setCalls([]);
                  toast.success("Call history cleared successfully");
                } catch (error) {
                  console.error("Failed to clear call history", error);
                  toast.error("Failed to clear call history");
                }
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Yes
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="bg-slate-700/80 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 6000 }
    );
  };

  const filteredCalls = calls.filter((call) => {
    const query = searchQuery.toLowerCase();
    const isGroup = checkIfGroupCall(call);
    const displayName = getCallDisplayName(call, isGroup).toLowerCase();
    const partner = !isGroup ? getCallPartner(call) : null;
    const phone = partner?.phone || "";
    return displayName.includes(query) || phone.includes(query);
  });

  return (
    <div
      className={`w-full h-full p-6 overflow-y-auto select-none transition-colors duration-300 flex flex-col ${
        isDark ? "bg-[#070a0f] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* Header Title Section */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Call History</h2>
          <p className={`text-xs font-medium mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Manage your secure voice and video communication logs
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/20">
            {calls.length} Total Logs
          </span>
          {calls.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllCalls}
              className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer active:scale-95"
              title="Clear all call history"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 flex-shrink-0">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
        <input
          type="text"
          placeholder="Search name, group or number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs outline-none border transition-all shadow-xs ${
            isDark
              ? "bg-[#0b1017] border-slate-800 text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
              : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        )}
      </div>

      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex-shrink-0">
        Recent Calls
      </h3>

      <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
        {filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner ${
                isDark ? "bg-slate-900 border border-slate-800 text-slate-500" : "bg-slate-100 border border-slate-200 text-slate-400"
              }`}
            >
              📞
            </div>
            <p className="text-xs font-semibold text-slate-400">No call records found.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Your incoming and outgoing call history will appear here.</p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isGroup = checkIfGroupCall(call);
            const myId = (user?._id || user?.id)?.toString();
            const callerId = (call.caller?._id || call.caller?.id || call.caller)?.toString();
            const isCaller = callerId === myId;
            const targetUser = !isGroup ? getCallPartner(call) : null;
            const displayName = getCallDisplayName(call, isGroup);

            const isMissed = call.callStatus === "missed" || call.status === "missed";
            const displayStatus =
              isMissed
                ? "Missed"
                : isCaller
                ? "Outgoing"
                : "Incoming";

            return (
              <div
                key={call._id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveMenuCallId(activeMenuCallId === call._id ? null : call._id);
                }}
                className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 group shadow-xs ${
                  isDark
                    ? "bg-[#0b1017]/80 border-slate-800/80 hover:bg-[#111823] hover:border-slate-700/80"
                    : "bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-white flex-shrink-0 shadow-md ${
                      isGroup
                        ? call.chatId?.groupImage
                          ? "bg-slate-900"
                          : "bg-[#53646f]"
                        : "bg-gradient-to-tr from-teal-500 to-emerald-500"
                    }`}
                  >
                    {isGroup ? (
                      call.chatId?.groupImage ? (
                        <img src={call.chatId.groupImage} alt="Group" className="w-full h-full object-cover" />
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#cfd6dc]">
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                      )
                    ) : targetUser?.profilePicture ? (
                      <img src={targetUser.profilePicture} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      displayName.charAt(0).toUpperCase() || "U"
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold tracking-tight truncate group-hover:text-teal-400 transition-colors">
                      {displayName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                          displayStatus === "Missed"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-teal-500/20 text-teal-400"
                        }`}
                      >
                        {displayStatus === "Missed" ? "↙" : isCaller ? "↗" : "↙"}
                      </span>

                      <span className="text-xs">
                        {call.callType === "video" ? "📹" : "📞"}
                      </span>

                      <span
                        className={`text-[11px] font-medium ${
                          displayStatus === "Missed" ? "text-rose-400 font-semibold" : "text-slate-400"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block">
                    {new Date(call.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} •{" "}
                    {new Date(call.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCallback(call, call.callType)}
                    className="p-2.5 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white rounded-xl transition-all text-xs cursor-pointer shadow-xs transform active:scale-95 flex items-center justify-center"
                    title="Call back"
                  >
                    {call.callType === "video" ? "📹" : "📞"}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuCallId(activeMenuCallId === call._id ? null : call._id);
                    }}
                    className={`p-2 rounded-xl transition text-sm font-bold cursor-pointer ${
                      isDark
                        ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        : "hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                    }`}
                    title="Options"
                  >
                    ⋮
                  </button>
                </div>

                {activeMenuCallId === call._id && (
                  <div
                    ref={menuRef}
                    className={`absolute right-4 top-14 w-44 rounded-2xl shadow-2xl border py-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                      isDark ? "bg-[#111722]/95 border-slate-700/80 text-slate-200" : "bg-white/95 border-slate-200 text-slate-800"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCall(call._id, e)}
                      className="w-full text-left px-4 py-2.5 text-rose-500 hover:bg-rose-500/10 transition font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <span>🗑️</span> Delete Call Log
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {callModalOpen && (
        <CallModal
          isOpen={callModalOpen}
          onClose={() => {
            setCallModalOpen(false);
            setTargetUserId(null);
            setTargetChatId(null);
            setIsGroupCallTarget(false);
            setTargetGroupUsers([]);
            setTargetGroupName("");
            fetchCalls();
          }}
          callType={callType}
          isIncoming={false}
          targetUserId={targetUserId}
          chatId={targetChatId}
          isGroup={isGroupCallTarget}
          isGroupChat={isGroupCallTarget}
          groupUsers={targetGroupUsers}
          groupName={targetGroupName}
        />
      )}
    </div>
  );
};

export default CallsList;