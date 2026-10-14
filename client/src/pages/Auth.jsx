import { useState, useEffect } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Heart,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  registerSchema,
  loginSchema,
  hospitalSchema,
  bloodGroups,
} from "../../../shared/validation";
import { useAuth, useToast } from "../services/context";
import { api, message } from "../services/api";
import { dashboardPath } from "../components/Layout";
import { Button, Field, Eyebrow, Badge, Empty } from "../components/UI";
function AuthShell({ title, subtitle, children }) {
  return (
    <section className="auth-layout container">
      <aside className="auth-story">
        <Eyebrow>EVERY DROP HAS A STORY</Eyebrow>
        <h1>
          A LITTLE
          <br />
          OF YOU.
          <br />
          <em>
            A WORLD
            <br />
            OF GOOD.
          </em>
        </h1>
        <img
          src="/assets/community.jpg"
          alt="Illustrated volunteers sharing a symbol of care"
        />
        <div>
          <Heart size={18} />
          <span>There’s a place for you in this story.</span>
        </div>
      </aside>
      <div className="auth-main">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} />
          Back to the movement
        </Link>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {children}
      </div>
    </section>
  );
}
function PasswordInput({
  registration,
  autoComplete = "new-password",
  ...props
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-input">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        {...registration}
        {...props}
      />
      <button
        type="button"
        className="icon-button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const form = useForm({ resolver: zodResolver(loginSchema) });
  const next = params.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : null;
  useEffect(() => {
    if (user)
      navigate(destination || dashboardPath(user.role), { replace: true });
  }, [user]);
  return (
    <AuthShell
      title="Good to have you back."
      subtitle="Your next act of kindness is waiting."
    >
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            const result = await login(values);
            toast("Welcome back. Let’s make a little good.");
            navigate(destination || dashboardPath(result.data.role));
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        <Field label="Email address" error={form.formState.errors.email}>
          <input
            autoComplete="email"
            type="email"
            {...form.register("email")}
          />
        </Field>
        <Field label="Password" error={form.formState.errors.password}>
          <PasswordInput
            autoComplete="current-password"
            registration={form.register("password")}
          />
        </Field>
        <Link className="forgot-link" to="/forgot-password">
          Forgot your password?
        </Link>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing you in…" : "Let’s get you in"}
        </Button>
      </form>
      <p className="auth-switch">
        New to the movement?{" "}
        <Link to="/register/donor">Create a donor profile ↗</Link>
      </p>
      <div className="auth-partner">
        <Building2 size={20} />
        <div>
          <b>Here with a hospital?</b>
          <Link to="/register/hospital">Become a partner ↗</Link>
        </div>
      </div>
    </AuthShell>
  );
}
function Register() {
  const { register: registerAccount, user, demo } = useAuth();
  const hospitalRole = useLocation().pathname === "/register/hospital";
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [devLink, setDevLink] = useState("");
  const [created, setCreated] = useState(false);
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      role: hospitalRole ? "hospital" : "donor",
      bloodGroup: "unknown",
      previousDonation: false,
      consent: {
        processing: false,
        booking: true,
        invitations: false,
        promotions: false,
      },
    },
  });
  const {
    register,
    formState: { errors },
    trigger,
  } = form;
  const fields = [
    ["name", "email", "phone", "dateOfBirth"],
    ["city", "state", "pincode", "bloodGroup", "college"],
    ["password", "consent"],
  ];
  if (hospitalRole && (user?.role === "hospital" || created))
    return <HospitalOnboarding developmentLink={devLink} />;
  return (
    <AuthShell
      title={
        hospitalRole
          ? "Care goes further, together."
          : "Your story starts here."
      }
      subtitle={
        hospitalRole
          ? "Create an authorized hospital administrator account, then submit the hospital profile."
          : "A few details. A meaningful first step."
      }
    >
      <div className="form-progress">
        {["About you", "Your community", "Your choices"].map((label, i) => (
          <div key={label} className={i <= step ? "active" : ""}>
            <span>
              {i < step ? <Check size={13} /> : String(i + 1).padStart(2, "0")}
            </span>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            const response = await registerAccount(values);
            setDevLink(response.meta?.developmentLink || "");
            setCreated(true);
            if (!hospitalRole)
              navigate("/dashboard", {
                state: { developmentLink: response.meta?.developmentLink },
              });
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        {step === 0 && (
          <>
            <Field label="Full name" error={errors.name}>
              <input autoComplete="name" {...register("name")} />
            </Field>
            <Field label="Email address" error={errors.email}>
              <input autoComplete="email" type="email" {...register("email")} />
            </Field>
            <div className="grid two">
              <Field label="Phone number" error={errors.phone}>
                <input type="tel" autoComplete="tel" {...register("phone")} />
              </Field>
              <Field
                label="Date of birth"
                error={errors.dateOfBirth}
                hint="Booking age is checked on the server."
              >
                <input
                  type="date"
                  max={new Date().toLocaleDateString("en-CA")}
                  {...register("dateOfBirth")}
                />
              </Field>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="grid two">
              <Field label="City" error={errors.city}>
                <input autoComplete="address-level2" {...register("city")} />
              </Field>
              <Field label="State" error={errors.state}>
                <input autoComplete="address-level1" {...register("state")} />
              </Field>
              <Field label="Pincode" error={errors.pincode}>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="postal-code"
                  {...register("pincode")}
                />
              </Field>
              <Field label="Blood group (optional)" error={errors.bloodGroup}>
                <select {...register("bloodGroup")}>
                  <option value="unknown">I’m not sure yet</option>
                  {bloodGroups.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="College / institution (optional)"
              error={errors.college}
            >
              <input {...register("college")} />
            </Field>
            <label className="check-field">
              <input type="checkbox" {...register("previousDonation")} />
              <span>I’ve donated blood before.</span>
            </label>
            {form.watch("previousDonation") && (
              <Field label="Last donation date (optional)">
                <input
                  type="date"
                  max={new Date().toLocaleDateString("en-CA")}
                  {...register("lastDonationDate")}
                />
              </Field>
            )}
            <div className="notice">
              <ShieldCheck size={18} />
              <p>
                Your online profile doesn’t determine medical eligibility. A
                care professional will screen you at the donation site.
              </p>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <Field
              label="Create a password"
              error={errors.password}
              hint="At least 10 characters. Make it something only you know."
            >
              <PasswordInput registration={register("password")} />
            </Field>
            <h4>Your information. Your choices.</h4>
            {[
              [
                "processing",
                "I consent to processing my registration information. (required)",
              ],
              ["booking", "Contact me about appointments and drives I choose."],
              ["invitations", "Send me optional future donation invitations."],
              ["promotions", "Send me optional community news and promotions."],
            ].map(([key, label]) => (
              <label className="check-field" key={key}>
                <input type="checkbox" {...register(`consent.${key}`)} />
                <span>{label}</span>
              </label>
            ))}
            {errors.consent?.processing && (
              <p className="field-error">{errors.consent.processing.message}</p>
            )}
            <p className="tiny muted">
              Read our <Link to="/privacy">privacy policy</Link> and{" "}
              <Link to="/terms">terms of use</Link>. You can change optional
              choices any time.
            </p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {step > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={15} />
              Back
            </button>
          )}
          {step < 2 ? (
            <Button
              key="continue"
              type="button"
              onClick={async () => {
                if (await trigger(fields[step])) setStep(step + 1);
              }}
            >
              Keep going
            </Button>
          ) : (
            <Button
              key="submit"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Creating your account…"
                : hospitalRole
                  ? "Create administrator account"
                  : "Join the movement"}
            </Button>
          )}
        </div>
      </form>
      <p className="auth-switch">
        Already part of the community? <Link to="/login">Log in ↗</Link>
      </p>
    </AuthShell>
  );
}
function HospitalOnboarding({ developmentLink }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [hospitalId, setHospitalId] = useState(null);
  const form = useForm({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      category: "hospital",
      name: "",
      registrationNumber: "",
      description: "",
      address: "",
      city: user?.city || "",
      state: user?.state || "",
      pincode: user?.pincode || "",
      contactEmail: user?.email || "",
      contactPhone: user?.phone || "",
      website: "",
      donationHours: "",
      facilities: ["Donation counselling"],
      acceptingDonors: true,
    },
  });
  return (
    <AuthShell
      title="Let’s get to know your hospital."
      subtitle="Profiles remain private until the NGO coordination team reviews them."
    >
      {developmentLink && (
        <div className="notice">
          Local email preview:{" "}
          <a href={developmentLink}>verify your administrator email ↗</a>
        </div>
      )}
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            let id = hospitalId;
            if (!id) {
              const response = await api.post("/hospitals", values);
              id = response.data.data._id;
              setHospitalId(id);
            }
            if (!file)
              throw new Error(
                "Please attach a verification document. Your profile has been saved; you can retry.",
              );
            const body = new FormData();
            body.append("document", file);
            await api.post(`/hospitals/${id}/verification-documents`, body);
            navigate("/hospital/dashboard");
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        <div className="grid two">
          {[
            ["name", "Hospital / blood centre name"],
            ["registrationNumber", "Registration / license number"],
            ["city", "City"],
            ["state", "State"],
            ["pincode", "Pincode"],
            ["contactEmail", "Official email"],
            ["contactPhone", "Official phone"],
            ["website", "Website (optional)"],
            ["latitude", "Map latitude"],
            ["longitude", "Map longitude"],
          ].map(([key, label]) => (
            <Field key={key} label={label} error={form.formState.errors[key]}>
              <input
                type={
                  ["latitude", "longitude"].includes(key)
                    ? "number"
                    : key === "contactEmail"
                      ? "email"
                      : "text"
                }
                step="any"
                {...form.register(key)}
              />
            </Field>
          ))}
        </div>
        <Field label="Hospital category">
          <select {...form.register("category")}>
            <option value="hospital">Hospital</option>
            <option value="blood_bank">Blood centre</option>
            <option value="clinic">Clinic</option>
          </select>
        </Field>
        <Field label="Full address" error={form.formState.errors.address}>
          <input {...form.register("address")} />
        </Field>
        <Field
          label="About the donation facility"
          error={form.formState.errors.description}
        >
          <textarea rows={3} {...form.register("description")} />
        </Field>
        <Field
          label="Donation hours"
          error={form.formState.errors.donationHours}
        >
          <input
            placeholder="e.g. Monday–Friday, 9 AM–3 PM"
            {...form.register("donationHours")}
          />
        </Field>
        <Field
          label="Verification document"
          hint="Private PDF, PNG or JPEG, maximum 5 MB. NGO administrators review this file."
        >
          <input
            required
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Submitting privately…"
            : "Submit for verification"}
        </Button>
      </form>
    </AuthShell>
  );
}
function Recovery() {
  const path = useLocation().pathname;
  const [params] = useSearchParams();
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm();
  const { refresh, user, emailVerificationRequired } = useAuth();
  const verify = path === "/verify-email";
  const reset = path === "/reset-password";
  if (verify && !emailVerificationRequired)
    return (
      <AuthShell
        title="No email check needed."
        subtitle="You can use your account and request a donation visit without verifying your email."
      >
        <Button to={user ? dashboardPath(user.role) : "/login"}>
          {user ? "Go to my dashboard" : "Sign in to continue"}
        </Button>
      </AuthShell>
    );
  async function submit(values) {
    setBusy(true);
    setError("");
    try {
      const response = await api.post(
        verify
          ? "/auth/verify-email"
          : reset
            ? "/auth/reset-password"
            : "/auth/forgot-password",
        verify
          ? { token: params.get("token") }
          : reset
            ? { token: params.get("token"), password: values.password }
            : values,
      );
      setDone(response.data.data.message);
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      title={verify ? "One small check." : "A fresh start."}
      subtitle={
        verify
          ? "Confirm your email to participate in donation opportunities."
          : "Let’s help you get back to the good things."
      }
    >
      {done ? (
        <>
          <Empty
            title={verify ? "You’re all set." : "Your next step is ready."}
          >
            {done}
          </Empty>
          <Button to={verify ? "/dashboard" : "/login"}>
            {verify ? "Go to my dashboard" : "Back to sign in"}
          </Button>
        </>
      ) : (
        <form onSubmit={form.handleSubmit(submit)}>
          {verify ? (
            <p>
              Use the button below to verify the email linked to this unique
              confirmation link.
            </p>
          ) : reset ? (
            <Field label="Your new password">
              <PasswordInput
                registration={form.register("password", {
                  required: true,
                  minLength: 10,
                })}
              />
            </Field>
          ) : (
            <Field label="Your account email">
              <input required type="email" {...form.register("email")} />
            </Field>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? "One moment…"
              : verify
                ? "Verify my email"
                : reset
                  ? "Update my password"
                  : "Send a reset link"}
          </Button>
          {!verify && !reset && (
            <p className="tiny muted">
              Email delivery requires a configured SMTP service. In local
              development, messages are stored privately in the EmailOutbox
              collection.
            </p>
          )}
        </form>
      )}
    </AuthShell>
  );
}
export default function Auth() {
  const path = useLocation().pathname;
  if (path === "/login") return <Login />;
  if (path.includes("password") || path === "/verify-email")
    return <Recovery />;
  return <Register />;
}
