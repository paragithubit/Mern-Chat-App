import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
// import { useChatState } from "../context/ChatProvider";
import { useChatState } from "../context/useChatState";
import { generateKeyPair, exportKey } from "../utils/crypto";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const chatContext = useChatState() || {};
  const setUser = chatContext.setUser;

  // Auto-detect phone and advance to step 2 if passed from WelcomeAuthScreen
  const initialPhone = location.state?.phone || "";
  const [step, setStep] = useState(initialPhone ? 2 : 1);
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Helper to handle client-side E2EE key pair generation upon successful authentication
  const handleUserEncryptionKeys = async (token) => {
    try {
      let localPrivateKey = localStorage.getItem("chat_private_key");

      // If private key doesn't exist in browser storage, generate a new pair
      if (!localPrivateKey) {
        const keyPair = await generateKeyPair();

        // Export and store Private Key locally as JWK
        const exportedPriv = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
        localStorage.setItem("chat_private_key", JSON.stringify(exportedPriv));

        // Export Public Key to SPKI string format
        const exportedPub = await exportKey(keyPair.publicKey, "spki");

        // Sync public key to backend server
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };
        await axios.put(
          `${API_URL}/user/update-public-key`,
          { publicKey: exportedPub },
          config
        );
      }
    } catch (cryptoErr) {
      console.error("E2EE key generation/sync error during login:", cryptoErr);
    }
  };

  // 1. Send OTP via Backend Gateway
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/auth/send-otp`, {
        phone: cleanPhone,
      });
      
      setPhone(cleanPhone);
      setStep(2);
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(
        err.response?.data?.message || "Failed to send OTP code. Try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP code directly with Backend
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);

      const { data } = await axios.post(
        `${API_URL}/auth/verify-otp`,
        {
          phone: cleanPhone,
          otp: cleanOtp,
          name: name.trim(),
        }
      );

      const userData = data.user
        ? { ...data.user, token: data.token }
        : {
            _id: data._id || data.id,
            name: data.name,
            phone: data.phone,
            profilePicture: data.profilePicture,
            bio: data.bio,
            lastSeen: data.lastSeen,
            token: data.token,
          };

      // Automatically initialize E2EE key pair and upload public key
      await handleUserEncryptionKeys(userData.token);

      sessionStorage.setItem("userInfo", JSON.stringify(userData));
      localStorage.setItem("userInfo", JSON.stringify(userData));

      if (setUser) setUser(userData);
      navigate("/chats", { replace: true });
    } catch (err) {
      console.error("OTP verification error:", err);
      setError(
        err.response?.data?.message || "Invalid OTP code or server authentication error."
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit OTP when all 6 digits are typed or pasted
  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(val);
    if (val.length === 6 && !loading) {
      setTimeout(() => {
        const formBtn = document.getElementById("submit-otp-btn");
        if (formBtn) formBtn.click();
      }, 50);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#070a0f] px-4 w-full h-full select-none">
      <div className="w-full max-w-md p-8 bg-[#0b1017]/95 rounded-3xl shadow-2xl border border-slate-800/90 backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-teal-500 to-emerald-500 text-white rounded-2xl text-3xl mb-3 shadow-lg shadow-teal-500/25 border border-teal-400/20">
            💬
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">WhatsApp Verification</h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            {step === 1
              ? "Verify your 10-digit mobile number"
              : `Enter the 6-digit code sent to +91 ${phone}. Check VS Code terminal.`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold text-center break-words">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <div className="flex items-center bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition shadow-xs">
                <span className="text-xs font-bold text-slate-400 border-r border-slate-700/80 pr-2.5 mr-2.5">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength="10"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  required
                  autoFocus
                  className="w-full py-3 bg-transparent text-slate-100 outline-none text-xs tracking-wider font-mono placeholder-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition rounded-xl text-white font-bold text-xs disabled:opacity-50 mt-2 shadow-lg shadow-teal-500/25 cursor-pointer tracking-wide"
            >
              {loading ? "Sending SMS..." : "Get OTP Code"}
            </button>
            
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-center text-xs text-teal-400 hover:underline transition pt-2 cursor-pointer font-semibold block"
            >
              ← Back to welcome screen
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Display Name (Optional for new users)
              </label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition shadow-xs placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength="6"
                placeholder="123456"
                value={otp}
                onChange={handleOtpChange}
                required
                autoFocus
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-center text-lg tracking-widest font-mono outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition shadow-xs placeholder-slate-500"
              />
            </div>

            <button
              id="submit-otp-btn"
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition rounded-xl text-white font-bold text-xs disabled:opacity-50 shadow-lg shadow-teal-500/25 cursor-pointer tracking-wide"
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>

            <div className="flex justify-between items-center pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                }}
                className="text-teal-400 hover:underline transition cursor-pointer"
              >
                Change Mobile Number
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                Welcome Screen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;