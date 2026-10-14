import { useEffect, useRef, useId, cloneElement } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  ShieldCheck,
  Clock,
  CalendarDays,
  Heart,
  Droplet,
  X,
  Search,
  AlertCircle,
} from "lucide-react";
export const date = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function Button({
  to,
  children,
  secondary = false,
  light = false,
  className = "",
  arrow = true,
  ...props
}) {
  const cls = `button ${secondary ? "secondary" : ""} ${light ? "light" : ""} ${className}`;
  return to ? (
    <Link to={to} className={cls} {...props}>
      {children}
      {arrow && <ArrowUpRight size={18} />}
    </Link>
  ) : (
    <button className={cls} {...props}>
      {children}
      {arrow && <ArrowUpRight size={18} />}
    </button>
  );
}
export function Eyebrow({ children, dark = false }) {
  return (
    <div className={`eyebrow ${dark ? "dark" : ""}`}>
      <span />
      {children}
    </div>
  );
}
export function Reveal({ children, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
export function Heading({ label, title, description, children }) {
  return (
    <div className="section-heading">
      <div>
        {label && <Eyebrow>{label}</Eyebrow>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function PageIntro({ label, title, description, children }) {
  return (
    <section className="page-intro container">
      <Eyebrow>{label}</Eyebrow>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </section>
  );
}
export function Badge({ children, kind = "" }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
export function Empty({
  title = "A little quiet, for now.",
  children,
  icon: Icon = Heart,
}) {
  return (
    <div className="empty">
      <Icon size={30} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>
        {children || "New opportunities will appear here when they’re ready."}
      </p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span />
      <span />
      <span />
      <p>Bringing good things together…</p>
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="empty error" role="alert">
      <AlertCircle />
      <h3>We couldn’t load this just yet.</h3>
      <p>
        {error?.response?.data?.error?.message ||
          "Check that the API and MongoDB are running, then try again."}
      </p>
      {retry && <Button onClick={retry}>Try again</Button>}
    </div>
  );
}
export function QueryState({ query, children }) {
  if (query.isLoading) return <Loading />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  return children(query.data);
}
export function Field({ label, error, children, hint }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-describedby":
          [hint && `${id}-hint`, error && `${id}-error`]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small className="field-error" role="alert" id={`${id}-error`}>
          {error.message || error}
        </small>
      )}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const dialog = useRef();
  useEffect(() => {
    dialog.current.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      className="modal"
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          onClick={onClose}
          className="icon-button"
          aria-label="Close dialog"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function HospitalCard({ hospital: h }) {
  return (
    <article className="hospital-card">
      <div
        className={`hospital-visual ${h.category === "blood_bank" ? "rose" : "cream"}`}
      >
        {h.images?.[0] && (
          <img
            className="hospital-photo"
            src={h.images[0]}
            alt={`${h.name} donation facility`}
            loading="lazy"
          />
        )}
        <span className="hospital-monogram">
          {h.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </span>
        <ShieldCheck size={20} />
        <div className="building-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        {h.demo && <Badge kind="demo">Demo hospital</Badge>}
      </div>
      <div className="hospital-body">
        <div className="card-top">
          <span className="tiny uppercase">{h.city}</span>
          <span
            className={`availability ${h.acceptingDonors ? "available" : ""}`}
          >
            <i />
            {h.acceptingDonors ? "Accepting requests" : "Currently unavailable"}
          </span>
        </div>
        <h3>
          <Link to={`/hospitals/${h._id}`}>{h.name}</Link>
        </h3>
        <p>
          <MapPin size={14} />
          {h.address}
        </p>
        <div className="card-bottom">
          <span>
            {h.distance ? (
              `${(h.distance / 1000).toFixed(1)} km away`
            ) : (
              <>
                <ShieldCheck size={14} />
                Verified profile
              </>
            )}
          </span>
          <Link
            to={`/hospitals/${h._id}`}
            className="round-link"
            aria-label={`View ${h.name}`}
          >
            <ArrowUpRight size={21} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function RequestCard({ request: r, onDetails }) {
  return (
    <article className="request-card">
      <div className="card-top">
        <Badge kind={r.urgency}>
          {r.urgency === "critical" ? <span className="live-dot" /> : null}
          {r.urgency}
        </Badge>
        {r.demo && <span className="tiny">DEMO REQUIREMENT</span>}
      </div>
      <div className="blood-display">
        <span>{r.bloodGroup}</span>
        <Droplet size={38} strokeWidth={1} />
      </div>
      <h3>{r.hospitalId?.name || "Hospital requirement"}</h3>
      <p>
        <MapPin size={14} />
        {r.hospitalId?.city || "See hospital"}
        <span>·</span>
        {r.unitsRequired} units requested
      </p>
      <div className="request-meta">
        <Clock size={13} />
        Updated {date(r.updatedAt)}
      </div>
      <button className="request-action" onClick={() => onDetails(r)}>
        See how you can help
        <ArrowUpRight size={18} />
      </button>
    </article>
  );
}
export function DriveCard({ drive: d, index = 0 }) {
  const day = new Date(d.startDate);
  return (
    <article className="drive-card">
      <Link
        className={`drive-poster ${d.theme || "coral"}`}
        to={`/drives/${d._id}`}
        aria-label={`View ${d.title}`}
      >
        <div className="poster-top">
          <span>LIFELINE / COMMUNITY DRIVES</span>
          <ArrowUpRight size={25} />
        </div>
        <div className="poster-art">
          {index % 3 === 0 ? (
            <>
              <span>
                THE GOOD
                <br />
                KIND OF
                <br />
                <em>GIVING.</em>
              </span>
              <Heart className="poster-icon" size={120} />
            </>
          ) : index % 3 === 1 ? (
            <>
              <span>
                HEARTS
                <br />
                IN THE
                <br />
                <em>RIGHT PLACE.</em>
              </span>
              <svg viewBox="0 0 300 60">
                <path d="M0 30h60l15-20 20 45 20-50 20 25h145" />
              </svg>
            </>
          ) : (
            <>
              <span>
                A LITTLE
                <br />
                TIME.
                <br />
                <em>A LOT OF LIFE.</em>
              </span>
              <Droplet className="poster-icon" size={100} />
            </>
          )}
        </div>
        <div className="poster-bottom">
          <Badge kind="poster">
            {d.demo ? "Illustrative event" : d.status}
          </Badge>
          <span>
            {day
              .toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
              .toUpperCase()}
          </span>
        </div>
      </Link>
      <div className="drive-details">
        <div className="drive-date">
          <b>{day.getDate().toString().padStart(2, "0")}</b>
          <span>
            {day.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
          </span>
        </div>
        <div>
          <h3>
            <Link to={`/drives/${d._id}`}>{d.title}</Link>
          </h3>
          <p>
            <MapPin size={13} />
            {d.venue}
          </p>
          <span className="tiny">
            {d.capacity - d.registeredCount} places available ·{" "}
            {day.toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </article>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search by hospital, city or pincode",
}) {
  return (
    <div className="search-box">
      <Search size={19} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
