import React, { useState } from "react";
import axios from "axios";
// import { useChatState } from "../context/ChatProvider";
import { useChatState } from "../context/useChatState";

const MediaDrawer = ({ isOpen, onClose, messages = [] }) => {
  const [activeTab, setActiveTab] = useState("media"); // "media" | "docs" | "audio"
  const { theme } = useChatState();
  const isDark = theme === "dark";

  if (!isOpen) return null;

  // Filter messages that contain valid files and are not deleted
  const sharedFiles = (messages || []).filter((m) => m.fileUrl && !m.isDeleted);

  const images = sharedFiles.filter((m) => m.fileType === "image");
  const docs = sharedFiles.filter((m) => m.fileType === "document");
  const audios = sharedFiles.filter((m) => m.fileType === "audio");

  // Direct download handler via backend proxy
  const handleDirectDownload = (fileUrl, fileName) => {
    if (!fileUrl) return;

    const proxyDownloadUrl = `https://chat-app-backend-1-ib4u.onrender.com/api/message/download?url=${encodeURIComponent(
      fileUrl
    )}&filename=${encodeURIComponent(fileName || "document.pdf")}`;

    const link = document.createElement("a");
    link.href = proxyDownloadUrl;
    link.setAttribute("download", fileName || "document.pdf");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      {/* Background Backdrop (click to close) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div
        className={`relative z-10 w-80 md:w-96 h-full border-l shadow-2xl flex flex-col transition-colors duration-200 select-none backdrop-blur-xl ${
          isDark
            ? "bg-[#0b1017]/95 border-slate-800 text-slate-100"
            : "bg-white/95 border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between flex-shrink-0 backdrop-blur-md ${
            isDark ? "bg-[#0e141e]/90 border-slate-800" : "bg-slate-50/90 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center text-sm border border-teal-500/20">
              📁
            </span>
            <h3 className="font-extrabold text-sm md:text-base tracking-tight">Shared Media & Docs</h3>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition cursor-pointer ${
              isDark
                ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Close Drawer"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div
          className={`flex border-b text-xs font-bold flex-shrink-0 ${
            isDark
              ? "bg-[#0b1017] border-slate-800 text-slate-400"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        >
          <button
            onClick={() => setActiveTab("media")}
            className={`flex-1 py-3 text-center transition border-b-2 cursor-pointer ${
              activeTab === "media"
                ? "border-teal-500 text-teal-400 font-extrabold bg-teal-500/5"
                : "border-transparent hover:text-slate-200"
            }`}
          >
            Media ({images.length})
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={`flex-1 py-3 text-center transition border-b-2 cursor-pointer ${
              activeTab === "docs"
                ? "border-teal-500 text-teal-400 font-extrabold bg-teal-500/5"
                : "border-transparent hover:text-slate-200"
            }`}
          >
            Docs ({docs.length})
          </button>
          <button
            onClick={() => setActiveTab("audio")}
            className={`flex-1 py-3 text-center transition border-b-2 cursor-pointer ${
              activeTab === "audio"
                ? "border-teal-500 text-teal-400 font-extrabold bg-teal-500/5"
                : "border-transparent hover:text-slate-200"
            }`}
          >
            Audio ({audios.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Photos / Media Grid */}
          {activeTab === "media" && (
            <div>
              {images.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner ${
                    isDark ? "bg-slate-900 border border-slate-800 text-slate-500" : "bg-slate-100 border border-slate-200 text-slate-400"
                  }`}>
                    🖼️
                  </div>
                  <p className="text-xs font-semibold text-slate-400">No photos shared yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((m) => (
                    <div
                      key={m._id}
                      className={`relative aspect-square rounded-xl overflow-hidden border group shadow-xs ${
                        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-100"
                      }`}
                    >
                      <img
                        src={m.fileUrl}
                        alt="shared media"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition backdrop-blur-xs">
                        <a
                          href={m.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-xl transition shadow-md"
                          title="View Full Resolution"
                        >
                          🔍
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            handleDirectDownload(
                              m.fileUrl,
                              `photo_${new Date(m.createdAt || Date.now()).getTime()}.jpg`
                            )
                          }
                          className="text-xs bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-xl transition shadow-md cursor-pointer"
                          title="Download Photo"
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documents List */}
          {activeTab === "docs" && (
            <div className="space-y-2.5">
              {docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner ${
                    isDark ? "bg-slate-900 border border-slate-800 text-slate-500" : "bg-slate-100 border border-slate-200 text-slate-400"
                  }`}>
                    📄
                  </div>
                  <p className="text-xs font-semibold text-slate-400">No documents shared yet</p>
                </div>
              ) : (
                docs.map((m) => (
                  <div
                    key={m._id}
                    onClick={() =>
                      handleDirectDownload(m.fileUrl, m.content || "document.pdf")
                    }
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer group select-none shadow-xs ${
                      isDark
                        ? "bg-[#0b1017]/80 border-slate-800 hover:bg-[#111823] hover:border-slate-700"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="Click to download document"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform flex-shrink-0">
                      📄
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-bold truncate transition-colors ${
                          isDark
                            ? "text-slate-100 group-hover:text-teal-400"
                            : "text-slate-900 group-hover:text-teal-600"
                        }`}
                      >
                        {m.content || "Document File"}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(m.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 group-hover:text-teal-400 transition flex-shrink-0">
                      ⬇️
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Audio / Voice Notes List */}
          {activeTab === "audio" && (
            <div className="space-y-3">
              {audios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner ${
                    isDark ? "bg-slate-900 border border-slate-800 text-slate-500" : "bg-slate-100 border border-slate-200 text-slate-400"
                  }`}>
                    🎙️
                  </div>
                  <p className="text-xs font-semibold text-slate-400">No audio messages shared yet</p>
                </div>
              ) : (
                audios.map((m) => (
                  <div
                    key={m._id}
                    className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 shadow-xs ${
                      isDark
                        ? "bg-[#0b1017]/80 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="flex items-center gap-1.5 font-bold text-teal-400">
                        🎙️ Voice Note
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(m.createdAt || Date.now()).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleDirectDownload(
                              m.fileUrl,
                              `voice_${new Date(m.createdAt || Date.now()).getTime()}.webm`
                            )
                          }
                          className="text-xs text-slate-400 hover:text-teal-400 transition cursor-pointer font-bold"
                          title="Download Voice Note"
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                    <audio controls src={m.fileUrl} className="w-full h-8 outline-none opacity-90 rounded-xl" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaDrawer;