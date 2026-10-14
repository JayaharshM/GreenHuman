import { useState, lazy, Suspense } from "react";
import {
  useLocation,
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Heart,
  MapPin,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Navigation,
  List,
  Map as MapIcon,
  CalendarDays,
  Users,
  Check,
  Plus,
  Minus,
  Mail,
  ArrowLeft,
  Building2,
  Sparkles,
} from "lucide-react";
import { bloodGroups, contactSchema } from "../../../shared/validation";
import { api, get, message } from "../services/api";
import { useAuth, useToast } from "../services/context";
import {
  Button,
  PageIntro,
  Eyebrow,
  Heading,
  Badge,
  HospitalCard,
  RequestCard,
  DriveCard,
  QueryState,
  Empty,
  Field,
  Modal,
  Loading,
  SearchBox,
  date,
  Reveal,
} from "../components/UI";
const HospitalMap = lazy(() => import("../components/Map"));
export function RequestDialog({ request: r, onClose }) {
  return (
    <Modal title="A little help starts here." onClose={onClose}>
      <div className="request-dialog-top">
        <strong>{r.bloodGroup}</strong>
        <div>
          <Badge kind={r.urgency}>{r.urgency}</Badge>
          <h3>{r.hospitalId?.name}</h3>
          <p>
            <MapPin size={14} />
            {r.hospitalId?.city} · {r.unitsRequired} units requested
          </p>
        </div>
      </div>
      {r.demo && (
        <div className="notice">
          Demonstration requirement. This is fictitious and does not represent a
          real medical need.
        </div>
      )}
      <p>{r.description}</p>
      <h4>Before you visit</h4>
      <p>{r.instructions}</p>
      <p className="muted">
        Updated {date(r.updatedAt)} · Expires {date(r.expiresAt)}
      </p>
      <p className="muted">
        Your request will be reviewed by the hospital. A healthcare professional
        will determine eligibility at the donation site.
      </p>
      <Button to={`/hospitals/${r.hospitalId?._id}?request=${r._id}`}>
        Request a visit
      </Button>
    </Modal>
  );
}
function Hospitals() {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [city, setCity] = useState(params.get("city") || "");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState("name");
  const [accepting, setAccepting] = useState(false);
  const [view, setView] = useState("list");
  const [coords, setCoords] = useState(null);
  const [radius, setRadius] = useState("25");
  const [locating, setLocating] = useState(false);
  const toast = useToast();
  const query = new URLSearchParams({
    q,
    city,
    bloodGroup: group,
    sort,
    accepting: String(accepting),
    limit: "50",
  });
  const hospitals = useQuery({
    queryKey: ["hospitals", q, city, group, sort, accepting, coords, radius],
    queryFn: () =>
      get(
        coords
          ? `/hospitals/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${radius}`
          : `/hospitals?${query}`,
      ),
  });
  const sponsored = useQuery({
    queryKey: ["featured"],
    queryFn: () => get("/sponsorships/featured"),
  });
  const locate = () => {
    if (!navigator.geolocation) {
      toast("Location is unavailable. You can search by city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        toast("Location access wasn’t available. Choose your city instead.");
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };
  return (
    <>
      <PageIntro
        label="FIND YOUR PLACE TO GIVE"
        title={
          <>
            Your city.
            <br />
            <em>Your kind of impact.</em>
          </>
        }
        description="A welcoming place. A trusted care team. Your next step starts here."
      />
      <section className="container listing-section">
        <div className="discovery-bar">
          <SearchBox
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCoords(null);
            }}
          />
          <Button secondary onClick={locate} disabled={locating} arrow={false}>
            <Navigation size={17} />
            {locating ? "Finding you…" : "Near me"}
          </Button>
        </div>
        <div className="discovery-controls">
          <div className="select-filters">
            <label>
              City
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setCoords(null);
                }}
              >
                <option value="">All cities</option>
                {[
                  "Pune",
                  "Mumbai",
                  "Bengaluru",
                  "Delhi",
                  "Chennai",
                  "Hyderabad",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Blood group
              <select
                aria-label="Blood group"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setCoords(null);
                }}
              >
                <option value="">All groups</option>
                {bloodGroups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            {coords ? (
              <label>
                Within
                <select
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                >
                  {[5, 10, 25, 50, 100].map((n) => (
                    <option value={n} key={n}>
                      {n} km
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="name">Hospital name</option>
                  <option value="recent">Recently updated</option>
                  <option value="accepting">Accepting donors</option>
                </select>
              </label>
            )}
          </div>
          <div className="view-switch">
            <button
              aria-label="List view"
              aria-pressed={view === "list"}
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <List size={18} />
              List
            </button>
            <button
              aria-label="Map view"
              aria-pressed={view === "map"}
              className={view === "map" ? "active" : ""}
              onClick={() => setView("map")}
            >
              <MapIcon size={18} />
              Map
            </button>
          </div>
        </div>
        <div className="results-meta">
          <span>
            {hospitals.data?.length ?? "…"} verified hospitals{" "}
            {coords
              ? "near your location"
              : city
                ? `in ${city}`
                : "to discover"}
          </span>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={accepting}
              onChange={(e) => {
                setAccepting(e.target.checked);
                setCoords(null);
              }}
            />
            Accepting donation requests
          </label>
          {coords && (
            <button className="text-button" onClick={() => setCoords(null)}>
              Clear location
            </button>
          )}
        </div>
        <QueryState query={hospitals}>
          {(data) =>
            data.length ? (
              view === "map" ? (
                <Suspense fallback={<Loading />}>
                  <HospitalMap hospitals={data} />
                </Suspense>
              ) : (
                <div className="grid three">
                  {data.map((h) => (
                    <HospitalCard hospital={h} key={h._id} />
                  ))}
                </div>
              )
            ) : (
              <Empty title="No hospitals in this search, yet.">
                Try another city or broaden your filters.
              </Empty>
            )
          }
        </QueryState>
        {!!sponsored.data?.length && (
          <div className="sponsored-section">
            <div className="section-heading">
              <h3>Community spotlight</h3>
              <Badge kind="sponsored">Sponsored placements</Badge>
            </div>
            {sponsored.data.map((s) => (
              <div className="sponsor-row" key={s._id}>
                <Building2 size={30} />
                <div>
                  <span className="tiny">
                    SPONSORED {s.demo ? "· DEMONSTRATION CAMPAIGN" : ""}
                  </span>
                  <h3>{s.hospitalId.name}</h3>
                  <p>{s.description}</p>
                </div>
                <Link
                  to={`/hospitals/${s.hospitalId._id}`}
                  className="round-link"
                  aria-label={`Visit sponsor ${s.hospitalId.name}`}
                  onClick={() =>
                    api.post(`/sponsorships/${s._id}/click`).catch(() => {})
                  }
                >
                  <ArrowUpRight />
                </Link>
              </div>
            ))}
            <p className="tiny muted">
              Sponsorship supports visibility. It does not affect clinical
              urgency or verification.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
function AppointmentForm({ hospital, requestId, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useForm({ defaultValues: { preferredDate: "", note: "" } });
  if (!user)
    return (
      <Modal title="Your next step starts here." onClose={onClose}>
        <p>Create your donor profile or sign in to request an appointment.</p>
        <Button
          to={`/login?next=${encodeURIComponent(`/hospitals/${hospital._id}${requestId ? `?request=${requestId}` : ""}`)}`}
        >
          Sign in to continue
        </Button>
      </Modal>
    );
  return (
    <Modal title="Make a little time for good." onClose={onClose}>
      <p>
        Request a visit to <b>{hospital.name}</b>. The hospital will confirm an
        actual date and time.
      </p>
      {hospital.demo && (
        <div className="notice">
          Demo hospital: this creates a local test appointment only.
        </div>
      )}
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          try {
            await api.post("/appointments", {
              hospitalId: hospital._id,
              ...(requestId ? { bloodRequestId: requestId } : {}),
              ...values,
            });
            qc.invalidateQueries();
            toast("Visit requested. You’ll hear when the hospital confirms.");
            onClose();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        })}
      >
        <Field
          label="Preferred date"
          error={form.formState.errors.preferredDate}
        >
          <input
            type="date"
            min={new Date().toLocaleDateString("en-CA")}
            {...form.register("preferredDate", {
              required: "Choose a preferred date.",
            })}
          />
        </Field>
        <Field
          label="Anything the coordinator should know? (optional)"
          hint="Please don’t include private medical or patient details."
        >
          <textarea rows={3} maxLength={500} {...form.register("note")} />
        </Field>
        <p className="muted">
          A request is not a confirmed appointment or medical clearance. Your
          wellbeing comes first; on-site screening is required.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
            {!user.isVerified && (
              <Link to="/dashboard"> Manage email verification</Link>
            )}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Sending your request…" : "Request a visit"}
        </Button>
      </form>
    </Modal>
  );
}
function HospitalDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [booking, setBooking] = useState(false);
  const [selected, setSelected] = useState(null);
  const query = useQuery({
    queryKey: ["hospital", id],
    queryFn: () => get(`/hospitals/${id}`),
  });
  return (
    <section className="container detail-page">
      <Link to="/hospitals" className="back-link">
        <ArrowLeft size={16} />
        All hospitals
      </Link>
      <QueryState query={query}>
        {(h) => (
          <>
            <div className="hospital-detail-hero">
              <div>
                <Eyebrow>{h.city} / VERIFIED PARTNER PROFILE</Eyebrow>
                <h1>{h.name}</h1>
                <p>
                  <MapPin size={17} />
                  {h.address}, {h.pincode}
                </p>
                <div className="flex-badges">
                  <Badge kind="verified">
                    <ShieldCheck size={13} />
                    Verified profile
                  </Badge>
                  {h.demo && (
                    <Badge kind="demo">Fictitious demo hospital</Badge>
                  )}
                </div>
              </div>
              <span className="detail-monogram">
                {h.name[0]}
                <Plus size={35} />
              </span>
            </div>
            {!!h.images?.length && (
              <div className="hospital-gallery">
                {h.images.map((src, i) => (
                  <img
                    src={src}
                    key={src}
                    alt={`${h.name} facility photograph ${i + 1}`}
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            <div className="detail-layout">
              <div>
                <section>
                  <h2>A place to make a difference.</h2>
                  <p>{h.description}</p>
                  {h.demo && (
                    <div className="notice">
                      This hospital is fictitious. Verification and contact
                      information are demonstration data. Do not travel to this
                      address for this listing.
                    </div>
                  )}
                  <div className="facility-list">
                    {h.facilities?.map((f) => (
                      <span key={f}>
                        <Check size={16} />
                        {f}
                      </span>
                    ))}
                  </div>
                </section>
                <section>
                  <Heading title="Current requirements" />
                  {h.requests.length ? (
                    <div className="grid two">
                      {h.requests.map((r) => (
                        <RequestCard
                          key={r._id}
                          request={{ ...r, hospitalId: h }}
                          onDetails={setSelected}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty title="No current requirements." />
                  )}
                </section>
                <section>
                  <h2>Find your way here.</h2>
                  <Suspense fallback={<Loading />}>
                    <HospitalMap hospitals={[h]} />
                  </Suspense>
                </section>
                {!!h.drives.length && (
                  <section>
                    <h2>Come together at a drive.</h2>
                    <div className="grid two">
                      {h.drives.map((d, i) => (
                        <DriveCard drive={d} index={i} key={d._id} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
              <aside className="booking-panel">
                <Heart size={29} />
                <h3>Your next act of kindness.</h3>
                <p>
                  Start with a visit request. The care team will take it from
                  there.
                </p>
                <div className="info-line">
                  <Clock size={18} />
                  <div>
                    <b>Donation hours</b>
                    <p>{h.donationHours}</p>
                  </div>
                </div>
                <div className="info-line">
                  <ShieldCheck size={18} />
                  <div>
                    <b>Screening at the site</b>
                    <p>Always determined by a healthcare professional.</p>
                  </div>
                </div>
                <Button
                  onClick={() => setBooking(true)}
                  disabled={!h.acceptingDonors}
                >
                  {h.acceptingDonors
                    ? "Request a donation visit"
                    : "Requests currently closed"}
                </Button>
                {h.demo ? (
                  <span className="tiny">DEMO CONTACT · {h.contactEmail}</span>
                ) : (
                  <a className="contact-link" href={`mailto:${h.contactEmail}`}>
                    {h.contactEmail}
                  </a>
                )}
              </aside>
            </div>
            {booking && (
              <AppointmentForm
                hospital={h}
                requestId={params.get("request") || undefined}
                onClose={() => setBooking(false)}
              />
            )}
          </>
        )}
      </QueryState>
      {selected && (
        <RequestDialog request={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
function Requests() {
  const [group, setGroup] = useState("");
  const [city, setCity] = useState("");
  const [urgency, setUrgency] = useState("");
  const [selected, setSelected] = useState(null);
  const query = useQuery({
    queryKey: ["requests", "all", group, city, urgency],
    queryFn: () =>
      get(
        `/blood-requests?${new URLSearchParams({ bloodGroup: group, city, urgency, limit: "50" })}`,
      ),
  });
  return (
    <>
      <PageIntro
        label="VERIFIED REQUIREMENTS. HUMAN CONNECTIONS."
        title={
          <>
            Someone needs
            <br />
            <em>you today.</em>
          </>
        }
        description="Find a current, reviewed requirement in your community. A little of you could mean a lot."
      />
      <section className="container listing-section">
        <div className="discovery-controls">
          <div className="select-filters">
            <label>
              Blood group
              <select
                aria-label="Blood group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">All groups</option>
                {bloodGroups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              City
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All cities</option>
                <option>Pune</option>
                <option>Mumbai</option>
              </select>
            </label>
            <label>
              Urgency
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="">All requirements</option>
                {["critical", "high", "routine"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          <span className="muted tiny">
            <ShieldCheck size={14} />
            Ranked by reviewed urgency, then recency
          </span>
        </div>
        <QueryState query={query}>
          {(data) =>
            data.length ? (
              <div className="grid three requests-light">
                {data.map((r) => (
                  <RequestCard
                    request={r}
                    onDetails={setSelected}
                    key={r._id}
                  />
                ))}
              </div>
            ) : (
              <Empty title="No active requirements match your search.">
                Try another group or city. You can also explore upcoming drives.
              </Empty>
            )
          }
        </QueryState>
        <div className="screening-note">
          <ShieldCheck size={18} />
          <p>
            These are reviewed donation requests, not live inventory. Demo
            requirements are labeled. Hospitals confirm appointments and
            determine eligibility.
          </p>
        </div>
      </section>
      {selected && (
        <RequestDialog request={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function Drives() {
  const [status, setStatus] = useState("upcoming");
  const [city, setCity] = useState("");
  const query = useQuery({
    queryKey: ["drives", status, city],
    queryFn: () =>
      get(`/drives?${new URLSearchParams({ status, city, limit: "50" })}`),
  });
  return (
    <>
      <PageIntro
        label="GOOD PEOPLE. GOOD DAYS. GOOD REASONS."
        title={
          <>
            Show up.
            <br />
            <em>Save lives.</em>
          </>
        }
        description="Find a donation drive, bring a friend, and turn an ordinary day into something meaningful."
      />
      <section className="container listing-section">
        <div className="discovery-controls">
          <div className="filter-chips neutral">
            {[
              ["upcoming", "Coming up"],
              ["live", "Live now"],
              ["completed", "Past drives"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setStatus(v)}
                className={v === status ? "active" : ""}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="inline-select">
            <MapPin size={16} />
            <select
              aria-label="Drive city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">All cities</option>
              <option>Pune</option>
              <option>Mumbai</option>
            </select>
          </label>
        </div>
        <QueryState query={query}>
          {(data) =>
            data.length ? (
              <div className="grid three">
                {data.map((d, i) => (
                  <DriveCard drive={d} index={i} key={d._id} />
                ))}
              </div>
            ) : (
              <Empty title="The next good gathering is on its way.">
                Check another category, or become a volunteer and help make one
                happen.
              </Empty>
            )
          }
        </QueryState>
      </section>
    </>
  );
}
function DriveDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["drive", id],
    queryFn: () => get(`/drives/${id}`),
  });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get("/dashboard"),
    enabled: !!user,
  });
  const registered = dashboard.data?.registrations?.some(
    (r) => r.driveId?._id === id,
  );
  const submit = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/drives/${id}`)}`);
      return;
    }
    setBusy(true);
    try {
      await (registered
        ? api.delete(`/drives/${id}/register`)
        : api.post(`/drives/${id}/register`));
      toast(
        registered
          ? "Your registration is cancelled."
          : "You’re on the list! Find this drive in your dashboard.",
      );
      qc.invalidateQueries();
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="container detail-page">
      <Link className="back-link" to="/drives">
        <ArrowLeft size={16} />
        All drives
      </Link>
      <QueryState query={query}>
        {(d) => (
          <>
            <div className={`drive-detail-banner ${d.theme}`}>
              <Eyebrow>COME TOGETHER. GIVE TOGETHER.</Eyebrow>
              <h1>
                {d.title}
                <span>↗</span>
              </h1>
              <div className="flex-badges">
                <Badge kind="poster">{d.status}</Badge>
                {d.demo && (
                  <Badge kind="poster">Fictitious demonstration event</Badge>
                )}
              </div>
              <Heart className="banner-heart" size={170} />
            </div>
            <div className="detail-layout">
              <div>
                <h2>A good day starts with showing up.</h2>
                <p className="large-body">{d.description}</p>
                {d.announcement && (
                  <div className="notice">
                    <b>Organizer update</b>
                    <p>{d.announcement}</p>
                  </div>
                )}
                {d.demo && (
                  <div className="notice">
                    This is an illustrative event. Registering creates a local
                    demonstration record. Do not attend in person.
                  </div>
                )}
                <section>
                  <h2>Come prepared. Feel welcome.</h2>
                  <ul className="guidelines">
                    <li>Bring a valid photo ID to a real donation event.</li>
                    <li>
                      The care team will complete a confidential screening and
                      answer your questions.
                    </li>
                    <li>
                      Participation is voluntary. There’s no pressure to donate.
                    </li>
                    <li>
                      A registration or check-in is not proof of donation.
                    </li>
                  </ul>
                </section>
                <section>
                  <h2>The place we’ll come together.</h2>
                  <p>
                    <MapPin size={18} />
                    {d.venue}
                  </p>
                  <Suspense fallback={<Loading />}>
                    <HospitalMap
                      hospitals={[{ ...d, name: d.title, address: d.venue }]}
                    />
                  </Suspense>
                </section>
              </div>
              <aside className="booking-panel">
                <CalendarDays size={28} />
                <h3>Make room for a little good.</h3>
                <div className="info-line">
                  <CalendarDays size={18} />
                  <div>
                    <b>{date(d.startDate)}</b>
                    <p>
                      {new Date(d.startDate).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      –
                      {new Date(d.endDate).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="info-line">
                  <MapPin size={18} />
                  <div>
                    <b>{d.venue}</b>
                    <p>{d.city}</p>
                  </div>
                </div>
                <div className="capacity-bar">
                  <span
                    style={{
                      width: `${Math.min(100, (d.registeredCount / d.capacity) * 100)}%`,
                    }}
                  />
                </div>
                <p className="tiny">
                  {d.capacity - d.registeredCount} of {d.capacity} places
                  available
                </p>
                <Button
                  onClick={submit}
                  disabled={
                    busy ||
                    (!registered &&
                      (Date.parse(d.registrationDeadline) < Date.now() ||
                        d.registeredCount >= d.capacity ||
                        !["upcoming", "live"].includes(d.status)))
                  }
                >
                  {busy
                    ? "One moment…"
                    : registered
                      ? "Cancel registration"
                      : "Save my place"}
                </Button>
                <p className="tiny muted">
                  Registration closes {date(d.registrationDeadline)}.<br />
                  Partner: {d.hospitalId?.name}
                </p>
              </aside>
            </div>
          </>
        )}
      </QueryState>
    </section>
  );
}
function ApplicationForm({ type }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useForm();
  if (sent)
    return (
      <Empty title="You’re part of the first step.">
        Your application has been saved for the coordination team to review.
        Thank you for showing interest.
      </Empty>
    );
  return (
    <form
      className="application-form"
      onSubmit={form.handleSubmit(async (values) => {
        setBusy(true);
        setError("");
        try {
          await api.post("/applications", {
            type,
            ...values,
            participants: Number(values.participants || 0),
            interests: values.interests ? [values.interests] : [],
            consent: !!values.consent,
          });
          setSent(true);
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      })}
    >
      <h2>
        {type === "campus"
          ? "Let’s bring your campus together."
          : "Find your way to help."}
      </h2>
      <div className="grid two">
        <Field label="Your name">
          <input required maxLength={100} {...form.register("name")} />
        </Field>
        <Field label="Email address">
          <input required type="email" {...form.register("email")} />
        </Field>
        <Field label="Phone number">
          <input
            required
            minLength={8}
            maxLength={20}
            {...form.register("phone")}
          />
        </Field>
        <Field label="City">
          <input required minLength={2} {...form.register("city")} />
        </Field>
        {type === "campus" ? (
          <>
            <Field label="Institution name">
              <input required {...form.register("institution")} />
            </Field>
            <Field label="Estimated participants">
              <input
                required
                type="number"
                min={0}
                max={10000}
                {...form.register("participants")}
              />
            </Field>
            <Field label="Preferred dates">
              <input
                type="text"
                placeholder="e.g. First week of December"
                {...form.register("preferredDates")}
              />
            </Field>
          </>
        ) : (
          <Field label="I’d love to help with">
            <select {...form.register("interests")}>
              <option>Event coordination</option>
              <option>Campus awareness</option>
              <option>Community outreach</option>
              <option>Design and storytelling</option>
            </select>
          </Field>
        )}
      </div>
      <Field label="Tell us a little about your idea">
        <textarea
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          {...form.register("message")}
        />
      </Field>
      <label className="check-field">
        <input required type="checkbox" {...form.register("consent")} />
        <span>
          I consent to processing this application and being contacted about it.
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Count me in"}
      </Button>
    </form>
  );
}
function Community({ type }) {
  const campus = type === "campus";
  return (
    <>
      <section className="community-hero">
        <div className="container">
          <Eyebrow>THERE’S MORE THAN ONE WAY TO GIVE</Eyebrow>
          <h1>
            {campus ? (
              <>
                YOUR CAMPUS.
                <br />
                <em>YOUR IMPACT.</em>
              </>
            ) : (
              <>
                BIG HEART.
                <br />
                <em>REAL PURPOSE.</em>
              </>
            )}
          </h1>
          <p>
            {campus
              ? "The best kind of campus culture is one that cares. Bring your community together for something that matters."
              : "Give your time. Share your skills. Help make a space where kindness feels at home."}
          </p>
          <Button
            to="#join"
            light
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("join")
                .scrollIntoView({ behavior: "smooth" });
            }}
          >
            Find your part
          </Button>
          <span className="community-star">✳</span>
        </div>
      </section>
      <section className="container section-space">
        <div className="grid three community-options">
          {(campus
            ? [
                [
                  Users,
                  "Start a campus chapter.",
                  "Build a small team to help your community find reliable information and opportunities.",
                ],
                [
                  CalendarDays,
                  "Host a thoughtful drive.",
                  "Coordinate with a verified hospital, welcome participants and support the care team.",
                ],
                [
                  Heart,
                  "Make awareness a movement.",
                  "Start conversations, share helpful information, and make room for everyone.",
                ],
              ]
            : [
                [
                  Users,
                  "Welcome people in.",
                  "Help participants navigate registration and feel comfortable at community events.",
                ],
                [
                  Sparkles,
                  "Bring your skills.",
                  "Photography, design, writing or logistics: your strengths can help the community.",
                ],
                [
                  Heart,
                  "Be a steady presence.",
                  "Support outreach and awareness. Donating blood is never a requirement to belong.",
                ],
              ]
          ).map(([Icon, title, body]) => (
            <div key={title}>
              <Icon size={30} />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <div className="notice">
          Below the minimum donation age? You can still explore permitted
          awareness and volunteering activities. No one should feel pressured to
          donate.
        </div>
        <div id="join" className="form-section">
          <div>
            <Eyebrow>GOOD THINGS START WITH A HELLO</Eyebrow>
            <h2>
              It starts
              <br />
              <em>with us.</em>
            </h2>
            <p>
              Tell us what you have in mind. We’ll save your interest for the
              coordination team.
            </p>
          </div>
          <ApplicationForm type={type} />
        </div>
      </section>
    </>
  );
}
function Stories() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: id ? ["story", id] : ["stories"],
    queryFn: () => get(id ? `/stories/${id}` : "/stories"),
  });
  return (
    <>
      <PageIntro
        label="THE HUMAN SIDE OF GIVING"
        title={
          <>
            Every drop.
            <br />
            <em>A different story.</em>
          </>
        }
        description="The people, moments and small acts that bring a community to life."
      />
      <section className="container listing-section">
        <QueryState query={query}>
          {(data) =>
            id ? (
              <article className="article-body">
                <Badge kind="demo">
                  {data.demo ? "Illustrative story" : "Community story"}
                </Badge>
                <h2>{data.title}</h2>
                <p className="article-byline">
                  {data.author} · {date(data.createdAt)}
                </p>
                {data.body.split("\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <Link className="text-link" to="/stories">
                  <ArrowLeft size={16} />
                  Back to stories
                </Link>
              </article>
            ) : data.length ? (
              <div className="story-list">
                {data.map((s, i) => (
                  <Link
                    className="story-row"
                    to={`/stories/${s._id}`}
                    key={s._id}
                  >
                    <span className="story-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="story-category">
                        {s.category} {s.demo && <span>ILLUSTRATIVE STORY</span>}
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.excerpt}</p>
                    </div>
                    <span className="round-link">
                      <ArrowUpRight />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="The next chapter is being written." />
            )
          }
        </QueryState>
      </section>
    </>
  );
}
function About() {
  const query = useQuery({
    queryKey: ["content"],
    queryFn: () => get("/content"),
  });
  return (
    <>
      <PageIntro
        label="MORE THAN DONATIONS. A MOVEMENT."
        title={
          <>
            Humanity is
            <br />
            <em>a team effort.</em>
          </>
        }
        description="We’re here to make it easier for good intentions to become meaningful action."
      />
      <section className="about-image container">
        <img
          src="/assets/community.jpg"
          alt="Illustration celebrating young people and collective care"
          loading="lazy"
        />
        <span>WE ALL HAVE A PART TO PLAY ↗</span>
      </section>
      <section className="container section-space">
        <QueryState query={query}>
          {(data) => (
            <div className="about-content">
              {["about", "mission", "vision"].map((key, i) => {
                const item = data.find((c) => c.key === key);
                return (
                  <Reveal key={key}>
                    <div className="about-content-row">
                      <span>
                        0{i + 1} / {key.toUpperCase()}
                      </span>
                      <div>
                        <h2>{item?.title || "Our story is taking shape."}</h2>
                        <p>
                          {item?.body ||
                            "Verified organization information will be added here before launch."}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}
        </QueryState>
        <div className="notice">
          Organization registration details, leadership, achievements,
          partnerships and office information have not yet been provided. No
          official endorsement or registered NGO status is claimed by this
          demonstration.
        </div>
        <Button to="/volunteer">Be part of the next chapter</Button>
      </section>
    </>
  );
}
function Contact() {
  const content = useQuery({
    queryKey: ["content"],
    queryFn: () => get("/content"),
  });
  const contact = content.data?.find((c) => c.key === "contact");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: { website: "" },
  });
  return (
    <>
      <PageIntro
        label="GOOD THINGS START WITH A HELLO"
        title={
          <>
            Let’s make
            <br />
            <em>something matter.</em>
          </>
        }
        description="A question, a campus idea, a hospital partnership — we’d love to hear it."
      />
      <section className="container form-section listing-section">
        <div>
          <h2>We’re listening.</h2>
          <p>
            Use this form for partnerships, volunteering, onboarding support or
            general questions.
          </p>
          <p className="muted">
            {contact?.body ||
              "Official phone, email, office and social profiles have not been supplied. Your submission is saved for the local coordination team."}
          </p>
          <div className="notice">
            This form is not an emergency or clinical service. For urgent
            medical needs, contact a qualified local healthcare provider.
          </div>
          <Link className="text-link" to="/faq">
            Explore common questions
            <ArrowUpRight size={18} />
          </Link>
        </div>
        {sent ? (
          <Empty title="Message received, with care.">
            Your message has been saved. Thank you for reaching out.
          </Empty>
        ) : (
          <form
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await api.post("/contact", values);
                setSent(true);
              } catch (e) {
                setError(message(e));
              }
            })}
          >
            {[
              ["name", "Your name"],
              ["email", "Email address"],
              ["subject", "What’s on your mind?"],
            ].map(([key, label]) => (
              <Field label={label} error={form.formState.errors[key]} key={key}>
                <input
                  type={key === "email" ? "email" : "text"}
                  {...form.register(key)}
                />
              </Field>
            ))}
            <Field label="Your message" error={form.formState.errors.message}>
              <textarea rows={6} {...form.register("message")} />
            </Field>
            <div className="honeypot" aria-hidden="true">
              <input
                tabIndex={-1}
                autoComplete="off"
                {...form.register("website")}
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending…" : "Send a little hello"}
            </Button>
            <p className="tiny muted">
              By submitting, you request a reply about this inquiry.{" "}
              <Link to="/privacy">How we handle your information</Link>.
            </p>
          </form>
        )}
      </section>
    </>
  );
}
const faqs = [
  [
    "Can I find out whether I’m eligible online?",
    "A healthcare professional determines medical eligibility after confidential screening at the donation site. Registration on Lifeline is an expression of interest and is never medical clearance.",
  ],
  [
    "How old do I need to be to book?",
    "Donation bookings require the configured legal minimum age (18 in this demonstration). Younger people can explore permitted awareness and volunteering opportunities. Other eligibility criteria are assessed by the healthcare team.",
  ],
  [
    "Is my appointment automatically confirmed?",
    "No. You request a preferred date, then the hospital checks availability and confirms an actual date and time. Follow the status in your dashboard.",
  ],
  [
    "What does a verified requirement mean?",
    "A hospital has submitted a requirement and the platform coordination team has reviewed it. Requirements have expiry times and are not a live inventory feed. All seeded demonstration requirements are fictitious.",
  ],
  [
    "Can I cancel my registration?",
    "Yes. Open your donor dashboard to cancel an active appointment request or a drive registration. A completed donation record can only be confirmed by an authorized hospital.",
  ],
  [
    "Does sponsorship affect urgency?",
    "No. Sponsored hospital placements are labeled and shown separately. Clinical urgency is based on reviewed requirements and cannot be purchased.",
  ],
  [
    "Will you share my personal details publicly?",
    "No. Public listings do not show donor profiles. Authorized hospital teams see the information needed to coordinate their own bookings. Optional invitations and promotions require separate consent.",
  ],
  [
    "How do I manage my data?",
    "Use your donor dashboard to change consent and notification preferences, export your information, or submit an account deletion request.",
  ],
  [
    "Are these hospitals and events real?",
    "The local seed dataset is entirely fictitious and clearly labeled. It demonstrates the full workflow. Replace demo data with reviewed, consented real records before deployment.",
  ],
];
function FAQ() {
  const [open, setOpen] = useState(0);
  const content = useQuery({
    queryKey: ["content"],
    queryFn: () => get("/content"),
  });
  const custom = content.data?.find((c) => c.key === "faq");
  return (
    <>
      <PageIntro
        label="A LITTLE CLARITY GOES A LONG WAY"
        title={
          <>
            Good questions.
            <br />
            <em>Thoughtful answers.</em>
          </>
        }
      />
      <section className="container faq-list listing-section">
        {custom && (
          <div className="cms-copy">
            <h2>{custom.title}</h2>
            <p>{custom.body}</p>
          </div>
        )}
        {faqs.map(([q, a], i) => (
          <div className="faq-item" key={q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              aria-controls={`answer-${i}`}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3>{q}</h3>
              {open === i ? <Minus /> : <Plus />}
            </button>
            {open === i && <p id={`answer-${i}`}>{a}</p>}
          </div>
        ))}
        <Button to="/contact" secondary>
          Still curious? Get in touch
        </Button>
      </section>
    </>
  );
}
function Policy({ type }) {
  const privacy = type === "privacy";
  const accessibility = type === "accessibility";
  const content = useQuery({
    queryKey: ["content"],
    queryFn: () => get("/content"),
  });
  const custom = content.data?.find((c) => c.key === type);
  return (
    <>
      <PageIntro
        label="TRUST IS PART OF THE STORY"
        title={
          accessibility ? (
            <>
              A place
              <br />
              <em>for everyone.</em>
            </>
          ) : privacy ? (
            <>
              Your information.
              <br />
              <em>Your choices.</em>
            </>
          ) : (
            <>
              A shared space.
              <br />
              <em>Shared understanding.</em>
            </>
          )
        }
      />
      <article className="container article-body listing-section">
        <div className="notice">
          {accessibility
            ? "Accessibility statement for the current implementation."
            : "Draft policy for this demonstration. The operating NGO must supply its legal identity, grievance contact and approved policy before collecting real personal data."}
        </div>
        {(custom
          ? [[custom.title, custom.body]]
          : accessibility
            ? [
                [
                  "Built to be usable",
                  "The interface supports keyboard navigation, visible focus states, semantic headings, labeled forms, reduced motion preferences and responsive layouts. Contact the coordination team with accessibility feedback.",
                ],
                [
                  "Map alternatives",
                  "Hospital information is available in a searchable list so you can discover opportunities without using the map.",
                ],
              ]
            : privacy
              ? [
                  [
                    "What we collect",
                    "Account and contact information, city, date of birth, optional blood group and college, consent choices, booking activity and hospital-confirmed donation records. We do not publish donor profiles or collect detailed medical histories.",
                  ],
                  [
                    "How it is used",
                    "To manage accounts, coordinate selected bookings, review hospital partnerships, and respond to inquiries. Future invitations and promotional communications are separately optional.",
                  ],
                  [
                    "Access and control",
                    "Authorized teams only access the records needed for their work. Hospital verification documents are private. You can update consent, export your records, and request account deletion in your dashboard.",
                  ],
                  [
                    "Retention and deletion",
                    "Operational retention periods must be approved by the operating NGO before launch. Email delivery records are automatically removed after seven days. Deletion requests are reviewed for applicable retention obligations; the demonstration does not promise automatic deletion.",
                  ],
                  [
                    "External services",
                    "OpenStreetMap receives map tile requests when you open a map. Precise location is used for a current nearby search and is not saved to your donor profile. Configured email and storage providers may process required delivery or verification information.",
                  ],
                ]
              : [
                  [
                    "Using the platform",
                    "Use accurate information and treat other people with care. The platform coordinates voluntary donation interest and community activities. It does not provide medical advice, guarantee appointments or represent live blood-bank inventory.",
                  ],
                  [
                    "Donation and participation",
                    "Medical eligibility is determined by qualified professionals at the donation site. An appointment request, registration or check-in does not prove donation. Follow the care team’s instructions.",
                  ],
                  [
                    "Community and sponsorship",
                    "Urgency requires verification. Sponsorship is explicitly labeled, managed separately and cannot buy medical urgency. Do not submit patient information, misleading requests or confidential medical records.",
                  ],
                  [
                    "Demonstration content",
                    "Fictitious seed accounts, hospitals, requirements, events and stories are for local evaluation only. They are not invitations to visit real sites or evidence of actual partnerships.",
                  ],
                ]
        ).map(([h, p]) => (
          <section key={h}>
            <h2>{h}</h2>
            <p>{p}</p>
          </section>
        ))}
      </article>
    </>
  );
}
function NotFound() {
  return (
    <section className="container not-found">
      <Eyebrow>A LITTLE DETOUR</Eyebrow>
      <span>
        404<span>✳</span>
      </span>
      <h1>
        Good things are
        <br />
        <em>somewhere else.</em>
      </h1>
      <p>We couldn’t find this page. Let’s get you back to the movement.</p>
      <Button to="/">Head back home</Button>
    </section>
  );
}
export default function Public({ notFound }) {
  const path = useLocation().pathname;
  const { id } = useParams();
  if (notFound || path === "/404") return <NotFound />;
  if (path.startsWith("/hospitals"))
    return id ? <HospitalDetail /> : <Hospitals />;
  if (path === "/urgent-requests") return <Requests />;
  if (path.startsWith("/drives")) return id ? <DriveDetail /> : <Drives />;
  if (path === "/campus" || path === "/volunteer")
    return <Community type={path.slice(1)} />;
  if (path.startsWith("/stories")) return <Stories />;
  if (path === "/about") return <About />;
  if (path === "/contact") return <Contact />;
  if (path === "/faq") return <FAQ />;
  return <Policy type={path.slice(1)} />;
}
