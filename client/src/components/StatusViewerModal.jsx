import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

const QUICK_STATUS_EMOJIS = ["😂", "😮", "😍", "😢", "🙏", "🔥", "❤️", "👍"];

const StatusViewerModal = ({ isOpen, onClose, statusGroup }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewersModalOpen, setViewersModalOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const { user, socket } = useChatState();

  // Reset index when modal opens or group changes
  useEffect(() => {
    setCurrentIndex(0);
    setReplyText("");
    setIsPaused(false);
  }, [statusGroup, isOpen]);

  const currentStatus = statusGroup?.items?.[currentIndex];
  const currentUserId = user?._id || user?.id;
  const isMyStatus = currentStatus?.user?._id?.toString() === currentUserId?.toString();

  // Mark status as viewed when displayed by another user
  useEffect(() => {
    if (!isOpen || !currentStatus || isMyStatus || !user?.token) return;

    const markViewed = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        await axios.put(`http://localhost:7000/api/status/${currentStatus._id}/view`, {}, config);
      } catch (err) {
        console.error("Failed to mark status as viewed", err);
      }
    };
    markViewed();
  }, [currentIndex, currentStatus, isOpen, isMyStatus, user]);

  // Handle 5-second timer for automatic story progression (pauses when user is typing or interacting)
  useEffect(() => {
    if (!isOpen || !statusGroup || !statusGroup.items || statusGroup.items.length === 0 || viewersModalOpen || isPaused) return;

    const timer = setTimeout(() => {
      if (currentIndex < statusGroup.items.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onClose();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentIndex, statusGroup, isOpen, onClose, viewersModalOpen, isPaused]);

  // Handle sending reply or reaction to status owner
  const handleSendReply = async (contentToSend) => {
    const text = contentToSend || replyText;
    if (!text.trim() || sendingReply) return;

    try {
      setSendingReply(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      // 1. Access or create direct chat with status author
      const authorId = statusGroup.user?._id || statusGroup.user;
      const { data: chatData } = await axios.post(
        "http://localhost:7000/api/chat",
        { userId: authorId },
        config
      );

      // 2. Send reply message referencing the status context
      const payload = {
        content: `Replied to status: "${text}"`,
        chatId: chatData._id,
      };

      const { data: messageData } = await axios.post(
        "http://localhost:7000/api/message",
        payload,
        config
      );

      if (socket) {
        socket.emit("new message", messageData);
      }

      setReplyText("");
      setIsPaused(false);
      toast.success("Reply sent to chat!");
    } catch (err) {
      console.error("Failed to send status reply:", err);
      toast.error("Could not send reply.");
    } finally {
      setSendingReply(false);
    }
  };

  if (!isOpen || !statusGroup || !statusGroup.items || statusGroup.items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-white text-xs font-bold w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center cursor-pointer z-30 shadow-lg"
        title="Close viewer"
      >
        ✕
      </button>

      <div className="relative max-w-lg w-full h-[90vh] flex flex-col items-center justify-between p-4">
        {/* Progress Bars */}
        <div className="absolute top-4 inset-x-6 flex gap-1.5 z-30">
          {statusGroup.items.map((item, idx) => (
            <div key={item._id || idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className={`h-full bg-teal-400 transition-all ${
                  idx < currentIndex
                    ? "w-full"
                    : idx === currentIndex
                    ? "w-full"
                    : "w-0"
                }`}
                style={
                  idx === currentIndex && !isPaused
                    ? { animation: "progress 5s linear forwards" }
                    : idx < currentIndex
                    ? { width: "100%" }
                    : { width: "0%" }
                }
              />
            </div>
          ))}
        </div>

        {/* User Info Header */}
        <div className="absolute top-8 left-6 flex items-center gap-3.5 z-20">
          <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-teal-500/50 shadow-md">
            {statusGroup.user?.profilePicture ? (
              <img src={statusGroup.user.profilePicture} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                {statusGroup.user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-white text-xs font-bold tracking-tight">{statusGroup.user?.name || "User"}</h4>
            <span className="text-slate-400 text-[10px] font-mono mt-0.5 block">
              {currentStatus?.createdAt ? new Date(currentStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
            </span>
          </div>
        </div>

        {/* Status Media Content (Click to skip to next) */}
        <div 
          onClick={() => {
            if (!isPaused) {
              if (currentIndex < statusGroup.items.length - 1) {
                setCurrentIndex((prev) => prev + 1);
              } else {
                onClose();
              }
            }
          }}
          className="w-full flex-1 my-14 flex items-center justify-center rounded-3xl overflow-hidden bg-black cursor-pointer relative shadow-2xl border border-slate-800/80"
        >
          {currentStatus?.mediaUrl ? (
            <img src={currentStatus.mediaUrl} alt="status story" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-white text-sm font-semibold p-8 text-center leading-relaxed">{currentStatus?.content}</div>
          )}

          {/* WhatsApp style Seen By badge for status owner */}
          {isMyStatus && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(true);
                setViewersModalOpen(true);
              }}
              className="absolute bottom-6 inset-x-0 mx-auto w-max px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:bg-black/80 transition z-20"
            >
              <span>👁️ Viewed by {currentStatus?.viewedBy?.length || 0}</span>
            </div>
          )}
        </div>

        {/* WhatsApp-Style Reply & Reaction Footer (Shown only on other users' statuses) */}
        {!isMyStatus && (
          <div 
            className="w-full z-30 flex flex-col gap-3 px-2 pb-2"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => { if (!replyText) setIsPaused(false); }}
          >
            {/* Quick Emoji Reaction Pills */}
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
              {QUICK_STATUS_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSendReply(emoji)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-xl transition transform hover:scale-125 cursor-pointer shadow-md"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Type a reply input bar */}
            <div className="flex items-center gap-2 bg-[#202c33]/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-xl">
              <input
                type="text"
                placeholder="Type a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 outline-none border-none"
              />
              <button
                type="button"
                disabled={sendingReply || !replyText.trim()}
                onClick={() => handleSendReply()}
                className="p-2 bg-[#00a884] hover:bg-[#019574] disabled:opacity-40 text-white rounded-xl transition font-bold cursor-pointer shadow-xs flex items-center justify-center"
                title="Send reply"
              >
                <svg className="w-4 h-4 fill-current transform rotate-45" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Viewers List Modal */}
      {viewersModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#111722] border border-slate-800 rounded-3xl p-5 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">Viewers ({currentStatus?.viewedBy?.length || 0})</h3>
              <button onClick={() => { setViewersModalOpen(false); setIsPaused(false); }} className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer">✕</button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-3">
              {currentStatus?.viewedBy && currentStatus.viewedBy.length > 0 ? (
                currentStatus.viewedBy.map((viewer) => (
                  <div key={viewer._id || viewer} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                      {viewer.profilePicture ? (
                        <img src={viewer.profilePicture} alt={viewer.name || "Viewer"} className="w-full h-full object-cover" />
                      ) : (
                        viewer.name?.charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                    <span className="text-xs font-semibold">{viewer.name || "User"}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No views yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default StatusViewerModal;