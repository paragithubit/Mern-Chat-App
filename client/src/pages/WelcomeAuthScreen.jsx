import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useChatState } from "../context/useChatState";

// Automatically switches between local development and your live Render backend
const API_URL = import.meta.env.VITE_API_URL || "https://chat-app-backend-1-ib4u.onrender.com/api";

const WelcomeAuthScreen = () => {
  const [step, setStep] = useState(0); // 0: Landing, 1: Mobile, 2: OTP, 3: Password/Auth, 4: Google Account Picker, 5: Forgot Password
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("Email");
  const [googleAccounts, setGoogleAccounts] = useState([]);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const navigate = useNavigate();
  const chatContext = useChatState() || {};
  const setUser = chatContext.setUser;

  // 1. Send OTP & Automatically Populate Verification Code Input
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/otp/send-otp`, {
        phone: cleanPhone,
        phoneNumber: cleanPhone,
      });

      setPhone(cleanPhone);
      setStep(2);

      // AUTO-FILL OTP IN CHAT-APP INPUT BOX DIRECTLY
      if (data.devOtp) {
        setOtp(data.devOtp);
        setSuccessMsg(`Verification Code: ${data.devOtp}`);
      } else {
        setSuccessMsg(data.message || "OTP sent to your phone via SMS!");
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(err.response?.data?.message || "Failed to send OTP code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP with Backend and MongoDB
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setError("Please enter a valid 6-digit OTP code");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/otp/verify-otp`, {
        phone: phone,
        phoneNumber: phone,
        otp: cleanOtp,
        enteredOtp: cleanOtp,
        name: name.trim(),
      });

      const userData = data.user
        ? {
            _id: data.user._id,
            name: data.user.name,
            email: data.user.email,
            phone: data.user.phone,
            profilePicture: data.user.profilePicture || "",
            bio: data.user.bio || "",
            token: data.user.token || data.token,
          }
        : {
            _id: data._id || data.id,
            name: name.trim() || `User_${phone.slice(-4)}`,
            phone: phone,
            profilePicture: data.profilePicture || "",
            bio: data.bio || "",
            token: data.token || "otp-session-token",
          };

      // Tab isolation: write strictly to sessionStorage
      sessionStorage.setItem("userInfo", JSON.stringify(userData));

      if (setUser) setUser(userData);
      navigate("/chats", { replace: true });
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError(err.response?.data?.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Registered Accounts from Backend
  const handleSocialClick = async (provider) => {
    setSelectedProvider(provider);
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { data } = await axios.get(`${API_URL}/auth/google-accounts`);
      setGoogleAccounts(data || []);
      setStep(4);
    } catch (err) {
      console.error("Fetch accounts error:", err);
      setGoogleAccounts([]);
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (selectedEmail) => {
    setEmail(selectedEmail);
    setPassword("");
    setShowPassword(false);
    setError("");
    setSuccessMsg("");
    setIsRegisterMode(false);
    setStep(3);
  };

  // 4. Real Backend Email & Password Authentication
  const handleEmailAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }

    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const endpoint = isRegisterMode ? "register-email" : "login-email";

    try {
      const payload = isRegisterMode
        ? { 
            name: name.trim() || cleanEmail.split("@")[0], 
            email: cleanEmail, 
            password: cleanPassword,
            phone: phone.trim().replace(/\D/g, "").slice(-10)
          }
        : { email: cleanEmail, password: cleanPassword };

      const { data } = await axios.post(`${API_URL}/auth/${endpoint}`, payload);

      // Tab isolation: write strictly to sessionStorage
      sessionStorage.setItem("userInfo", JSON.stringify(data));

      if (setUser) setUser(data);
      navigate("/chats", { replace: true });
    } catch (err) {
      console.error("Email auth error:", err);
      setError(err.response?.data?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Forgot Password Backend Integration
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid account email address.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: cleanEmail,
      });
      setSuccessMsg(data.message || "Password reset link sent! Check your email inbox.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.message || "Failed to send reset link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(val);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#02050b] px-4 w-full h-full select-none relative overflow-hidden">
      {/* Background glow styling */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-5 right-5 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 sm:p-10 bg-[#070b14]/90 rounded-[2.5rem] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)] border border-slate-700/40 backdrop-blur-3xl text-center relative z-10 transition-all ring-1 ring-white/5">
        
        <div className="inline-flex items-center justify-center w-18 h-18 bg-gradient-to-tr from-teal-500 via-emerald-400 to-teal-400 text-white rounded-3xl text-3xl mb-5 shadow-2xl shadow-teal-500/30 border border-white/20 ring-4 ring-teal-500/15">
          💬
        </div>

        <h1 className="text-2xl font-extrabold text-slate-100 mb-2 tracking-tight">
          {step === 3 && (isRegisterMode ? "Create Account" : `Sign in with ${selectedProvider}`)}
          {step === 4 && `Choose an account`}
          {step === 5 && `Reset Password`}
          {step !== 3 && step !== 4 && step !== 5 && "Welcome to MERN Chat"}
        </h1>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed px-2 font-normal">
          {step === 0 && "Connect with your friends instantly, securely, and seamlessly."}
          {step === 1 && "Enter your mobile number to receive your secure verification code."}
          {step === 2 && `Enter the 6-digit code sent to +91 ${phone}.`}
          {step === 3 && (isRegisterMode ? "Fill in your details to register a new account" : `Enter your password for ${email}`)}
          {step === 4 && `Select your ${selectedProvider} account to continue`}
          {step === 5 && `Enter your account email to receive a password reset link`}
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-medium text-left break-words shadow-sm flex items-start gap-2.5">
            <span className="text-sm leading-none pt-0.5">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-medium text-left break-words shadow-sm flex items-start gap-2.5">
            <span className="text-sm leading-none pt-0.5">✨</span>
            <div className="flex-1 font-semibold">{successMsg}</div>
          </div>
        )}

        {/* STEP 0: LANDING */}
        {step === 0 && (
          <div className="space-y-3.5">
            <button
              onClick={() => setStep(1)}
              className="w-full py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-600 hover:to-emerald-600 transition-all rounded-2xl text-white font-bold text-xs shadow-lg shadow-teal-500/25 cursor-pointer flex items-center justify-center gap-2.5 tracking-wide active:scale-[0.98]"
            >
              <span className="text-sm">📱</span> Continue with Mobile Number
            </button>

            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">or continue with</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              onClick={() => handleSocialClick("Google")}
              disabled={loading}
              className="w-full py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all rounded-2xl text-slate-200 font-bold text-xs flex items-center justify-center gap-3 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <span className="text-sm">🌐</span> Google Account
            </button>

            <button
              onClick={() => handleSocialClick("Apple ID")}
              disabled={loading}
              className="w-full py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all rounded-2xl text-slate-200 font-bold text-xs flex items-center justify-center gap-3 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <span className="text-sm">🍎</span> Apple ID
            </button>
          </div>
        )}

        {/* STEP 1: PHONE INPUT */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
              <div className="flex items-center bg-slate-900/95 border border-slate-700/60 rounded-2xl px-4 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all shadow-inner">
                <span className="text-xs font-bold text-slate-400 border-r border-slate-700/60 pr-3 mr-3">+91</span>
                <input
                  type="tel"
                  maxLength="10"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  autoFocus
                  className="w-full py-3.5 bg-transparent text-slate-100 outline-none text-xs tracking-wider font-mono placeholder-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition-all rounded-2xl text-white font-bold text-xs disabled:opacity-50 shadow-lg shadow-teal-500/25 cursor-pointer tracking-wide active:scale-[0.98]"
            >
              {loading ? "Sending..." : "Get OTP Code"}
            </button>

            <button
              type="button"
              onClick={() => { setStep(0); setError(""); setSuccessMsg(""); }}
              className="w-full text-center text-xs text-teal-400 hover:text-teal-300 transition-colors pt-2 cursor-pointer font-semibold block"
            >
              ← Back to login options
            </button>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Display Name (For New Users)</label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-900/95 border border-slate-700/60 rounded-2xl text-slate-100 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">6-Digit Verification Code</label>
              <input
                type="text"
                maxLength="6"
                placeholder="• • • • • •"
                value={otp}
                onChange={handleOtpChange}
                required
                autoFocus
                className="w-full px-4 py-3.5 bg-slate-900/95 border border-slate-700/60 rounded-2xl text-slate-100 text-center text-lg tracking-[0.5em] font-mono outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner placeholder-slate-600"
              />
            </div>

            <button
              id="verify-btn"
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition-all rounded-2xl text-white font-bold text-xs disabled:opacity-50 shadow-lg shadow-teal-500/25 cursor-pointer tracking-wide active:scale-[0.98]"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex justify-between items-center pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setError(""); setSuccessMsg(""); }}
                className="text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
              >
                Change Number
              </button>
              <button
                type="button"
                onClick={() => { setStep(0); setOtp(""); setError(""); setSuccessMsg(""); }}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Home
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: REAL DEVICE ACCOUNT PICKER */}
        {step === 4 && (
          <div className="space-y-3.5 text-left">
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {googleAccounts.length > 0 ? (
                googleAccounts.map((acc, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAccount(acc.email)}
                    className="flex items-center space-x-3.5 p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/50 hover:border-teal-500/50 rounded-2xl cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      {acc.name ? acc.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-100 truncate">{acc.name}</h4>
                      <p className="text-[11px] text-slate-400 truncate font-mono mt-0.5">{acc.email}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800">
                  <p className="text-xs text-slate-400 font-semibold px-4">No registered accounts found yet. Register below.</p>
                </div>
              )}
            </div>

            <div className="pt-1">
              <button
                onClick={() => { setIsRegisterMode(true); handleSelectAccount(""); }}
                className="w-full py-3.5 bg-slate-900/60 hover:bg-slate-900 border border-dashed border-slate-700 hover:border-teal-500/50 rounded-2xl text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98]"
              >
                <span className="text-teal-400 text-base font-bold">+</span> Register new email account
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setStep(0); setError(""); setSuccessMsg(""); }}
              className="w-full text-center text-xs text-teal-400 hover:text-teal-300 transition-colors pt-2 cursor-pointer font-semibold block"
            >
              ← Back to login options
            </button>
          </div>
        )}

        {/* STEP 3: EMAIL & PASSWORD FORM */}
        {step === 3 && (
          <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left">
            {isRegisterMode && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-slate-900/95 border border-slate-700/60 rounded-2xl text-slate-100 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
                  <div className="flex items-center bg-slate-900/95 border border-slate-700/60 rounded-2xl px-4 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all shadow-inner">
                    <span className="text-xs font-bold text-slate-400 border-r border-slate-700/60 pr-3 mr-3">+91</span>
                    <input
                      type="tel"
                      maxLength="10"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      required
                      className="w-full py-3.5 bg-transparent text-slate-100 outline-none text-xs tracking-wider font-mono placeholder-slate-600"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {selectedProvider} Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={!email}
                className="w-full px-4 py-3.5 bg-slate-900/95 border border-slate-700/60 rounded-2xl text-slate-100 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner placeholder-slate-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                {!isRegisterMode && (
                  <button
                    type="button"
                    onClick={() => { setError(""); setSuccessMsg(""); setStep(5); }}
                    className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer font-semibold transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center bg-slate-900/95 border border-slate-700/60 rounded-2xl focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all shadow-inner">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus={!!email}
                  className="w-full px-4 py-3.5 bg-transparent text-slate-100 text-xs outline-none pr-12 placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-slate-400 hover:text-slate-200 text-xs cursor-pointer select-none transition-colors"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-teal-400 hover:text-teal-300 cursor-pointer font-semibold transition-colors"
              >
                {isRegisterMode ? "Already have an account? Sign In" : "First time here? Register Account"}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition-all rounded-2xl text-white font-bold text-xs disabled:opacity-50 shadow-lg shadow-teal-500/25 cursor-pointer tracking-wide active:scale-[0.98]"
            >
              {loading ? "Processing..." : (isRegisterMode ? "Register Account" : `Continue with ${selectedProvider}`)}
            </button>

            <div className="flex justify-between items-center pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setError(""); setSuccessMsg(""); handleSocialClick(selectedProvider); }}
                className="text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
              >
                ← Choose different account
              </button>
              <button
                type="button"
                onClick={() => { setStep(0); setError(""); setSuccessMsg(""); }}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Home
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: FORGOT PASSWORD FORM */}
        {step === 5 && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3.5 bg-slate-900/95 border border-slate-700/60 rounded-2xl text-slate-100 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner placeholder-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 transition-all rounded-2xl text-white font-bold text-xs disabled:opacity-50 shadow-lg shadow-teal-500/25 cursor-pointer tracking-wide active:scale-[0.98]"
            >
              {loading ? "Sending Link..." : "Send Reset Link"}
            </button>

            <button
              type="button"
              onClick={() => { setStep(3); setError(""); setSuccessMsg(""); }}
              className="w-full text-center text-xs text-teal-400 hover:text-teal-300 transition-colors pt-2 cursor-pointer font-semibold block"
            >
              ← Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default WelcomeAuthScreen;