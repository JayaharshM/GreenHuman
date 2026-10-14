import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, Navigate, Outlet } from "react-router-dom";
import { Droplet, ArrowUpRight, Menu, X, Heart, LogOut } from "lucide-react";
import { useAuth, useToast } from "../services/context";
import { Button, Loading } from "./UI";
import { useQuery } from "@tanstack/react-query";
import { get } from "../services/api";
export const dashboardPath = (role) =>
  role === "admin"
    ? "/admin"
    : role === "hospital" || role === "volunteer"
      ? "/hospital/dashboard"
      : "/dashboard";
function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Lifeline home">
      <span className="logo-mark">
        <Droplet fill="currentColor" strokeWidth={0} />
        <Heart size={11} fill="var(--paper)" stroke="var(--paper)" />
      </span>
      <span>
        lifeline<span className="logo-period">.</span>
      </span>
    </Link>
  );
}
export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout, demo } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const content = useQuery({
    queryKey: ["content"],
    queryFn: () => get("/content"),
  });
  const announcement = content.data?.find((c) => c.key === "announcement");
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    const titles = {
      "/": "Every drop has a story",
      "/hospitals": "Find your place to give",
      "/drives": "Show up. Save lives.",
      "/urgent-requests": "Someone needs you today",
      "/register/donor": "Become a donor",
      "/campus": "Your campus. Your impact.",
    };
    document.title = `Lifeline — ${
      titles[location.pathname] ||
      location.pathname
        .split("/")
        .filter(Boolean)
        .map((s) => s[0]?.toUpperCase() + s.slice(1))
        .join(" · ")
    }`;
    const descriptions = {
      "/hospitals":
        "Discover verified blood donation hospitals and centres by city, blood group or nearby location.",
      "/drives": "Find welcoming community and campus blood donation drives.",
      "/urgent-requests":
        "Browse current, reviewed blood donation requirements by city and blood group.",
      "/campus":
        "Bring your campus together through volunteering, awareness and hospital-coordinated donation drives.",
    };
    document.querySelector('meta[name="description"]').content =
      descriptions[location.pathname] ||
      `${document.title}. A thoughtful community for blood donation, care and connection.`;
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        <span>
          EVERY DROP HAS A STORY. <Heart size={11} />
        </span>
        <span>
          {demo
            ? "DEMO EXPERIENCE · ALL RECORDS ARE FICTITIOUS"
            : "A LITTLE KINDNESS GOES A LONG WAY"}
        </span>
      </div>
      <header className="header">
        <div className="nav-container">
          <Logo />
          <nav
            className={open ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            <NavLink to="/hospitals">Find hospitals</NavLink>
            <NavLink to="/drives">Donation drives</NavLink>
            <NavLink to="/campus">Our community</NavLink>
            <NavLink to="/urgent-requests" className="urgent-nav">
              <i />
              Urgent requests
            </NavLink>
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <Link className="login-link" to={dashboardPath(user.role)}>
                  My dashboard
                </Link>
                <button
                  className="icon-button logout"
                  aria-label="Sign out"
                  onClick={async () => {
                    await logout();
                    toast("You’re signed out. See you soon.");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <Link className="login-link" to="/login">
                  Log in
                </Link>
                <Button to="/register/donor" className="nav-cta">
                  Become a donor
                </Button>
              </>
            )}
            <button
              className="mobile-toggle icon-button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        {location.pathname === "/" && announcement && (
          <div className="published-announcement">
            <b>{announcement.title}</b>
            <span>{announcement.body}</span>
          </div>
        )}
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <div>
              <Logo />
              <p>
                A little of you.
                <br />A whole tomorrow for someone.
              </p>
              <div className="footer-note">
                <Heart size={14} />
                Made for a community that cares.
              </div>
            </div>
            <div>
              <h4>MAKE A DIFFERENCE</h4>
              <Link to="/register/donor">Become a donor</Link>
              <Link to="/hospitals">Find a hospital</Link>
              <Link to="/drives">Join a drive</Link>
              <Link to="/urgent-requests">Blood requirements</Link>
            </div>
            <div>
              <h4>COME TOGETHER</h4>
              <Link to="/campus">Campus community</Link>
              <Link to="/volunteer">Volunteer with us</Link>
              <Link to="/register/hospital">Hospital partnerships</Link>
              <Link to="/stories">Our stories</Link>
            </div>
            <div>
              <h4>GET TO KNOW US</h4>
              <Link to="/about">Our movement</Link>
              <Link to="/contact">Get in touch</Link>
              <Link to="/faq">Your questions, answered</Link>
              <Link to="/accessibility">Accessibility</Link>
            </div>
          </div>
          <div className="footer-wordmark" aria-hidden="true">
            every drop matters<span>↗</span>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} Lifeline.{" "}
              {demo ? "A demonstration platform." : "Every drop has a story."}
            </span>
            <div>
              <Link to="/privacy">Privacy policy</Link>
              <Link to="/terms">Terms of use</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
export function Protected({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (roles && !roles.includes(user.role))
    return <Navigate to={dashboardPath(user.role)} replace />;
  return <Outlet />;
}
