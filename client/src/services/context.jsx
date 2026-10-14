import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { api, get, security } from "./api";
const AuthContext = createContext(null);
const ToastContext = createContext(null);
export function AppProviders({ children }) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState(null);
  const [demo, setDemo] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await get("/auth/me");
      } catch {
        return null;
      }
    },
    retry: false,
  });
  useEffect(() => {
    security()
      .then((v) => setDemo(v.demo))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!me.data) return;
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || window.location.origin,
      { withCredentials: true },
    );
    const update = () =>
      queryClient.invalidateQueries({
        predicate: (q) => !["me", "content"].includes(q.queryKey[0]),
      });
    socket.on("refresh", update);
    socket.on("notification", update);
    return () => socket.disconnect();
  }, [me.data?.id, queryClient]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const login = async (values) => {
    const { data } = await api.post("/auth/login", values);
    queryClient.setQueryData(["me"], data.data);
    return data;
  };
  const register = async (values) => {
    const { data } = await api.post("/auth/register", values);
    queryClient.setQueryData(["me"], data.data);
    return data;
  };
  const logout = async () => {
    await api.post("/auth/logout");
    queryClient.clear();
    queryClient.setQueryData(["me"], null);
  };
  return (
    <AuthContext.Provider
      value={{
        user: me.data,
        loading: me.isLoading,
        login,
        register,
        logout,
        demo,
        refresh: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
      }}
    >
      <ToastContext.Provider
        value={(text) => setToast({ text, id: Date.now() })}
      >
        {children}
        {toast && (
          <div className="toast" role="status">
            <span className="toast-dot" />
            {toast.text}
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);
