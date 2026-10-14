import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { AppProviders } from "./services/context";
import { Layout, Protected } from "./components/Layout";
import { Loading } from "./components/UI";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./styles/index.css";
const Home = lazy(() => import("./pages/Home"));
const Public = lazy(() => import("./pages/Public"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchInterval: 30000,
    },
  },
});
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MotionConfig reducedMotion="user">
          <AppProviders>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  {[
                    "hospitals",
                    "hospitals/:id",
                    "urgent-requests",
                    "drives",
                    "drives/:id",
                    "campus",
                    "volunteer",
                    "stories",
                    "stories/:id",
                    "about",
                    "contact",
                    "faq",
                    "privacy",
                    "terms",
                    "accessibility",
                    "404",
                  ].map((path) => (
                    <Route key={path} path={path} element={<Public />} />
                  ))}
                  {[
                    "login",
                    "register",
                    "register/donor",
                    "register/hospital",
                    "forgot-password",
                    "reset-password",
                    "verify-email",
                  ].map((path) => (
                    <Route key={path} path={path} element={<Auth />} />
                  ))}
                  <Route element={<Protected roles={["donor"]} />}>
                    <Route
                      path="dashboard"
                      element={<Dashboard mode="donor" />}
                    />
                  </Route>
                  <Route
                    element={<Protected roles={["hospital", "volunteer"]} />}
                  >
                    <Route
                      path="hospital/dashboard"
                      element={<Dashboard mode="hospital" />}
                    />
                  </Route>
                  <Route element={<Protected roles={["admin"]} />}>
                    <Route path="admin" element={<Dashboard mode="admin" />} />
                  </Route>
                  <Route path="*" element={<Public notFound />} />
                </Route>
              </Routes>
            </Suspense>
          </AppProviders>
        </MotionConfig>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
