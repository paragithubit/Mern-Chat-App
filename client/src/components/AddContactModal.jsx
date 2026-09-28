import React, { useState, useEffect } from "react";
import axios from "axios";
import { useChatState } from "../context/useChatState";

const AddContactModal = ({ isOpen, onClose, onContactAdded }) => {
  const [savedName, setSavedName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, theme } = useChatState();
  const isDark = theme === "dark";

  // Reset form state whenever the modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setSavedName("");
      setPhoneNumber("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanName = savedName.trim();
    const cleanPhone = phoneNumber.replace(/\D/g, "").slice(-10);

    if (!cleanName) {
      setError("Please enter a contact name.");
      return;
    }

    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setLoading(true);
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
      };

      await axios.post(
        "https://chat-app-backend-1-ib4u.onrender.com/api/contacts/add",
        {
          savedName: cleanName,
          phoneNumber: cleanPhone,
        },
        config
      );

      setLoading(false);
      if (onContactAdded) onContactAdded(); // Refresh list in parent view
      onClose();
    } catch (err) {
      setLoading(false);

      // 409 Conflict: Phone number already exists in address book
      if (err.response?.status === 409) {
        setError(
          err.response.data?.message ||
            "This phone number is already saved in your contacts."
        );
      } else {
        setError(
          err.response?.data?.message || "Failed to add contact. Please try again."
        );
      }
    }
  };

  const handlePhoneChange = (e) => {
    // Only accept numeric digits up to 10 characters
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(val);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
          isDark
            ? "bg-[#111722] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-700/40">
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>👤</span> Add New Contact
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center bg-slate-800/40 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-xs text-rose-400 font-medium text-left break-words flex items-start gap-2 shadow-sm">
            <span className="text-sm leading-none pt-0.5">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Contact Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={savedName}
              onChange={(e) => setSavedName(e.target.value)}
              className={`w-full text-xs px-3.5 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                isDark
                  ? "bg-slate-900/80 border-slate-700 text-slate-100 placeholder-slate-600"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Phone Number
            </label>
            <div
              className={`flex items-center rounded-xl border transition-all px-3.5 focus-within:ring-2 focus-within:ring-teal-500 ${
                isDark
                  ? "bg-slate-900/80 border-slate-700 text-slate-100"
                  : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 pr-2 border-r border-slate-700/50 mr-2">
                +91
              </span>
              <input
                type="tel"
                maxLength="10"
                placeholder="9876543210"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="w-full text-xs py-3 bg-transparent outline-none tracking-wider font-mono placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              type="submit"
              disabled={loading || phoneNumber.length !== 10 || !savedName.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-500/25 transition cursor-pointer disabled:opacity-50 tracking-wide active:scale-[0.98]"
            >
              {loading ? "Saving..." : "Save Contact"}
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
        </form>
      </div>
    </div>
  );
};

export default AddContactModal;