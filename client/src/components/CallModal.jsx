import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

// Public free Google STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const CallModal = ({
  isOpen,
  onClose,
  callType = "video", // "video" | "audio"
  isIncoming = false,
  callerData = null,
  targetUserId = null,
  chatId = null,
  isGroup = false,
  isGroupChat = false,
  groupName = "",
  groupUsers = [],
}) => {
  const { user, socket, selectedChat, theme } = useChatState();
  const isDark = theme === "dark";

  const [callActive, setCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(callType === "audio");
  const [callDuration, setCallDuration] = useState(0);
  const [facingMode, setFacingMode] = useState("user");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const durationTimerRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const ringtoneRef = useRef(null);
  
  // Buffer for ICE candidates arriving before remote description is set
  const iceCandidateBufferRef = useRef([]);

  const isGroupCall = isGroup || isGroupChat || Boolean(selectedChat?.isGroupChat);
  const currentChatId = chatId || selectedChat?._id;

  // Initialize ringtone audio object safely
  useEffect(() => {
    try {
      const audio = new Audio("/whatsapp_ringtone.mp3");
      audio.loop = true;
      ringtoneRef.current = audio;
    } catch (e) {
      console.log("Ringtone initialization skipped:", e);
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, []);

  // Handle ringtone playback logic based on call state
  useEffect(() => {
    if (isOpen && !callActive) {
      if (ringtoneRef.current) {
        ringtoneRef.current.play().catch((err) => {
          console.log("Audio autoplay prevented by browser policy:", err);
        });
      }
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [isOpen, callActive]);

  // Safely resolve partner user for display
  const getModalPartner = () => {
    const resolvedTarget = targetUserId || callerData?.from?._id || callerData?.from?.id;
    if (resolvedTarget && selectedChat?.users) {
      return selectedChat.users.find(
        (u) => (u._id || u?.id)?.toString() === resolvedTarget?.toString()
      );
    }
    if (callerData?.from) return callerData.from;
    if (!selectedChat || selectedChat.isGroupChat || !user) return null;
    const myId = (user._id || user.id)?.toString();
    return selectedChat.users?.find(
      (u) => (u._id || u?.id)?.toString() !== myId
    );
  };

  const partner = getModalPartner();

  // Helper to safely apply buffered ICE candidates
  const flushIceCandidates = async (pc) => {
    if (!pc || !pc.remoteDescription) return;
    while (iceCandidateBufferRef.current.length > 0) {
      const candidate = iceCandidateBufferRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding buffered ICE candidate", e);
      }
    }
  };

  // Safe play wrapper to prevent AbortError console warnings
  const safePlayVideo = (videoElement) => {
    if (!videoElement) return;
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Video play error:", err);
        }
      });
    }
  };

  // Setup PeerConnection common listeners & event hooks
  const createPeerConnection = (remoteSocketId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Remote track arrival
    pc.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind, event.streams);
      setCallActive(true);
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      if (remoteVideoRef.current && event.streams && event.streams[0]) {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          safePlayVideo(remoteVideoRef.current);
        }
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        const targetSocket = remoteSocketId || (isIncoming ? callerData?.from?.socketId : targetUserId);
        socket.emit("iceCandidate", {
          to: targetSocket ? targetSocket.toString() : null,
          chatId: currentChatId ? currentChatId.toString() : null,
          candidate: event.candidate,
        });
      }
    };

    return pc;
  };

  // 1. Get media stream and initialize peer connection for Outgoing calls
  const initCall = async (currentFacingMode = "user") => {
    try {
      const constraints = {
        audio: true,
        video: callType === "video" ? { facingMode: { exact: currentFacingMode } } : false,
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (constraintErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video" ? { facingMode: currentFacingMode } : false,
        });
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        safePlayVideo(localVideoRef.current);
      }

      const pc = createPeerConnection();

      // Add local audio/video tracks to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // If initiating an outgoing call, create offer
      if (!isIncoming) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const receiver = targetUserId || partner?._id || partner?.id;
        const effectiveGroupUsers = (groupUsers && groupUsers.length > 0) ? groupUsers : selectedChat?.users;

        if (isGroupCall && effectiveGroupUsers) {
          const myId = (user._id || user.id)?.toString();
          const groupMembers = effectiveGroupUsers
            .map((u) => (u._id || u?.id || u)?.toString())
            .filter((id) => id && id !== myId);

          socket.emit("callUser", {
            usersToCall: groupMembers,
            signalData: offer,
            from: { ...user, socketId: socket.id },
            callType,
            chatId: currentChatId,
            isGroupCall: true,
            groupName: groupName || selectedChat?.chatName || "Group Call",
          });
        } else if (receiver) {
          socket.emit("callUser", {
            userToCall: receiver.toString(),
            signalData: offer,
            from: { ...user, socketId: socket.id },
            callType,
            chatId: null, // Keep chatId null for 1-on-1 calls to avoid routing errors
            isGroupCall: false,
          });
        }

        ringTimeoutRef.current = setTimeout(() => {
          if (!callActive) {
            handleEndCall();
            toast.error("Call ended: No answer.");
          }
        }, 30000);
      }
    } catch (err) {
      console.error("Failed to access camera/mic:", err);
      toast.error("Could not access camera/microphone.");
      cleanupAndClose();
    }
  };

  const switchCamera = async () => {
    try {
      const newMode = facingMode === "user" ? "environment" : "user";
      setFacingMode(newMode);

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => track.stop());
      }

      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: newMode } },
          audio: true,
        });
      } catch (err) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newMode },
          audio: true,
        });
      }

      localStreamRef.current = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
        safePlayVideo(localVideoRef.current);
      }

      const videoTrack = newStream.getVideoTracks()[0];
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    } catch (err) {
      console.error("Failed to switch camera:", err);
      toast.error("Unable to access alternative camera.");
    }
  };

  // Answering incoming call with strict signaling state validation
  const handleAnswerCall = async () => {
    try {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      setCallActive(true);
      startTimer();

      // 1. Acquire local user media first before answering
      const constraints = {
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      }
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        safePlayVideo(localVideoRef.current);
      }

      // 2. Setup peer connection and attach local tracks
      const pc = createPeerConnection(callerData?.from?.socketId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (callerData?.signal) {
        if (pc.signalingState !== "have-remote-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(callerData.signal));
          await flushIceCandidates(pc);
        }

        if (pc.signalingState === "have-remote-offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const myId = (user?._id || user?.id)?.toString();
          const callerId = (callerData?.from?._id || callerData?.from?.id)?.toString();

          socket.emit("answerCall", {
            to: callerData.from?.socketId?.toString(),
            signal: answer,
            chatId: currentChatId,
            callerId: callerId,
            receiverId: myId,
            callType,
          });
        } else {
          console.error("Invalid signaling state for createAnswer:", pc.signalingState);
          toast.error("Call connection failed. Please retry.");
        }
      }
    } catch (err) {
      console.error("Error answering call:", err);
      toast.error("Could not start camera/microphone for call.");
    }
  };

  const startTimer = () => {
    setCallDuration(0);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const cleanupAndClose = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    clearInterval(durationTimerRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    setCallDuration(0);
    setCallActive(false);
    iceCandidateBufferRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    onClose();
  };

  const handleEndCall = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    const targetSocket = isIncoming ? callerData?.from?.socketId : targetUserId;
    const myId = (user?._id || user?.id)?.toString();
    const peerId = (targetUserId || callerData?.from?._id || callerData?.from?.id)?.toString();

    if (socket) {
      socket.emit("endCall", {
        to: targetSocket?.toString(),
        chatId: currentChatId ? currentChatId.toString() : null,
        callerId: isIncoming ? peerId : myId,
        receiverId: isIncoming ? myId : peerId,
        callType,
        wasAnswered: callActive,
      });
    }
    cleanupAndClose();
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      safePlayVideo(localVideoRef.current);
    }
  }, [isOpen, callActive]);

  useEffect(() => {
    if (!isOpen) return;

    if (isIncoming) {
      createPeerConnection(callerData?.from?.socketId);
    } else {
      initCall();
    }

    if (!socket) return;

    const onCallAccepted = async ({ signal }) => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      setCallActive(true);
      startTimer();
      const pc = peerConnectionRef.current;
      if (pc && signal) {
        if (pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushIceCandidates(pc);
        }
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            iceCandidateBufferRef.current.push(candidate);
          }
        }
      } catch (e) {
        console.error("Error adding received ICE candidate", e);
      }
    };

    const onCallEnded = () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      toast("Call ended", { icon: "📞" });
      cleanupAndClose();
    };

    const onUserLeftCall = ({ socketId }) => {
      if (!isGroupCall) {
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current.currentTime = 0;
        }
        cleanupAndClose();
      } else {
        toast("A participant left the call", { icon: "👋" });
      }
    };

    socket.on("callAccepted", onCallAccepted);
    socket.on("iceCandidate", onIceCandidate);
    socket.on("callEnded", onCallEnded);
    socket.on("userLeftCall", onUserLeftCall);

    return () => {
      socket.off("callAccepted", onCallAccepted);
      socket.off("iceCandidate", onIceCandidate);
      socket.off("callEnded", onCallEnded);
      socket.off("userLeftCall", onUserLeftCall);
      cleanupAndClose();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-in fade-in duration-200 select-text">
      <div
        className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border flex flex-col items-center backdrop-blur-2xl select-text ${
          isDark
            ? "bg-[#0b1017]/95 border-slate-800/90 text-slate-100 shadow-teal-950/20"
            : "bg-white/95 border-slate-200/90 text-slate-900 shadow-2xl"
        }`}
      >
        {/* Header Information */}
        <div
          className={`px-6 py-4 w-full flex items-center justify-between border-b z-20 backdrop-blur-md select-none ${
            isDark ? "border-slate-800/80 bg-[#0b1017]/85" : "border-slate-200/80 bg-white/85"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <h4 className="font-bold text-xs tracking-tight select-text">
                {callActive
                  ? `Secure Call Active • ${formatSeconds(callDuration)}`
                  : isIncoming
                  ? `Incoming ${callType} call from ${callerData?.from?.name || (isGroupCall ? groupName || "Group" : "Member")}...`
                  : isGroupCall
                  ? `Starting group ${callType} call (${groupName || selectedChat?.chatName || "Group"})...`
                  : `Establishing secure connection...`}
              </h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <span>🛡️</span> WebRTC E2EE
          </span>

        </div>

        {/* Video Area */}
        <div className="relative w-full h-80 sm:h-96 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${callType === "audio" ? "hidden" : ""}`}
          />

          {/* Audio Avatar / Ringing Display */}
          {(callType === "audio" || !callActive) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 select-none bg-slate-950">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 border-2 border-teal-500/40 flex items-center justify-center text-4xl shadow-2xl shadow-teal-500/20 animate-pulse">
                  {callType === "video" ? "📹" : "🎙️"}
                </div>
                <div className="absolute inset-0 rounded-full border border-teal-400 animate-ping opacity-25"></div>
              </div>
              <div className="text-center select-text">
                <p className="text-slate-100 text-sm font-bold tracking-tight select-text">
                  {isIncoming
                    ? callerData?.from?.name
                    : isGroupCall
                    ? groupName || selectedChat?.chatName || "Group Call"
                    : partner?.name || "Peer"}
                </p>
                <p className="text-slate-400 text-xs font-medium mt-1 select-text">
                  {callActive ? "Connected securely" : "Ringing..."}
                </p>
              </div>
            </div>
          )}

          {/* Local Picture-in-Picture Preview */}
          {callType === "video" && (
            <div className="absolute top-4 right-4 w-32 h-44 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl z-20 select-none">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === "user" ? "transform scale-x-[-1]" : ""}`}
              />
              <span className="absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white">
                You
              </span>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div
          className={`p-5 w-full border-t flex items-center justify-center gap-4 backdrop-blur-md select-none ${
            isDark ? "border-slate-800/80 bg-[#0b1017]/90" : "border-slate-200/80 bg-slate-50/90"
          }`}
        >
          {isIncoming && !callActive ? (
            <>
              <button
                type="button"
                onClick={handleAnswerCall}
                className="group relative inline-flex items-center gap-2.5 px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 cursor-pointer transform active:scale-95"
              >
                <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-sm shadow-inner group-hover:scale-110 transition-transform">
                  📞
                </span>
                <span>Accept Call</span>
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                className="group relative inline-flex items-center gap-2.5 px-7 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-xs shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-red-700 transition-all duration-200 cursor-pointer transform active:scale-95"
              >
                <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-sm shadow-inner group-hover:scale-110 transition-transform">
                  ✕
                </span>
                <span>Decline</span>
              </button>
            </>
          ) : (
            <>
              {/* Mute Mic Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`group relative inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm transform active:scale-95 ${
                  micMuted
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                    : isDark
                    ? "bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80"
                    : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs"
                }`}
                title={micMuted ? "Unmute Mic" : "Mute Mic"}
              >
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm transition-transform group-hover:scale-110 ${
                    micMuted ? "bg-rose-500/20" : isDark ? "bg-slate-700/50" : "bg-slate-100"
                  }`}
                >
                  {micMuted ? "🔇" : "🎙️"}
                </span>
                <span>{micMuted ? "Unmute" : "Mute"}</span>
              </button>

              {/* Turn Off Video Button */}
              {callType === "video" && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`group relative inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm transform active:scale-95 ${
                    videoDisabled
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                      : isDark
                      ? "bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80"
                      : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs"
                  }`}
                  title={videoDisabled ? "Enable Video" : "Disable Video"}
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm transition-transform group-hover:scale-110 ${
                      videoDisabled ? "bg-rose-500/20" : isDark ? "bg-slate-700/50" : "bg-slate-100"
                    }`}
                  >
                    {videoDisabled ? "🚫" : "📹"}
                  </span>
                  <span>{videoDisabled ? "Cam Off" : "Cam On"}</span>
                </button>
              )}

              {/* Switch Camera Button */}
              {callType === "video" && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className={`group relative inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm transform active:scale-95 ${
                    isDark
                      ? "bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80"
                      : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs"
                  }`}
                  title="Switch Camera"
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm transition-transform group-hover:scale-110 ${
                      isDark ? "bg-slate-700/50" : "bg-slate-100"
                    }`}
                  >
                    🔄
                  </span>
                  <span>Flip</span>
                </button>
              )}

              {/* End / Hang Up Button */}
              <button
                type="button"
                onClick={handleEndCall}
                className="group relative inline-flex items-center gap-2.5 px-8 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs shadow-xl shadow-rose-600/30 transition-all duration-200 cursor-pointer transform active:scale-95 tracking-wide"
              >
                <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-sm shadow-inner group-hover:scale-110 transition-transform">
                  📞
                </span>
                <span>End Call Log</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;