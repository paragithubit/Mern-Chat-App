import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const ResetPasswordPage = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [token, setToken] = useState(params.token || "");

  useEffect(() => {
    if (params.token) {
      setToken(params.token);
    } else {
      const hash = window.location.hash;
      const parts = hash.split("/");
      const extractedToken = parts[parts.length - 1];
      if (extractedToken && extractedToken !== "reset-password") {
        setToken(extractedToken);
      }
    }
  }, [params]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // States for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const config = {
        headers: {
          "Content-Type": "application/json",
        },
      };

      const { data } = await axios.put(
        `https://chat-app-backend-1-ib4u.onrender.com/api/auth/reset-password/${token}`,
        { password },
        config
      );

      setMessage(data.message || "Password reset successful! Redirecting...");
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err) {
      console.error("Password reset error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to reset password. Link may be invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070a0f] text-slate-100 p-4 select-none">
      <div className="w-full max-w-md rounded-3xl p-8 shadow-2xl border border-slate-800/90 bg-[#0b1017]/95 backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 bg-gradient-to-tr from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25 border border-teal-400/20">
            🔒
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Reset Password</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Enter your new secure password below.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs px-4 py-3.5 pr-10 rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/60 transition-all shadow-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none text-sm cursor-pointer"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-xs px-4 py-3.5 pr-10 rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/60 transition-all shadow-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none text-sm cursor-pointer"
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-500/25 transition cursor-pointer disabled:opacity-50 tracking-wide"
          >
            {loading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;