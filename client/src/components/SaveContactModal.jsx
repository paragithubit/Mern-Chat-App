import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChatState } from "../context/useChatState";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const SaveContactModal = ({ isOpen, onClose, contactData }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAlreadySaved, setIsAlreadySaved] = useState(false);

  const { user, theme } = useChatState();
  const isDark = theme === "dark";

  // Clean and parse incoming contact data (e.g., from the text card format or props)
  const contactName = contactData?.name || "Unknown Contact";
  const rawPhone = contactData?.phone || "";
  const cleanPhone = rawPhone.replace(/\D/g, ""); // strip non-digits for precise matching
  const avatar = contactData?.avatar || "";

  useEffect(() => {
    const checkIfContactExists = async () => {
      if (!isOpen || !cleanPhone || !user?.token) return;

      try {
        setChecking(true);
        const config = {
          headers: { Authorization: `Bearer ${user.token}` },
        };
        // Fetch user's current saved contacts list
        const { data } = await axios.get(`${API_URL}/contacts`, config);

        // Check if the phone number already exists in saved contacts (comparing last 10 digits to be safe)
        const last10Target = cleanPhone.slice(-10);
        const found = data.some((c) => {
          const existingPhoneDigits = (c.phoneNumber || "").replace(/\D/g, "");
          return existingPhoneDigits.slice(-10) === last10Target;
        });

        setIsAlreadySaved(found);
      } catch (err) {
        console.error("Failed to check existing contacts:", err);
      } finally {
        setChecking(false);
      }
    };

    checkIfContactExists();
  }, [isOpen, cleanPhone, user]);

  if (!isOpen) return null;

  const handleSaveContact = async () => {
    if (isAlreadySaved) {
      toast.error("This number is already saved in your contacts.");
      return;
    }

    try {
      setLoading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      await axios.post(
        `${API_URL}/contacts/add`,
        {
          savedName: contactName.trim(),
          phoneNumber: cleanPhone,
        },
        config
      );

      toast.success("Contact saved successfully!");
      setIsAlreadySaved(true);
      onClose();
    } catch (err) {
      console.error("Failed to save contact:", err);
      toast.error(err.response?.data?.message || "Failed to save contact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div
        className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
          isDark
            ? "bg-[#111722] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-700/40">
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>👤</span> Save Contact
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Contact Preview Card */}
        <div className={`flex items-center gap-4 p-4 rounded-2xl border mb-5 ${
          isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-md">
            {avatar ? (
              <img src={avatar} alt={contactName} className="w-full h-full object-cover" />
            ) : (
              contactName?.charAt(0)?.toUpperCase() || "C"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{contactName}</p>
            <p className="text-xs font-mono text-teal-400 truncate mt-0.5">
              +91 {cleanPhone || rawPhone}
            </p>
          </div>
        </div>

        {/* Status Message */}
        {checking ? (
          <div className="text-center py-2 text-xs text-slate-400 animate-pulse mb-4 font-medium">
            Checking address book...
          </div>
        ) : isAlreadySaved ? (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-semibold text-center">
            ⚠️ This number is already saved in your contacts list.
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleSaveContact}
            disabled={loading || checking || isAlreadySaved}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-500/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : isAlreadySaved ? "Already Saved" : "Save to Contacts"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`py-3 px-4 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              isDark
                ? "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveContactModal;