import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import WelcomeAuthScreen from "./pages/WelcomeAuthScreen";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";

// Simple Protected Route check wrapper
const ProtectedRoute = ({ children }) => {
  const userInfo = localStorage.getItem("userInfo") || sessionStorage.getItem("userInfo");
  return userInfo ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <div className="w-screen h-screen overflow-hidden m-0 p-0 antialiased select-none">
      {/* Global Modern Toaster for sleek in-app notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#111b21",
            color: "#e2e8f0",
            border: "1px solid #222d34",
            fontSize: "12px",
            borderRadius: "14px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
          },
          success: {
            iconTheme: {
              primary: "#00a884",
              secondary: "#111b21",
            },
          },
          error: {
            iconTheme: {
              primary: "#f43f5e",
              secondary: "#111b21",
            },
          },
        }}
      />

      <Routes>
        <Route path="/" element={<WelcomeAuthScreen />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route 
          path="/chats" 
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } 
        />
        {/* Catch-all route to redirect unknown paths back home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;