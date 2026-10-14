import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Heart,
  LayoutDashboard,
  CalendarDays,
  Building2,
  Droplet,
  Users,
  Bell,
  Settings,
  ArrowUpRight,
  Check,
  Download,
  ShieldCheck,
  Plus,
  FileText,
  TrendingUp,
  Search,
  Mail,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { api, get, message } from "../services/api";
import { useAuth, useToast } from "../services/context";
import { bloodGroups } from "../../../shared/validation";
import {
  Button,
  Eyebrow,
  Badge,
  QueryState,
  Empty,
  Modal,
  Field,
  HospitalCard,
  date,
} from "../components/UI";
const label = (s) => (s || "").replaceAll("_", " ");
function Stat({ title, value, icon: Icon }) {
  return (
    <div className="dashboard-stat">
      <div>
        <span>{title}</span>
        <Icon size={18} />
      </div>
      <b>{value ?? "—"}</b>
      <span>From platform records</span>
    </div>
  );
}
function Status({ value }) {
  return (
    <Badge
      kind={
        ["confirmed", "active", "verified", "approved", "completed"].includes(
          value,
        )
          ? "verified"
          : ["pending", "requested", "unpaid"].includes(value)
            ? "pending"
            : "demo"
      }
    >
      {label(value)}
    </Badge>
  );
}
function ActionForm({ title, fields, initial = {}, onSubmit, onClose }) {
  const form = useForm({ defaultValues: initial });
  const [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            await onSubmit(values);
            onClose();
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            hint={f.hint}
            error={form.formState.errors[f.key]}
          >
            {f.type === "select" ? (
              <select
                {...form.register(f.key, { required: f.required !== false })}
              >
                {f.options.map((v) => (
                  <option
                    key={typeof v === "string" ? v : v.value}
                    value={typeof v === "string" ? v : v.value}
                  >
                    {typeof v === "string" ? label(v) : v.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                rows={3}
                {...form.register(f.key, { required: f.required !== false })}
              />
            ) : f.type === "checkbox" ? (
              <input type="checkbox" {...form.register(f.key)} />
            ) : (
              <input
                type={f.type || "text"}
                step={f.step}
                min={f.min}
                {...form.register(f.key, { required: f.required !== false })}
              />
            )}
          </Field>
        ))}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}
function DataTable({ columns, rows, empty = "Nothing to review right now." }) {
  return rows?.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || i}>
              {columns.map((c) => (
                <td key={c.title}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title={empty} />
  );
}
export default function Dashboard({ mode }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const location = useLocation();
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [developmentLink, setDevelopmentLink] = useState(
    location.state?.developmentLink || "",
  );
  const admin = mode === "admin";
  const hospital = mode === "hospital";
  const organizer = user.role === "volunteer";
  const base = admin
    ? "/admin/dashboard"
    : hospital
      ? "/hospital/dashboard"
      : "/dashboard";
  const query = useQuery({
    queryKey: [`${mode}-dashboard`],
    queryFn: () => get(base),
  });
  const lists = useQuery({
    queryKey: ["admin-list", tab],
    queryFn: () =>
      get(
        `/admin/${tab === "people" ? "users" : tab === "requests" ? "blood-requests" : tab}`,
      ),
    enabled: admin && !["overview", "settings", "content"].includes(tab),
  });
  const hospitals = useQuery({
    queryKey: ["hospitals", "dashboard"],
    queryFn: () => get("/hospitals?limit=50"),
    enabled: organizer,
  });
  const nav = admin
    ? [
        ["overview", "Overview", LayoutDashboard],
        ["hospitals", "Hospitals", Building2],
        ["requests", "Requirements", Droplet],
        ["drives", "Donation drives", CalendarDays],
        ["sponsorships", "Sponsorships", TrendingUp],
        ["people", "People", Users],
        ["applications", "Inbox & applications", Mail],
        ["content", "Content studio", FileText],
        ["audit", "Activity log", ShieldCheck],
      ]
    : hospital
      ? [
          ["overview", "Overview", LayoutDashboard],
          ...(!organizer
            ? [
                ["appointments", "Appointments", Heart],
                ["requests", "Requirements", Droplet],
              ]
            : []),
          ["drives", "Donation drives", CalendarDays],
          ...(!organizer
            ? [
                ["sponsorships", "Sponsorships", TrendingUp],
                ["profile", "Hospital profile", Building2],
              ]
            : []),
          ["settings", "My settings", Settings],
        ]
      : [
          ["overview", "My overview", LayoutDashboard],
          ["appointments", "My appointments", Heart],
          ["drives", "My drives", CalendarDays],
          ["history", "Donation history", Droplet],
          ["notifications", "Notifications", Bell],
          ["settings", "My settings", Settings],
        ];
  const mutate = async (method, url, data) => {
    const result = await api[method](url, data);
    qc.invalidateQueries();
    refresh();
    toast(result.data.data?.message || "Changes saved.");
    return result;
  };
  const review = (resource, row, approved) => {
    if (resource === "hospitals")
      setModal({
        title: approved
          ? "Review hospital verification"
          : "Review hospital status",
        fields: [
          {
            key: "status",
            label: "Review outcome",
            type: "select",
            options: approved ? ["verified"] : ["rejected", "suspended"],
          },
          {
            key: "note",
            label: "Review note",
            type: "textarea",
            hint: "Record the supporting checks you performed.",
          },
        ],
        onSubmit: (v) =>
          mutate("patch", `/admin/hospitals/${row._id}/verify`, v),
      });
    if (resource === "requests")
      setModal({
        title: approved ? "Verify medical requirement" : "Reject requirement",
        fields: [
          {
            key: "note",
            label: "Medical verification review note",
            type: "textarea",
            hint: "Verify the requirement independently. Do not include patient information.",
          },
        ],
        onSubmit: (v) =>
          mutate("patch", `/admin/blood-requests/${row._id}/verify`, {
            ...v,
            approved,
          }),
      });
    if (resource === "drives")
      setModal({
        title: approved ? "Approve donation drive" : "Reject donation drive",
        fields: [
          {
            key: "acknowledged",
            label: "I reviewed the hospital partner, venue and event details.",
            type: "checkbox",
          },
        ],
        onSubmit: (v) => {
          if (!v.acknowledged)
            throw new Error("Confirm you reviewed the event details.");
          return mutate("patch", `/admin/drives/${row._id}/verify`, {
            approved,
          });
        },
      });
  };
  const createRequest = (h) =>
    setModal({
      title: "Submit a blood requirement",
      initial: { bloodGroup: "O+", urgency: "routine" },
      fields: [
        {
          key: "bloodGroup",
          label: "Blood group",
          type: "select",
          options: bloodGroups,
        },
        {
          key: "unitsRequired",
          label: "Verified units required",
          type: "number",
          min: 1,
        },
        {
          key: "urgency",
          label: "Medical urgency",
          type: "select",
          options: ["routine", "high", "critical"],
        },
        {
          key: "description",
          label: "Requirement description",
          type: "textarea",
          hint: "No patient identifying information.",
        },
        {
          key: "instructions",
          label: "Donation instructions",
          type: "textarea",
        },
        { key: "expiresAt", label: "Expires at", type: "datetime-local" },
      ],
      onSubmit: (v) =>
        mutate("post", "/blood-requests", {
          ...v,
          hospitalId: h._id,
          expiresAt: new Date(v.expiresAt).toISOString(),
          unitsRequired: Number(v.unitsRequired),
        }),
    });
  const createDrive = (h) =>
    setModal({
      title: "Create a community drive",
      initial: { theme: "coral", hospitalId: h?._id },
      fields: [
        ...(organizer
          ? [
              {
                key: "hospitalId",
                label: "Verified hospital partner",
                type: "select",
                options: (hospitals.data || []).map((h) => ({
                  value: h._id,
                  label: h.name,
                })),
              },
            ]
          : []),
        { key: "title", label: "Drive title" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "venue", label: "Venue & address" },
        { key: "city", label: "City" },
        { key: "startDate", label: "Starts at", type: "datetime-local" },
        { key: "endDate", label: "Ends at", type: "datetime-local" },
        {
          key: "registrationDeadline",
          label: "Registration deadline",
          type: "datetime-local",
        },
        {
          key: "capacity",
          label: "Registration capacity",
          type: "number",
          min: 1,
        },
        {
          key: "theme",
          label: "Poster theme",
          type: "select",
          options: ["coral", "crimson", "olive"],
        },
      ],
      onSubmit: (v) =>
        mutate("post", "/drives", {
          ...v,
          hospitalId: v.hospitalId || h._id,
          capacity: Number(v.capacity),
          startDate: new Date(v.startDate).toISOString(),
          endDate: new Date(v.endDate).toISOString(),
          registrationDeadline: new Date(v.registrationDeadline).toISOString(),
        }),
    });
  const confirm = (a) =>
    setModal({
      title: "Confirm actual availability",
      fields: [
        {
          key: "scheduledDate",
          label: "Confirmed appointment date",
          type: "date",
        },
        {
          key: "scheduledTime",
          label: "Confirmed appointment time",
          type: "time",
        },
      ],
      onSubmit: (v) =>
        mutate("patch", `/appointments/${a._id}`, {
          ...v,
          status: "confirmed",
        }),
    });
  const cancel = (a) =>
    setModal({
      title: "Cancel this appointment?",
      fields: [
        {
          key: "acknowledged",
          label: "Yes, cancel this appointment request.",
          type: "checkbox",
        },
      ],
      onSubmit: (v) => {
        if (!v.acknowledged) throw new Error("Confirm the cancellation.");
        return mutate("patch", `/appointments/${a._id}`, {
          status: "cancelled",
        });
      },
    });
  const appointmentsTable = (rows, manager = false) => (
    <DataTable
      rows={rows}
      columns={[
        {
          title: manager ? "Donor" : "Hospital",
          render: (a) => (
            <>
              <b>{manager ? a.donorId?.name : a.hospitalId?.name}</b>
              <span className="table-sub">
                {manager ? a.donorId?.email : a.hospitalId?.city}
              </span>
            </>
          ),
        },
        {
          title: "Visit",
          render: (a) => (
            <>
              {date(a.scheduledDate || a.preferredDate)}
              <span className="table-sub">
                {a.scheduledTime || "Preferred date · awaiting time"}
              </span>
            </>
          ),
        },
        { title: "Status", render: (a) => <Status value={a.status} /> },
        {
          title: "Actions",
          render: (a) => (
            <div className="table-actions">
              {manager && a.status === "requested" && (
                <button onClick={() => confirm(a)}>Confirm</button>
              )}
              {manager && a.status === "confirmed" && (
                <button
                  onClick={() =>
                    setModal({
                      title: "Confirm donation completion",
                      fields: [
                        {
                          key: "acknowledged",
                          label:
                            "The donation actually occurred and has been confirmed by the care team.",
                          type: "checkbox",
                        },
                      ],
                      onSubmit: (v) => {
                        if (!v.acknowledged)
                          throw new Error("Actual donation must be confirmed.");
                        return mutate("patch", `/appointments/${a._id}`, {
                          status: "completed",
                        });
                      },
                    })
                  }
                >
                  Record donation
                </button>
              )}
              {["requested", "confirmed"].includes(a.status) && (
                <button
                  onClick={() =>
                    manager
                      ? mutate("patch", `/appointments/${a._id}`, {
                          status: "rejected",
                        }).catch((e) => toast(message(e)))
                      : cancel(a)
                  }
                >
                  {manager ? "Reject" : "Cancel"}
                </button>
              )}
            </div>
          ),
        },
      ]}
    />
  );
  function adminTable() {
    const rows = lists.data || [];
    if (tab === "hospitals")
      return (
        <DataTable
          rows={rows}
          columns={[
            {
              title: "Hospital",
              render: (h) => (
                <>
                  <b>{h.name}</b>
                  <span className="table-sub">
                    {h.city} · {h.demo ? "Demo record" : h.registrationNumber}
                  </span>
                </>
              ),
            },
            {
              title: "Private documents",
              render: (h) =>
                h.verificationDocuments?.length ? (
                  h.verificationDocuments.map((d) => (
                    <a
                      className="document-link"
                      href={`/api/hospitals/${h._id}/documents/${d._id}`}
                      key={d._id}
                    >
                      Review {d.name} ↗
                    </a>
                  ))
                ) : (
                  <span className="muted">Awaiting documents</span>
                ),
            },
            {
              title: "Status",
              render: (h) => <Status value={h.verificationStatus} />,
            },
            {
              title: "Review",
              render: (h) => (
                <div className="table-actions">
                  <button onClick={() => review("hospitals", h, true)}>
                    Verify
                  </button>
                  <button onClick={() => review("hospitals", h, false)}>
                    Reject / suspend
                  </button>
                </div>
              ),
            },
          ]}
        />
      );
    if (tab === "requests")
      return (
        <DataTable
          rows={rows}
          columns={[
            {
              title: "Hospital",
              render: (r) => (
                <>
                  <b>{r.hospitalId?.name}</b>
                  <span className="table-sub">{r.description}</span>
                </>
              ),
            },
            {
              title: "Requirement",
              render: (r) => (
                <>
                  {r.bloodGroup} · {r.unitsRequired} units
                  <Status value={r.urgency} />
                </>
              ),
            },
            { title: "Expires", render: (r) => date(r.expiresAt) },
            { title: "Status", render: (r) => <Status value={r.status} /> },
            {
              title: "Review",
              render: (r) => (
                <div className="table-actions">
                  <button onClick={() => review("requests", r, true)}>
                    Verify
                  </button>
                  <button onClick={() => review("requests", r, false)}>
                    Reject
                  </button>
                </div>
              ),
            },
          ]}
        />
      );
    if (tab === "drives")
      return (
        <DataTable
          rows={rows}
          columns={[
            {
              title: "Drive",
              render: (d) => (
                <>
                  <b>{d.title}</b>
                  <span className="table-sub">
                    {d.venue} · {date(d.startDate)}
                  </span>
                </>
              ),
            },
            {
              title: "Registrations",
              render: (d) => `${d.registeredCount} / ${d.capacity}`,
            },
            { title: "Status", render: (d) => <Status value={d.status} /> },
            {
              title: "Review",
              render: (d) => (
                <div className="table-actions">
                  <button onClick={() => review("drives", d, true)}>
                    Approve
                  </button>
                  <button onClick={() => review("drives", d, false)}>
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      mutate("patch", `/drives/${d._id}`, {
                        status: "cancelled",
                      }).catch((e) => toast(message(e)))
                    }
                  >
                    Cancel
                  </button>
                </div>
              ),
            },
          ]}
        />
      );
    if (tab === "sponsorships")
      return (
        <DataTable
          rows={rows}
          columns={[
            {
              title: "Campaign",
              render: (s) => (
                <>
                  <b>{s.title}</b>
                  <span className="table-sub">
                    {s.hospitalId?.name} · {label(s.campaignType)}
                  </span>
                  <Badge kind="sponsored">Sponsored</Badge>
                </>
              ),
            },
            {
              title: "Period",
              render: (s) => (
                <>
                  {date(s.startDate)} – {date(s.endDate)}
                </>
              ),
            },
            {
              title: "Status",
              render: (s) => (
                <>
                  <Status value={s.status} />
                  <span className="table-sub">
                    {s.paymentStatus} · ₹{s.price}
                  </span>
                </>
              ),
            },
            {
              title: "Manage",
              render: (s) => (
                <button
                  className="table-button"
                  onClick={() =>
                    setModal({
                      title: "Review sponsorship",
                      initial: {
                        status: s.status === "pending" ? "approved" : s.status,
                        paymentStatus: s.paymentStatus,
                        price: s.price,
                        startDate: new Date(s.startDate)
                          .toISOString()
                          .slice(0, 16),
                        endDate: new Date(s.endDate).toISOString().slice(0, 16),
                      },
                      fields: [
                        {
                          key: "status",
                          label: "Campaign status",
                          type: "select",
                          options: ["approved", "rejected", "completed"],
                        },
                        {
                          key: "paymentStatus",
                          label: "Manually reconciled payment",
                          type: "select",
                          options: ["unpaid", "paid"],
                        },
                        {
                          key: "price",
                          label: "Campaign price (INR)",
                          type: "number",
                          min: 0,
                        },
                        {
                          key: "startDate",
                          label: "Placement begins",
                          type: "datetime-local",
                        },
                        {
                          key: "endDate",
                          label: "Placement ends",
                          type: "datetime-local",
                        },
                      ],
                      onSubmit: (v) =>
                        mutate("patch", `/admin/sponsorships/${s._id}`, {
                          ...v,
                          price: Number(v.price),
                          startDate: new Date(v.startDate).toISOString(),
                          endDate: new Date(v.endDate).toISOString(),
                        }),
                    })
                  }
                >
                  Review campaign ↗
                </button>
              ),
            },
          ]}
        />
      );
    if (tab === "people")
      return (
        <DataTable
          rows={rows}
          columns={[
            {
              title: "Person",
              render: (u) => (
                <>
                  <b>{u.name}</b>
                  <span className="table-sub">{u.city}</span>
                </>
              ),
            },
            { title: "Role", render: (u) => label(u.role) },
            {
              title: "Account",
              render: (u) => (
                <Status
                  value={
                    u.disabled
                      ? "disabled"
                      : u.isVerified
                        ? "verified"
                        : "pending"
                  }
                />
              ),
            },
            { title: "Joined", render: (u) => date(u.createdAt) },
            {
              title: "Actions",
              render: (u) => (
                <button
                  disabled={u._id === user.id}
                  className="table-button"
                  onClick={() =>
                    mutate("patch", `/admin/users/${u._id}`, {
                      disabled: !u.disabled,
                    }).catch((e) => toast(message(e)))
                  }
                >
                  {u.disabled ? "Enable account" : "Suspend account"}
                </button>
              ),
            },
          ]}
        />
      );
    if (tab === "applications")
      return (
        <DataTable
          rows={rows}
          columns={[
            {
              title: "From",
              render: (a) => (
                <>
                  <b>{a.name}</b>
                  <span className="table-sub">
                    {a.email} · {a.city}
                  </span>
                </>
              ),
            },
            { title: "Type", render: (a) => label(a.type) },
            {
              title: "Message",
              render: (a) => (
                <>
                  <b>{a.subject || a.institution}</b>
                  <span className="table-sub">{a.message}</span>
                </>
              ),
            },
            { title: "Status", render: (a) => <Status value={a.status} /> },
            {
              title: "Review",
              render: (a) => (
                <button
                  className="table-button"
                  onClick={() =>
                    mutate("patch", `/admin/applications/${a._id}`, {
                      status: a.status === "new" ? "reviewed" : "closed",
                    }).catch((e) => toast(message(e)))
                  }
                >
                  {a.status === "new" ? "Mark reviewed" : "Close"}
                </button>
              ),
            },
          ]}
        />
      );
    return (
      <DataTable
        rows={rows}
        columns={[
          { title: "When", render: (a) => date(a.createdAt) },
          { title: "Actor", render: (a) => a.actorId?.name || "System" },
          { title: "Action", render: (a) => a.action },
          { title: "Resource", render: (a) => <code>{a.resourceId}</code> },
        ]}
      />
    );
  }
  return (
    <section className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="workspace-label">
          <span className="workspace-icon">
            {admin ? (
              <ShieldCheck size={20} />
            ) : hospital ? (
              <Building2 size={20} />
            ) : (
              <Heart size={20} />
            )}
          </span>
          <div>
            <b>
              {admin
                ? "Coordination studio"
                : hospital
                  ? organizer
                    ? "Organizer space"
                    : "Hospital workspace"
                  : "Your little corner"}
            </b>
            <span>
              {admin
                ? "NGO ADMINISTRATION"
                : hospital
                  ? "PARTNER PORTAL"
                  : "DONOR COMMUNITY"}
            </span>
          </div>
        </div>
        <nav aria-label="Dashboard navigation">
          {nav.map(([key, title, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={tab === key ? "active" : ""}
            >
              <Icon size={18} />
              {title}
              {tab === key && <span />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Heart size={27} />
          <h3>
            Small acts.
            <br />
            Shared humanity.
          </h3>
          <p>Thank you for being part of the story.</p>
          <Link to="/">
            Explore the movement
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </aside>
      <div className="dashboard-main">
        <div className="dashboard-top">
          <div>
            <Eyebrow>
              {admin
                ? "THE BIG PICTURE"
                : hospital
                  ? "CARE GOES FURTHER, TOGETHER"
                  : "IT’S GOOD TO SEE YOU"}
            </Eyebrow>
            <h1>
              {tab === "overview"
                ? admin
                  ? "A community in motion."
                  : `Hello, ${user.name.split(" ")[0]}.`
                : nav.find((n) => n[0] === tab)?.[1]}
            </h1>
            <p>
              {admin
                ? "Thoughtful coordination. Meaningful connections."
                : hospital
                  ? "Create a thoughtful experience for everyone who wants to help."
                  : "Every small step has the potential to mean something big."}
            </p>
          </div>
          <span className="profile-avatar">{user.name[0]}</span>
        </div>
        {!user.isVerified && (
          <div className="verification-banner">
            <Mail size={20} />
            <div>
              <b>One small check before your next step.</b>
              <p>
                Verify your email to book appointments and register for drives.
              </p>
              {developmentLink && (
                <a href={developmentLink}>Open local verification email ↗</a>
              )}
            </div>
            <button
              className="table-button"
              onClick={async () => {
                try {
                  const r = await api.post("/auth/resend-verification");
                  setDevelopmentLink(r.data.meta?.developmentLink || "");
                  toast(r.data.data.message);
                } catch (e) {
                  toast(message(e));
                }
              }}
            >
              Resend email
            </button>
          </div>
        )}
        <QueryState query={query}>
          {(data) => (
            <>
              {tab === "overview" && (
                <>
                  <div className="dashboard-stats">
                    {(admin
                      ? [
                          ["Registered donors", data.donors, Users],
                          ["Verified hospitals", data.hospitals, Building2],
                          ["Active requirements", data.requests, Droplet],
                          ["Confirmed donations", data.donations, Heart],
                        ]
                      : hospital
                        ? [
                            [
                              "Visit requests",
                              data.appointments.filter(
                                (a) => a.status === "requested",
                              ).length,
                              Heart,
                            ],
                            [
                              "Active requirements",
                              data.requests.filter((r) => r.status === "active")
                                .length,
                              Droplet,
                            ],
                            [
                              "Community drives",
                              data.drives.length,
                              CalendarDays,
                            ],
                            [
                              "Confirmed visits",
                              data.appointments.filter(
                                (a) => a.status === "confirmed",
                              ).length,
                              Check,
                            ],
                          ]
                        : [
                            [
                              "Confirmed donations",
                              data.donations.length,
                              Heart,
                            ],
                            [
                              "Upcoming visits",
                              data.appointments.filter((a) =>
                                ["requested", "confirmed"].includes(a.status),
                              ).length,
                              CalendarDays,
                            ],
                            [
                              "Drive registrations",
                              data.registrations.length,
                              Users,
                            ],
                            [
                              "Unread updates",
                              data.notifications.filter((n) => !n.read).length,
                              Bell,
                            ],
                          ]
                    ).map(([title, value, Icon]) => (
                      <Stat
                        key={title}
                        title={title}
                        value={value}
                        icon={Icon}
                      />
                    ))}
                  </div>
                  {admin ? (
                    <div className="dashboard-grid">
                      <div className="dashboard-panel">
                        <h2>People joining the movement</h2>
                        <p className="muted">
                          Monthly donor registrations · database totals
                        </p>
                        {data.trend.length ? (
                          <div className="chart">
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={data.trend}>
                                <CartesianGrid
                                  vertical={false}
                                  stroke="#ece7e1"
                                />
                                <XAxis
                                  dataKey="_id"
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <Tooltip />
                                <Bar
                                  dataKey="donors"
                                  fill="#9b1c31"
                                  radius={[6, 6, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <Empty title="The first chapter starts with one person." />
                        )}
                      </div>
                      <div className="dashboard-panel review-queue">
                        <Eyebrow>READY FOR A THOUGHTFUL LOOK</Eyebrow>
                        <h2>Your review queue.</h2>
                        {[
                          [
                            "hospitals",
                            "Hospital verifications",
                            data.pendingHospitals,
                          ],
                          [
                            "sponsorships",
                            "Sponsorship requests",
                            data.sponsorships,
                          ],
                          ["applications", "Community inbox", "→"],
                        ].map(([key, label, count]) => (
                          <button key={key} onClick={() => setTab(key)}>
                            <span>{label}</span>
                            <b>{count}</b>
                            <ArrowUpRight size={17} />
                          </button>
                        ))}
                        <p className="tiny muted">
                          Demographic groups smaller than five are suppressed in
                          aggregated breakdowns.
                        </p>
                      </div>
                    </div>
                  ) : hospital ? (
                    <>
                      <div className="dashboard-panel">
                        <div className="panel-heading">
                          <h2>
                            {organizer
                              ? "Your community drives"
                              : "Latest appointment requests"}
                          </h2>
                          <button
                            className="text-button"
                            onClick={() =>
                              setTab(organizer ? "drives" : "appointments")
                            }
                          >
                            See all
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                        {organizer ? (
                          <p>
                            {data.drives.length} drives organized. Create your
                            next gathering in the donation drives tab.
                          </p>
                        ) : (
                          appointmentsTable(data.appointments.slice(0, 5), true)
                        )}
                      </div>
                      {!data.hospital && !organizer && (
                        <div className="notice">
                          <p>Your hospital profile is waiting to be created.</p>
                          <Button to="/register/hospital">
                            Complete hospital onboarding
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="dashboard-welcome">
                        <div>
                          <Eyebrow>YOUR NEXT LITTLE ACT OF GOOD</Eyebrow>
                          <h2>
                            Find your place.
                            <br />
                            <em>Make it matter.</em>
                          </h2>
                          <p>
                            Explore verified hospitals and community drives near
                            you.
                          </p>
                          <Button to="/hospitals">Find a hospital</Button>
                        </div>
                        <Heart size={135} strokeWidth={0.8} />
                      </div>
                      <div className="dashboard-panel">
                        <div className="panel-heading">
                          <h2>Your upcoming visits</h2>
                          <button
                            className="text-button"
                            onClick={() => setTab("appointments")}
                          >
                            All appointments
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                        {appointmentsTable(
                          data.appointments
                            .filter((a) =>
                              ["requested", "confirmed"].includes(a.status),
                            )
                            .slice(0, 5),
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {tab === "appointments" && (
                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <h2>
                      {hospital
                        ? "Coordinate a visit. Make someone welcome."
                        : "Good things on your calendar."}
                    </h2>
                    {!hospital && (
                      <Button to="/hospitals">Find a hospital</Button>
                    )}
                  </div>
                  {appointmentsTable(data.appointments, hospital)}
                </div>
              )}
              {tab === "history" && (
                <div className="dashboard-panel">
                  <h2>Your moments of giving.</h2>
                  <p className="muted">
                    Only hospital-confirmed donations appear here.
                  </p>
                  <DataTable
                    rows={data.donations}
                    columns={[
                      { title: "Hospital", render: (d) => d.hospitalId?.name },
                      {
                        title: "Donation date",
                        render: (d) => date(d.donationDate),
                      },
                      {
                        title: "Confirmation",
                        render: (d) => (
                          <Badge kind="verified">Confirmed by hospital</Badge>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
              {tab === "drives" && !admin && (
                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <h2>
                      {hospital
                        ? "Bring good people together."
                        : "Your community gatherings."}
                    </h2>
                    {hospital ? (
                      <Button
                        onClick={() => createDrive(data.hospital)}
                        disabled={
                          !organizer &&
                          data.hospital?.verificationStatus !== "verified"
                        }
                      >
                        Create a drive
                      </Button>
                    ) : (
                      <Button to="/drives">Explore drives</Button>
                    )}
                  </div>
                  {hospital ? (
                    <DataTable
                      rows={data.drives}
                      columns={[
                        {
                          title: "Drive",
                          render: (d) => (
                            <>
                              <b>{d.title}</b>
                              <span className="table-sub">
                                {d.venue} · {date(d.startDate)}
                              </span>
                            </>
                          ),
                        },
                        {
                          title: "People",
                          render: (d) => `${d.registeredCount} / ${d.capacity}`,
                        },
                        {
                          title: "Status",
                          render: (d) => <Status value={d.status} />,
                        },
                        {
                          title: "Manage",
                          render: (d) => (
                            <div className="table-actions">
                              <button
                                onClick={() => setModal({ participants: d })}
                              >
                                Participants
                              </button>
                              <button
                                disabled={d.status === "pending"}
                                onClick={() =>
                                  setModal({
                                    title: "Update drive & notify participants",
                                    initial: {
                                      status: [
                                        "live",
                                        "completed",
                                        "cancelled",
                                      ].includes(d.status)
                                        ? d.status
                                        : "live",
                                      announcement: d.announcement || "",
                                    },
                                    fields: [
                                      {
                                        key: "status",
                                        label: "Drive status",
                                        type: "select",
                                        options: [
                                          "live",
                                          "completed",
                                          "cancelled",
                                        ],
                                      },
                                      {
                                        key: "announcement",
                                        label: "Announcement",
                                        type: "textarea",
                                        required: false,
                                      },
                                    ],
                                    onSubmit: (v) =>
                                      mutate("patch", `/drives/${d._id}`, v),
                                  })
                                }
                              >
                                Update
                              </button>
                            </div>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <DataTable
                      rows={data.registrations}
                      columns={[
                        {
                          title: "Gathering",
                          render: (r) => (
                            <Link to={`/drives/${r.driveId?._id}`}>
                              {r.driveId?.title}
                            </Link>
                          ),
                        },
                        {
                          title: "When",
                          render: (r) => date(r.driveId?.startDate),
                        },
                        {
                          title: "Status",
                          render: (r) => <Status value={r.driveId?.status} />,
                        },
                        {
                          title: "Actions",
                          render: (r) => (
                            <button
                              className="table-button"
                              onClick={() =>
                                mutate(
                                  "delete",
                                  `/drives/${r.driveId?._id}/register`,
                                ).catch((e) => toast(message(e)))
                              }
                            >
                              Cancel registration
                            </button>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              )}
              {tab === "requests" && !admin && (
                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>A clear request. A meaningful connection.</h2>
                      <p className="muted">
                        New requirements are reviewed by the NGO team before
                        public display.
                      </p>
                    </div>
                    <Button
                      onClick={() => createRequest(data.hospital)}
                      disabled={
                        data.hospital?.verificationStatus !== "verified"
                      }
                    >
                      New requirement
                    </Button>
                  </div>
                  <DataTable
                    rows={data.requests}
                    columns={[
                      {
                        title: "Blood group",
                        render: (r) => <b>{r.bloodGroup}</b>,
                      },
                      {
                        title: "Units / urgency",
                        render: (r) => `${r.unitsRequired} · ${r.urgency}`,
                      },
                      {
                        title: "Status",
                        render: (r) => <Status value={r.status} />,
                      },
                      { title: "Expires", render: (r) => date(r.expiresAt) },
                      {
                        title: "Actions",
                        render: (r) => (
                          <div className="table-actions">
                            <button
                              disabled={["fulfilled", "cancelled"].includes(
                                r.status,
                              )}
                              onClick={() =>
                                mutate("patch", `/blood-requests/${r._id}`, {
                                  status: "fulfilled",
                                }).catch((e) => toast(message(e)))
                              }
                            >
                              Mark fulfilled
                            </button>
                            <button
                              onClick={() =>
                                setModal({
                                  title: "Edit requirement · returns to review",
                                  initial: {
                                    unitsRequired: r.unitsRequired,
                                    urgency: r.urgency,
                                    description: r.description,
                                  },
                                  fields: [
                                    {
                                      key: "unitsRequired",
                                      label: "Verified units",
                                      type: "number",
                                      min: 1,
                                    },
                                    {
                                      key: "urgency",
                                      label: "Medical urgency",
                                      type: "select",
                                      options: ["routine", "high", "critical"],
                                    },
                                    {
                                      key: "description",
                                      label: "Description",
                                      type: "textarea",
                                    },
                                  ],
                                  onSubmit: (v) =>
                                    mutate(
                                      "patch",
                                      `/blood-requests/${r._id}`,
                                      {
                                        ...v,
                                        unitsRequired: Number(v.unitsRequired),
                                      },
                                    ),
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                mutate(
                                  "delete",
                                  `/blood-requests/${r._id}`,
                                ).catch((e) => toast(message(e)))
                              }
                            >
                              Close
                            </button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
              {tab === "sponsorships" && !admin && (
                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>A transparent community spotlight.</h2>
                      <p className="muted">
                        Admin-managed placement. Prices and dates are confirmed
                        during review.
                      </p>
                    </div>
                    <Button
                      disabled={
                        data.hospital?.verificationStatus !== "verified"
                      }
                      onClick={() =>
                        setModal({
                          title: "Request a sponsored campaign",
                          initial: { campaignType: "featured_hospital" },
                          fields: [
                            {
                              key: "campaignType",
                              label: "Placement type",
                              type: "select",
                              options: [
                                "featured_hospital",
                                "awareness_campaign",
                                "promoted_drive",
                              ],
                            },
                            { key: "title", label: "Campaign title" },
                            {
                              key: "description",
                              label: "Campaign details",
                              type: "textarea",
                            },
                            {
                              key: "startDate",
                              label: "Preferred start",
                              type: "datetime-local",
                            },
                            {
                              key: "endDate",
                              label: "Preferred end",
                              type: "datetime-local",
                            },
                          ],
                          onSubmit: (v) =>
                            mutate("post", "/sponsorships", {
                              ...v,
                              hospitalId: data.hospital._id,
                              startDate: new Date(v.startDate).toISOString(),
                              endDate: new Date(v.endDate).toISOString(),
                            }),
                        })
                      }
                    >
                      Request placement
                    </Button>
                  </div>
                  <div className="notice">
                    Every placement is labeled “Sponsored”. Payment cannot
                    purchase a medical urgency designation.
                  </div>
                  <DataTable
                    rows={data.sponsorships}
                    columns={[
                      { title: "Campaign", render: (s) => <b>{s.title}</b> },
                      {
                        title: "Status",
                        render: (s) => <Status value={s.status} />,
                      },
                      {
                        title: "Payment / price",
                        render: (s) => `${s.paymentStatus} · ₹${s.price}`,
                      },
                      { title: "Clicks", render: (s) => s.clicks },
                      {
                        title: "Dates",
                        render: (s) =>
                          `${date(s.startDate)} – ${date(s.endDate)}`,
                      },
                    ]}
                  />
                </div>
              )}
              {tab === "profile" && hospital && (
                <HospitalProfile
                  hospital={data.hospital}
                  mutate={mutate}
                  setModal={setModal}
                />
              )}
              {tab === "notifications" && (
                <div className="dashboard-panel">
                  <h2>A little update for you.</h2>
                  {data.notifications.length ? (
                    data.notifications.map((n) => (
                      <div
                        className={`notification-row ${n.read ? "" : "unread"}`}
                        key={n._id}
                      >
                        <Bell size={19} />
                        <div>
                          <b>{n.title}</b>
                          <p>{n.message}</p>
                          <span className="tiny">{date(n.createdAt)}</span>
                        </div>
                        {!n.read && (
                          <button
                            className="table-button"
                            onClick={() =>
                              mutate(
                                "patch",
                                `/notifications/${n._id}/read`,
                              ).catch((e) => toast(message(e)))
                            }
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <Empty title="You’re all caught up." />
                  )}
                </div>
              )}
              {tab === "settings" && <ProfileSettings />}
              {admin && !["overview", "content"].includes(tab) && (
                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <h2>{nav.find((n) => n[0] === tab)?.[1]}</h2>
                    <Badge kind="demo">Authorized access only</Badge>
                  </div>
                  <QueryState query={lists}>{() => adminTable()}</QueryState>
                </div>
              )}
              {admin && tab === "content" && (
                <ContentStudio mutate={mutate} setModal={setModal} />
              )}
            </>
          )}
        </QueryState>
      </div>
      {modal?.participants ? (
        <ParticipantModal
          drive={modal.participants}
          onClose={() => setModal(null)}
        />
      ) : (
        modal && <ActionForm {...modal} onClose={() => setModal(null)} />
      )}
    </section>
  );
}
function ParticipantModal({ drive, onClose }) {
  const query = useQuery({
    queryKey: ["participants", drive._id],
    queryFn: () => get(`/drives/${drive._id}/registrations`),
  });
  return (
    <Modal title={`Participants · ${drive.title}`} onClose={onClose}>
      <QueryState query={query}>
        {(rows) => (
          <DataTable
            rows={rows}
            columns={[
              { title: "Name", render: (r) => r.donorId?.name },
              { title: "Email", render: (r) => r.donorId?.email },
              { title: "Status", render: (r) => <Status value={r.status} /> },
            ]}
          />
        )}
      </QueryState>
      <p className="tiny muted">Registration does not count as a donation.</p>
    </Modal>
  );
}
function ProfileSettings() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const form = useForm({
    defaultValues: {
      name: user.name,
      phone: user.phone,
      city: user.city,
      bloodGroup: user.bloodGroup || "unknown",
      consent: {
        processing: true,
        booking: !!user.consent?.booking,
        invitations: !!user.consent?.invitations,
        promotions: !!user.consent?.promotions,
      },
      notificationPreferences: {
        drives: user.notificationPreferences?.drives ?? true,
        requests: user.notificationPreferences?.requests ?? true,
        announcements: user.notificationPreferences?.announcements ?? false,
        radius: user.notificationPreferences?.radius || 25,
      },
    },
  });
  return (
    <div className="dashboard-panel settings-panel">
      <h2>Your profile. Your choices.</h2>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await api.patch("/donors/me", {
              ...values,
              notificationPreferences: {
                ...values.notificationPreferences,
                radius: Number(values.notificationPreferences.radius),
              },
            });
            refresh();
            toast("Your choices are saved.");
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        <div className="grid two">
          {[
            ["name", "Full name"],
            ["phone", "Phone number"],
            ["city", "Preferred city"],
          ].map(([k, l]) => (
            <Field label={l} key={k}>
              <input required {...form.register(k)} />
            </Field>
          ))}
          <Field label="Blood group">
            <select {...form.register("bloodGroup")}>
              <option value="unknown">Unknown</option>
              {bloodGroups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
        </div>
        <h3>Contact & consent</h3>
        {[
          ["booking", "Updates about my selected bookings"],
          ["invitations", "Optional future donation invitations"],
          ["promotions", "Optional community news and promotions"],
        ].map(([k, l]) => (
          <label className="check-field" key={k}>
            <input type="checkbox" {...form.register(`consent.${k}`)} />
            <span>{l}</span>
          </label>
        ))}
        <h3>Optional notification preferences</h3>
        {[
          ["drives", "Donation drives"],
          ["requests", "Reviewed requirements"],
          ["announcements", "General announcements"],
        ].map(([k, l]) => (
          <label className="check-field" key={k}>
            <input
              type="checkbox"
              {...form.register(`notificationPreferences.${k}`)}
            />
            <span>{l}</span>
          </label>
        ))}
        <Field label="Preferred notification radius (km)">
          <input
            type="number"
            min={1}
            max={100}
            {...form.register("notificationPreferences.radius")}
          />
        </Field>
        <p className="tiny muted">
          Optional invitations require the invitation consent above. Current
          requirement alerts use your selected city.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save my choices
        </Button>
      </form>
      <div className="privacy-controls">
        <h3>Your data belongs to your story.</h3>
        <p>
          Download your account information or submit a deletion request for
          review.
        </p>
        <div>
          <button
            className="table-button"
            onClick={async () => {
              try {
                const r = await api.get("/donors/me/export", {
                  responseType: "blob",
                });
                const url = URL.createObjectURL(r.data);
                const a = document.createElement("a");
                a.href = url;
                a.download = "lifeline-data.json";
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                toast(message(e));
              }
            }}
          >
            <Download size={16} />
            Export my data
          </button>
          <button
            className="table-button"
            disabled={!!user.deletionRequestedAt}
            onClick={() => setDeleting(true)}
          >
            {user.deletionRequestedAt
              ? "Deletion review requested"
              : "Request account deletion"}
          </button>
        </div>
      </div>
      {deleting && (
        <Modal
          title="Request account deletion?"
          onClose={() => setDeleting(false)}
        >
          <p>
            The coordination team will review your request and any required
            retention obligations. This does not immediately delete your
            account.
          </p>
          <Button
            onClick={async () => {
              try {
                await api.post("/donors/me/deletion");
                refresh();
                toast("Your deletion request has been received.");
                setDeleting(false);
              } catch (e) {
                toast(message(e));
              }
            }}
          >
            Submit my request
          </Button>
        </Modal>
      )}
    </div>
  );
}
function HospitalProfile({ hospital: h, mutate, setModal }) {
  const toast = useToast();
  if (!h)
    return (
      <Empty title="Let’s create your hospital profile.">
        <Link to="/register/hospital">Continue onboarding ↗</Link>
      </Empty>
    );
  return (
    <div className="dashboard-panel">
      <div className="panel-heading">
        <div>
          <h2>{h.name}</h2>
          <Status value={h.verificationStatus} />
        </div>
        <Button
          onClick={() =>
            setModal({
              title: "Edit hospital profile · returns to review",
              initial: {
                ...h,
                latitude: h.location.coordinates[1],
                longitude: h.location.coordinates[0],
              },
              fields: [
                ...[
                  "name",
                  "registrationNumber",
                  "description",
                  "address",
                  "city",
                  "state",
                  "pincode",
                  "contactEmail",
                  "contactPhone",
                  "website",
                  "donationHours",
                ].map((k) => ({
                  key: k,
                  label: label(k.replace(/([A-Z])/g, " $1")),
                  type: k === "description" ? "textarea" : "text",
                  required: k !== "website",
                })),
                {
                  key: "latitude",
                  label: "Latitude",
                  type: "number",
                  step: "any",
                },
                {
                  key: "longitude",
                  label: "Longitude",
                  type: "number",
                  step: "any",
                },
                {
                  key: "acceptingDonors",
                  label: "Accepting donor requests",
                  type: "checkbox",
                },
              ],
              onSubmit: (v) =>
                mutate("patch", `/hospitals/${h._id}`, {
                  ...v,
                  latitude: Number(v.latitude),
                  longitude: Number(v.longitude),
                  facilities: h.facilities,
                  category: h.category,
                }),
            })
          }
        >
          Edit profile
        </Button>
      </div>
      <p>{h.description}</p>
      <p>
        {h.address} · {h.city} · {h.pincode}
      </p>
      <p>
        {h.contactEmail} · {h.contactPhone}
      </p>
      <h3>Private verification documents</h3>
      <Field
        label="Add a hospital photograph"
        hint="PNG or JPEG · 5 MB maximum. Publishing requires profile review."
      >
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const body = new FormData();
            body.append("image", file);
            try {
              await mutate("post", `/hospitals/${h._id}/images`, body);
            } catch (error) {
              toast(message(error));
            }
            e.target.value = "";
          }}
        />
      </Field>
      {h.verificationDocuments.map((d) => (
        <a
          className="document-link"
          href={`/api/hospitals/${h._id}/documents/${d._id}`}
          key={d._id}
        >
          {d.name} ↗
        </a>
      ))}
      <Field
        label="Add a private document"
        hint="PDF, PNG, JPEG · 5 MB maximum"
      >
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const body = new FormData();
            body.append("document", file);
            try {
              await mutate(
                "post",
                `/hospitals/${h._id}/verification-documents`,
                body,
              );
            } catch (error) {
              toast(message(error));
            }
            e.target.value = "";
          }}
        />
      </Field>
      <p className="tiny muted">
        Profile edits return the listing to verification. Documents are
        available only to your authorized account and NGO administrators.
      </p>
    </div>
  );
}
function ContentStudio({ mutate, setModal }) {
  const query = useQuery({
    queryKey: ["content"],
    queryFn: () => get("/content"),
  });
  return (
    <div className="dashboard-panel">
      <div className="panel-heading">
        <div>
          <h2>Write the next chapter.</h2>
          <p className="muted">
            Public content is rendered as text. Publish only verified, consented
            information.
          </p>
        </div>
        <Button
          onClick={() =>
            setModal({
              title: "Publish a consented story",
              fields: [
                { key: "title", label: "Story title" },
                { key: "category", label: "Category" },
                { key: "author", label: "Author" },
                { key: "excerpt", label: "Short excerpt", type: "textarea" },
                { key: "body", label: "Full story", type: "textarea" },
                {
                  key: "consentConfirmed",
                  label:
                    "Appropriate permission to publish has been confirmed.",
                  type: "checkbox",
                },
                {
                  key: "published",
                  label: "Publish this story",
                  type: "checkbox",
                },
              ],
              onSubmit: (v) => mutate("post", "/admin/stories", v),
            })
          }
        >
          New story
        </Button>
      </div>
      <QueryState query={query}>
        {(data) => (
          <div className="content-grid">
            {[
              "about",
              "mission",
              "vision",
              "contact",
              "announcement",
              "faq",
              "team",
              "privacy",
              "terms",
            ].map((key) => {
              const item = data.find((c) => c.key === key);
              return (
                <div key={key}>
                  <span className="tiny uppercase">{key}</span>
                  <h3>{item?.title || "Add your content"}</h3>
                  <p>
                    {item?.body?.slice(0, 130) ||
                      "A thoughtful place to start."}
                  </p>
                  <button
                    className="table-button"
                    onClick={() =>
                      setModal({
                        title: `Edit ${key}`,
                        initial: {
                          title: item?.title || "",
                          body: item?.body || "",
                        },
                        fields: [
                          { key: "title", label: "Title" },
                          { key: "body", label: "Content", type: "textarea" },
                        ],
                        onSubmit: (v) =>
                          mutate("put", `/admin/content/${key}`, v),
                      })
                    }
                  >
                    Edit section ↗
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
