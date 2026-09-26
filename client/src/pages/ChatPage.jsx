import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
// import { useChatState } from "../context/ChatProvider";
import { useChatState } from "../context/useChatState";
import MyChats from "../components/MyChats";
import ChatBox from "../components/ChatBox";
import AIChatBox from "../components/AIChatBox";
import StatusList from "../components/StatusList";
import CallsList from "../components/CallsList";
import CallModal from "../components/CallModal";
import StatusViewerModal from "../components/StatusViewerModal";
import ChatInfoDrawer from "../components/ChatInfoDrawer";

const ChatPage = () => {
  const [fetchAgain, setFetchAgain] = useState(false);
  const [activeTab, setActiveTab] = useState("chats"); // Track active sidebar tab ("chats", "status", or "calls")
  const [statuses, setStatuses] = useState([]);
  const [selectedStatusGroup, setSelectedStatusGroup] = useState(null);
  
  // States for side-by-side Chat Info Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMessages, setDrawerMessages] = useState([]);
  
  // Global Calling States to ensure calls ring even when no chat is open
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState("video");
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callerSignalData, setCallerSignalData] = useState(null);

  const { user, selectedChat, setSelectedChat, socket, theme, setChats, chats } = useChatState();

  const isDark = theme === "dark";

  // Fetch statuses globally so MyChats can check active status rings for contacts
  const fetchGlobalStatuses = async () => {
    if (!user?.token) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("http://localhost:7000/api/status", config);
      setStatuses(data);
    } catch (error) {
      console.error("Failed to fetch statuses", error);
    }
  };

  useEffect(() => {
    fetchGlobalStatuses();
  }, [user]);

  // Global socket listener for incoming calls across the entire app
  useEffect(() => {
    if (!socket) return;

    const incomingCallHandler = ({ signal, from, callType: incomingType }) => {
      setCallerSignalData({ signal, from });
      setCallType(incomingType || "video");
      setIsIncomingCall(true);
      setCallModalOpen(true);
    };

    socket.on("incomingCall", incomingCallHandler);

    return () => {
      socket.off("incomingCall", incomingCallHandler);
    };
  }, [socket]);

  // Handler to open the isolated Meta AI chat room
  const handleOpenMetaAI = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.get("http://localhost:7000/api/ai/room", config);
      
      if (!chats.find((c) => c._id === data._id)) {
        setChats([data, ...chats]);
      }
      setSelectedChat(data);
      setActiveTab("chats");
    } catch (error) {
      console.error("Failed to open Meta AI room:", error);
    }
  };

  return (
    <div
      className={`fixed inset-0 w-full h-full flex overflow-hidden select-none antialiased transition-colors duration-300 ${
        isDark ? "bg-[#0b1017] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* Left Sidebar (Conversations / Status / Calls) */}
      <div
        className={`h-full border-r flex-shrink-0 transition-all duration-300 shadow-sm ${
          isDark
            ? "border-slate-800/80 bg-[#0b1017]"
            : "border-slate-200/90 bg-white"
        } ${
          selectedChat || activeTab === "status" || activeTab === "calls"
            ? "hidden md:flex md:w-[390px] lg:w-[430px]"
            : "flex w-full md:w-[390px] lg:w-[430px]"
        }`}
      >
        {user && (
          <MyChats
            fetchAgain={fetchAgain}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            statuses={statuses}
            onOpenStatus={(group) => setSelectedStatusGroup(group)}
          />
        )}
      </div>

      {/* Right Content Area & Side-by-Side Info Drawer Container */}
      <div
        className={`h-full flex-1 min-w-0 overflow-hidden flex flex-col transition-all duration-300 relative ${
          isDark ? "bg-[#070a0f]" : "bg-[#f1f5f9]"
        } ${selectedChat || activeTab === "calls" || activeTab === "status" ? "flex w-full md:w-auto" : "hidden md:flex"}`}
      >
        {/* Mobile Navigation Header when viewing Status or Calls on small screens */}
        {!selectedChat && (activeTab === "status" || activeTab === "calls") && (
          <div
            className={`md:hidden flex items-center px-4 py-3.5 border-b flex-shrink-0 shadow-xs ${
              isDark ? "bg-[#0b1017] border-slate-800/80 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <button
              onClick={() => setActiveTab("chats")}
              className="flex items-center gap-1.5 text-xs font-bold text-teal-500 hover:text-teal-400 cursor-pointer"
            >
              <span>←</span> Back to Chats
            </button>
            <span className="ml-auto text-xs font-extrabold uppercase tracking-wider text-teal-400">
              {activeTab}
            </span>
          </div>
        )}

        {/* Center Workspace / ChatBox, AIChatBox, StatusList, or CallsList */}
        <div className="h-full flex-1 min-w-0 flex flex-col relative transition-all duration-300">
          {user && (
            <>
              {activeTab === "status" ? (
                <StatusList onStatusUpdate={fetchGlobalStatuses} />
              ) : activeTab === "calls" ? (
                <CallsList />
              ) : selectedChat?.isAIBot ? (
                <AIChatBox
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                  onOpenDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
                />
              ) : (
                <ChatBox
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                  activeTab={activeTab}
                  onOpenDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
                  messages={drawerMessages}
                  setMessages={setDrawerMessages}
                />
              )}
            </>
          )}
        </div>

        {/* Right-Side Info Drawer (Sits side-by-side without covering chat components, matching WhatsApp Web layout) */}
        {isDrawerOpen && selectedChat && activeTab === "chats" && (
          <div className="h-full w-[350px] lg:w-[400px] flex-shrink-0 relative z-20 shadow-2xl backdrop-blur-md border-l border-slate-800/40">
            <ChatInfoDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              messages={drawerMessages}
            />
          </div>
        )}
      </div>

      {/* Status Viewer Modal for Sidebar Avatar Clicks */}
      <StatusViewerModal
        isOpen={!!selectedStatusGroup}
        onClose={() => setSelectedStatusGroup(null)}
        statusGroup={selectedStatusGroup}
      />

      {/* Global Call Modal Popup (Rings anywhere in the app) */}
      <CallModal
        isOpen={callModalOpen}
        onClose={() => {
          setCallModalOpen(false);
          setIsIncomingCall(false);
          setCallerSignalData(null);
        }}
        callType={callType}
        isIncoming={isIncomingCall}
        callerData={callerSignalData}
      />
    </div>
  );
};

export default ChatPage;