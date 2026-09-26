import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your registered email address.");
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

      const { data } = await axios.post(
        "http://localhost:7000/api/auth/forgot-password",
        { email },
        config
      );

      setMessage(data.message || "Password reset link sent to your email.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070a0f] text-slate-100 p-4 select-none">
      <div className="w-full max-w-md rounded-3xl p-8 shadow-2xl border border-slate-800/90 bg-[#0b1017]/95 backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 bg-gradient-to-tr from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25 border border-teal-400/20">
            🔑
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Forgot Password</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Enter your registered email and we'll send you a password reset link.
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
              Email Address
            </label>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs px-4 py-3.5 rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/60 transition-all shadow-xs"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-500/25 transition cursor-pointer disabled:opacity-50 tracking-wide"
          >
            {loading ? "Sending Link..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-teal-400 hover:underline font-semibold transition">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;