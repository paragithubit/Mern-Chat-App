import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

const AIChatBox = ({ fetchAgain, setFetchAgain, onOpenDrawer }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);

  // WhatsApp-style Reply State
  const [replyingTo, setReplyingTo] = useState(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // State for WhatsApp-style attachment menu popup
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Hidden file input refs
  const docInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const { user, selectedChat, setSelectedChat, socket, chats, setChats, theme } = useChatState();
  const messagesEndRef = useRef(null);

  const isDark = theme === "dark";
  const myId = (user?._id || user?.id)?.toString();

  // Helper: Instantly update Meta AI's latest message and bubble it to top (index 0) of the left panel
  const updateAiSidebarSnippet = (latestMsg) => {
    if (!selectedChat) return;
    const targetChatId = selectedChat._id?.toString();

    setChats((prevChats) => {
      if (!prevChats) return prevChats;

      const chatIndex = prevChats.findIndex(
        (c) => c._id?.toString() === targetChatId
      );

      if (chatIndex !== -1) {
        const targetChat = prevChats[chatIndex];
        const updatedChat = {
          ...targetChat,
          latestMessage: latestMsg,
          updatedAt: new Date().toISOString(),
        };

        const remainingChats = prevChats.filter(
          (c) => c._id?.toString() !== targetChatId
        );
        return [updatedChat, ...remainingChats];
      }
      return prevChats;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.get(
        `http://localhost:7000/api/message/${selectedChat._id}`,
        config
      );
      // Filter out deleted messages permanently so they never reappear after reload
      const validMessages = (data || []).filter((m) => !m.isDeleted);
      setMessages(validMessages);
      setLoading(false);

      if (socket) {
        socket.emit("join chat", selectedChat._id);
      }
    } catch (error) {
      console.error("Failed to load messages", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    setReplyingTo(null);
  }, [selectedChat]);

  useEffect(() => {
    if (!socket) return;

    const messageReceiveHandler = (newMessageRecieved) => {
      if (
        !selectedChat ||
        selectedChat._id?.toString() !== newMessageRecieved.chat?._id?.toString()
      ) {
        return;
      }
      if (newMessageRecieved.isDeleted) return; // Ignore if deleted
      setMessages((prev) => {
        if (prev.some((m) => m._id === newMessageRecieved._id)) return prev;
        return [...prev, newMessageRecieved];
      });
      updateAiSidebarSnippet(newMessageRecieved);
      scrollToBottom();
    };

    const messageDeleteHandler = ({ messageId, message }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));

      setChats((prevChats) => {
        if (!prevChats || !selectedChat) return prevChats;
        return prevChats.map((c) => {
          if (c._id?.toString() === selectedChat._id?.toString()) {
            if (c.latestMessage?._id?.toString() === messageId?.toString()) {
              return {
                ...c,
                latestMessage: message || null,
              };
            }
          }
          return c;
        });
      });
    };

    const chatClearedHandler = ({ chatId }) => {
      if (selectedChat?._id?.toString() === chatId?.toString()) {
        setMessages([]);
      }
      setChats((prevChats) => {
        if (!prevChats) return prevChats;
        return prevChats.map((c) =>
          c._id?.toString() === chatId?.toString()
            ? { ...c, latestMessage: null, unreadCount: 0 }
            : c
        );
      });
    };

    socket.on("message received", messageReceiveHandler);
    socket.on("message deleted", messageDeleteHandler);
    socket.on("chat cleared", chatClearedHandler);

    return () => {
      socket.off("message received", messageReceiveHandler);
      socket.off("message deleted", messageDeleteHandler);
      socket.off("chat cleared", chatClearedHandler);
    };
  }, [socket, selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const sendMessage = async (e, customContent = null) => {
    if (e) e.preventDefault();
    const textToSend = customContent || newMessage;
    if (!textToSend.trim() || !selectedChat || sending) return;

    setNewMessage("");
    setShowAttachMenu(false);
    setReplyingTo(null);

    // Optimistic user message preview
    const tempUserMsg = {
      _id: `temp-${Date.now()}`,
      sender: user,
      content: textToSend,
      chat: selectedChat,
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    updateAiSidebarSnippet(tempUserMsg);

    try {
      setSending(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.post(
        "http://localhost:7000/api/ai/chat",
        {
          content: textToSend,
          chatId: selectedChat._id,
          replyTo: replyingTo ? replyingTo._id : undefined,
        },
        config
      );

      await fetchMessages();

      if (data?.aiMessage || data) {
        const finalAiMsg = data.aiMessage || data;
        updateAiSidebarSnippet(finalAiMsg);
      }

      if (setFetchAgain) setFetchAgain(!fetchAgain);
    } catch (error) {
      console.error("Failed to send message to AI assistant", error);
      toast.error("Failed to get response from Meta AI");
    } finally {
      setSending(false);
    }
  };

  // Native File Explorer Handlers
  const handleDocumentSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const promptText = `Please analyze this uploaded document: ${file.name}`;
      sendMessage(null, promptText);
      toast.success("Document attached!");
    }
  };

  const handleGallerySelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const promptText = `/imagine analyze image file: ${file.name}`;
      sendMessage(null, promptText);
      toast.success("Image attached!");
    }
  };

  // Audio Recording Functions
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Audio recording is not supported on your browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setRecordingDuration(0);
        sendMessage(null, "🎤 [Voice Message Audio Attachment Sent]");
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone permission denied:", err);
      toast.error("Microphone permission denied or unavailable.");
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // WhatsApp-style Delete for Any Message
  const handleDeleteMessage = async (messageId) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        data: { deleteType: "forEveryone" },
      };

      await axios.delete(`http://localhost:7000/api/message/${messageId}`, config);
      const remaining = messages.filter((m) => m._id !== messageId);
      setMessages(remaining);
      setActiveMenuId(null);

      const newLatest = remaining[remaining.length - 1] || null;
      updateAiSidebarSnippet(newLatest);

      if (setFetchAgain) setFetchAgain(!fetchAgain);
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message", error);
      toast.error("Failed to delete message");
    }
  };

  const handleCopyMessage = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setActiveMenuId(null);
    toast.success("Copied to clipboard!");
  };

  const handleClearAllMessages = async () => {
    if (!selectedChat) return;
    const targetChatId = selectedChat._id.toString();

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      try {
        await axios.delete(`http://localhost:7000/api/chat/clear/${targetChatId}`, config);
      } catch (err) {
        await axios.put(`http://localhost:7000/api/message/clear/${targetChatId}`, {}, config);
      }

      setMessages([]);
      setShowClearModal(false);

      setChats((prevChats) => {
        if (!prevChats) return prevChats;
        return prevChats.map((c) =>
          c._id?.toString() === targetChatId
            ? { ...c, latestMessage: null, unreadCount: 0 }
            : c
        );
      });

      if (setSelectedChat) {
        setSelectedChat((prev) => (prev ? { ...prev, latestMessage: null } : prev));
      }

      if (socket) {
        socket.emit("clear chat", { chatId: targetChatId });
      }

      if (setFetchAgain) setFetchAgain(!fetchAgain);
      toast.success("Chat cleared successfully");
    } catch (error) {
      console.error("Failed to clear chat messages", error);
      toast.error("Failed to clear chat");
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full relative transition-colors duration-300 select-none ${
        isDark ? "bg-[#0b141a] text-slate-100" : "bg-[#efeae2] text-slate-900"
      }`}
      onClick={() => { setActiveMenuId(null); setShowAttachMenu(false); }}
    >
      {/* Hidden Native File Inputs */}
      <input 
        type="file" 
        ref={docInputRef} 
        onChange={handleDocumentSelect} 
        className="hidden" 
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx" 
      />
      <input 
        type="file" 
        ref={galleryInputRef} 
        onChange={handleGallerySelect} 
        className="hidden" 
        accept="image/*" 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={handleGallerySelect} 
        className="hidden" 
        accept="image/*" 
        capture="environment" 
      />

      {/* Chat Header */}
      <div
        className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between shadow-xs z-10 transition-colors duration-300 ${
          isDark ? "bg-[#202c33] border-[#222d34] text-slate-100" : "bg-[#f0f2f5] border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center space-x-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedChat(null);
            }}
            className={`md:hidden p-2 rounded-xl transition cursor-pointer flex-shrink-0 text-base font-bold ${
              isDark ? "hover:bg-[#374248] text-slate-300" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Back to Chats"
          >
            ←
          </button>

          <div className="flex items-center space-x-3.5 cursor-pointer min-w-0" onClick={onOpenDrawer}>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              🤖
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm font-bold truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>AI ChatBot</h3>
              <p className="text-[11px] text-purple-400 font-medium truncate">ChatGPT / Gemini Style Assistant</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowClearModal(true)}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Clear Chat"
          >
            🗑️ Clear Chat
          </button>
          <button
            onClick={onOpenDrawer}
            className={`p-2 rounded-xl transition cursor-pointer text-sm ${
              isDark ? "hover:bg-[#374248] text-slate-300" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Chat Info"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
              isDark
                ? "bg-[#222d34] border-[#2a3942] text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold mb-2">Clear conversation?</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will remove all messages from this session. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  isDark
                    ? "bg-[#111b21] border-[#2a3942] text-slate-200 hover:bg-[#182229]"
                    : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllMessages}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition shadow-sm cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream Area */}
      <div 
        className="flex-1 overflow-y-auto px-6 py-5 space-y-3.5" 
        onClick={() => { setActiveMenuId(null); setShowAttachMenu(false); }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <span className="text-xs text-slate-400 animate-pulse">Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-2">
            <div className="text-4xl">✨</div>
            <p className="text-sm font-medium">How can Meta AI help you today?</p>
            <p className="text-xs text-slate-500 max-w-xs">Ask questions, brainstorm ideas, or generate images using /imagine.</p>
          </div>
        ) : (
          messages.map((m, index) => {
            const isFromAi = m.isAiGenerated === true || (m.isAiGenerated === undefined && index % 2 !== 0);
            const isUserMessage = !isFromAi;
            const showMenu = activeMenuId === m._id;

            return (
              <div
                key={m._id || index}
                id={`msg-${m._id}`}
                className={`flex gap-3 w-full ${isUserMessage ? "justify-end" : "justify-start"}`}
              >
                {!isUserMessage && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
                    🤖
                  </div>
                )}

                <div className={`relative group max-w-[85%] sm:max-w-[75%] md:max-w-[480px] ${isUserMessage ? "text-right" : "text-left"}`}>
                  <div
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm leading-relaxed shadow-xs relative select-text ${
                      isUserMessage
                        ? isDark
                          ? "bg-[#005c4b] text-slate-100 rounded-tr-none"
                          : "bg-[#d9fdd3] text-slate-900 rounded-tr-none"
                        : isDark
                        ? "bg-[#202c33] text-slate-100 rounded-tl-none border border-[#2a3942]"
                        : "bg-white text-slate-900 rounded-tl-none border border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(showMenu ? null : m._id);
                      }}
                      className={`absolute top-2 ${isUserMessage ? "left-2" : "right-2"} w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-300 hover:text-white bg-black/20 hover:bg-black/40 transition-all text-xs cursor-pointer z-10`}
                      title="Options"
                    >
                      ⋮
                    </button>

                    {showMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute ${isUserMessage ? "left-0" : "right-0"} top-8 rounded-2xl shadow-2xl border py-2 z-50 w-36 text-xs backdrop-blur-xl ${
                          isDark
                            ? "bg-[#233138] border-[#2a3942] text-slate-200 shadow-black/80"
                            : "bg-white border-slate-200 text-slate-800 shadow-xl"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(m);
                            setActiveMenuId(null);
                          }}
                          className={`w-full text-left px-3.5 py-2 transition cursor-pointer font-medium flex items-center gap-2 ${
                            isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                          }`}
                        >
                          <span>↩</span> Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(m.content)}
                          className={`w-full text-left px-3.5 py-2 transition cursor-pointer font-medium flex items-center gap-2 ${
                            isDark ? "hover:bg-[#182229]" : "hover:bg-slate-100"
                          }`}
                        >
                          <span>📋</span> Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(m._id)}
                          className={`w-full text-left px-3.5 py-2 text-rose-400 font-medium transition cursor-pointer flex items-center gap-2 border-t ${
                            isDark ? "border-[#2a3942] hover:bg-[#182229]" : "border-slate-100 hover:bg-slate-100"
                          }`}
                        >
                          <span>🗑️</span> Delete
                        </button>
                      </div>
                    )}

                    {m.replyTo && (
                      <div 
                        onClick={() => {
                          const targetId = m.replyTo._id || m.replyTo;
                          const el = document.getElementById(`msg-${targetId}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`mb-2 p-2.5 rounded-lg border-l-4 cursor-pointer text-xs text-left ${
                          isUserMessage
                            ? "bg-black/20 border-white/70 text-white/95"
                            : isDark
                            ? "bg-[#111b21] border-[#00a884] text-slate-200"
                            : "bg-slate-100 border-[#00a884] text-slate-700"
                        }`}
                      >
                        <p className="font-bold truncate text-[#00a884]">
                          {m.replyTo.sender?.name || (m.replyTo.isAiGenerated ? "Meta AI" : "You")}
                        </p>
                        <p className="truncate opacity-90 mt-0.5">
                          {m.replyTo.fileType ? `📎 ${m.replyTo.fileType}` : m.replyTo.content}
                        </p>
                      </div>
                    )}

                    {m.fileType === "image" && m.fileUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden bg-black/20 aspect-[4/3]">
                        <img 
                          src={m.fileUrl} 
                          alt="AI Generation" 
                          className="w-full h-full object-cover hover:scale-102 transition duration-300 cursor-pointer" 
                          onClick={() => window.open(m.fileUrl, "_blank")}
                        />
                      </div>
                    )}

                    {m.fileType === "video" && m.fileUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden bg-black/20">
                        <video 
                          src={m.fileUrl} 
                          controls
                          className="w-full h-auto object-cover" 
                        />
                      </div>
                    )}

                    <div className="whitespace-pre-wrap break-words">{m.content}</div>

                    <div
                      className={`text-[10px] mt-1.5 px-1 flex items-center justify-end gap-1.5 select-none font-medium ${
                        isUserMessage
                          ? "text-white/85"
                          : isDark
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                {isUserMessage && (
                  <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex gap-3 w-full justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
              🤖
            </div>
            <div
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm border flex items-center gap-2 shadow-xs ${
                isDark ? "bg-[#202c33] border-[#2a3942] text-[#00a884]" : "bg-white border-slate-200 text-[#00a884]"
              }`}
            >
              <span className="w-2 h-2 bg-[#00a884] rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              <span className="ml-1 font-semibold"> AI Brain is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Replying Preview Bar */}
      {replyingTo && (
        <div
          className={`px-5 py-2.5 border-t flex items-center justify-between flex-shrink-0 ${
            isDark ? "bg-[#202c33] border-[#2a3942] text-slate-200" : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-3 border-l-4 border-[#00a884] pl-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#00a884] truncate">
                Replying to message
              </span>
              <span className="text-xs opacity-90 truncate mt-0.5">
                {replyingTo.fileType ? `📎 ${replyingTo.fileType}` : replyingTo.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="w-8 h-8 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Bar & Attachment Popup Menu */}
      <div
        className={`p-3.5 border-t flex-shrink-0 relative transition-all duration-300 ${
          isDark ? "bg-[#202c33] border-[#222d34]" : "bg-[#f0f2f5] border-slate-200"
        }`}
      >
        {showAttachMenu && (
          <div
            className={`absolute bottom-16 left-4 w-72 rounded-2xl shadow-2xl border p-4 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 ${
              isDark ? "bg-[#233138] border-[#2a3942] text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="grid grid-cols-3 gap-3 text-center select-none">
              <div 
                onClick={() => { galleryInputRef.current?.click(); setShowAttachMenu(false); }}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg group-hover:scale-110 transition">
                  🖼️
                </div>
                <span className="text-xs font-medium">Gallery</span>
              </div>
              <div 
                onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-lg group-hover:scale-110 transition">
                  📷
                </div>
                <span className="text-xs font-medium">Camera</span>
              </div>
              <div 
                onClick={() => { docInputRef.current?.click(); setShowAttachMenu(false); }}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg group-hover:scale-110 transition">
                  📄
                </div>
                <span className="text-xs font-medium">Document</span>
              </div>
            </div>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center justify-between bg-rose-500/10 px-5 py-3 rounded-2xl border border-rose-500/30 animate-pulse">
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
                className="bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs sm:text-sm px-3.5 py-2 rounded-xl cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm px-4.5 py-2 rounded-xl font-semibold shadow-xs cursor-pointer"
              >
                Send Voice Note
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => sendMessage(e)} className="flex items-center gap-3 relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAttachMenu(!showAttachMenu);
              }}
              className={`p-3 rounded-xl transition text-xl cursor-pointer ${
                showAttachMenu
                  ? "text-[#00a884] bg-[#00a884]/20 rotate-45 transform"
                  : isDark
                  ? "hover:bg-[#374248] text-slate-400"
                  : "hover:bg-slate-200 text-slate-600"
              }`}
              title="Attach"
            >
              📎
            </button>

            <input
              type="text"
              placeholder={sending ? "Please wait..." : "Type a message"}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              className={`flex-1 min-w-0 px-4 py-3 text-sm sm:text-base rounded-2xl outline-none border focus:ring-1 focus:ring-[#00a884] transition-all disabled:opacity-50 ${
                isDark
                  ? "bg-[#2a3942] border-transparent text-slate-100 placeholder-slate-400"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />

            <button
              type="button"
              onClick={startRecording}
              className={`p-3 rounded-xl transition text-lg cursor-pointer flex-shrink-0 ${
                isDark ? "hover:bg-[#374248] text-slate-400" : "hover:bg-slate-200 text-slate-600"
              }`}
              title="Record Voice Note"
            >
              🎙️
            </button>

            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="p-3 bg-[#00a884] hover:bg-[#019574] text-white rounded-2xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-xs flex-shrink-0"
              title="Send Message"
            >
              <svg className="w-5 h-5 fill-current transform rotate-45 -mr-0.5" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AIChatBox;