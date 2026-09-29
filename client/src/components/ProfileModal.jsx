import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
// import { useChatState } from "../context/ChatProvider";
import { useChatState } from "../context/useChatState";

const CLOUDINARY_CLOUD_NAME = "qhyxgx1b";
const CLOUDINARY_PRESET = "chat_upload";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const ProfileModal = ({ isOpen, onClose }) => {
  const { user, setUser, theme } = useChatState();
  const isDark = theme === "dark";

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio(user.bio || "Hey there! I am using Chat App.");
      setProfilePic(user.profilePicture || "");
      setImageFile(null);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let uploadedPicUrl = profilePic;

      if (imageFile) {
        uploadedPicUrl = await uploadToCloudinary(imageFile);
      }

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_URL}/auth/profile`,
        {
          name,
          bio,
          profilePicture: uploadedPicUrl,
        },
        config
      );

      const updatedUserInfo = { ...user, ...data };
      setUser(updatedUserInfo);
      localStorage.setItem("userInfo", JSON.stringify(updatedUserInfo));

      toast.success("Profile updated successfully!");
      onClose();
    } catch (error) {
      console.error("Failed to update profile", error);
      toast.error(error.response?.data?.message || "Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-3xl p-7 shadow-2xl border transition-all backdrop-blur-xl ${
        isDark 
          ? "bg-[#111722]/95 border-slate-800 text-slate-100 shadow-teal-950/20" 
          : "bg-white/95 border-slate-200 text-slate-900 shadow-2xl"
      }`}>
        <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-700/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center text-base shadow-md shadow-teal-500/20">
              👤
            </div>
            <h2 className="text-base font-extrabold tracking-tight">Profile & About</h2>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer text-xs font-bold ${
              isDark ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {/* Avatar Preview & Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <img
                src={
                  imageFile
                    ? URL.createObjectURL(imageFile)
                    : profilePic ||
                      "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"
                }
                alt="Avatar"
                className="w-24 h-24 rounded-3xl object-cover border-2 border-teal-500/50 shadow-xl shadow-teal-500/10"
              />
            </div>
            <label className="text-xs bg-gradient-to-r from-teal-500/15 to-emerald-500/15 hover:from-teal-500/25 hover:to-emerald-500/25 text-teal-400 px-4 py-2 rounded-xl cursor-pointer border border-teal-500/30 transition font-bold shadow-xs">
              Change Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files[0]) setImageFile(e.target.files[0]);
                }}
              />
            </label>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
                isDark
                  ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {/* About / Bio Field */}
          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">About / Status</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Available, At work, Busy"
              className={`w-full text-xs px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs ${
                isDark
                  ? "bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-700/40 mt-4">
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
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl transition cursor-pointer shadow-lg shadow-teal-500/25 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;