import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  Heart,
  MapPin,
  ShieldCheck,
  Sparkles,
  MoveDown,
  Plus,
  Users,
  CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";
import { get } from "../services/api";
import {
  Button,
  Eyebrow,
  Heading,
  Reveal,
  HospitalCard,
  RequestCard,
  DriveCard,
  QueryState,
  Empty,
} from "../components/UI";
import { RequestDialog } from "./Public";
export default function Home() {
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState(null);
  const [city, setCity] = useState("Pune");
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => get("/stats") });
  const requests = useQuery({
    queryKey: ["requests", group],
    queryFn: () =>
      get(
        `/blood-requests?limit=3${group ? `&bloodGroup=${encodeURIComponent(group)}` : ""}`,
      ),
  });
  const hospitals = useQuery({
    queryKey: ["hospitals", "home"],
    queryFn: () => get("/hospitals?limit=3"),
  });
  const drives = useQuery({
    queryKey: ["drives", "home"],
    queryFn: () => get("/drives?status=upcoming&limit=3"),
  });
  const stories = useQuery({
    queryKey: ["stories"],
    queryFn: () => get("/stories"),
  });
  return (
    <>
      <section className="hero container">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <Eyebrow>A COMMUNITY WITH HEART</Eyebrow>
          <h1>
            A LITTLE
            <br />
            OF <span className="outlined">YOU.</span>
            <br />A WHOLE
            <br />
            <em>TOMORROW.</em>
            <span className="hero-asterisk" aria-hidden="true">
              ✳
            </span>
          </h1>
          <p>
            Your next act of kindness could be someone’s second chance. Find
            your place to give, and be part of something bigger.
          </p>
          <div className="hero-buttons">
            <Button to="/register/donor">
              I want to donate
              <Heart size={16} />
            </Button>
            <Link className="text-link" to="/hospitals">
              Find a hospital
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="hero-trust">
            <span className="trust-symbol">
              <ShieldCheck size={20} />
            </span>
            <p>
              A safe first step. A human connection.
              <br />
              <b>Hospital screening. Always.</b>
            </p>
          </div>
        </motion.div>
        <motion.div
          className="hero-art"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15 }}
        >
          <div className="art-caption">
            <span>
              SMALL ACTS.
              <br />
              EXTRAORDINARY POSSIBILITIES.
            </span>
            <ArrowUpRight size={23} />
          </div>
          <img
            src="/assets/community.jpg"
            alt="Original illustration of young volunteers supporting a heart-shaped blood drop"
            fetchPriority="high"
          />
          <div className="art-stamp">
            <Heart fill="currentColor" size={24} />
            <span>
              GIVE A LITTLE
              <br />
              <b>CHANGE A LOT</b>
            </span>
          </div>
          <div className="art-note">
            <span className="live-dot" />
            <span>Good people. A shared purpose.</span>
            <Heart size={14} />
          </div>
          <span className="art-footnote">
            AN ORIGINAL ILLUSTRATION OF COMMUNITY & CARE
          </span>
        </motion.div>
        <a href="#impact" className="hero-scroll">
          <MoveDown size={16} />
          <span>SCROLL FOR THE GOOD STUFF</span>
        </a>
      </section>
      <div className="movement-ticker" aria-hidden="true">
        <div>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i}>
              EVERY DROP HAS A STORY <span>✳</span> LET YOURS BEGIN{" "}
              <span>✳</span>
            </span>
          ))}
        </div>
      </div>
      <section className="impact container" id="impact">
        <div className="impact-intro">
          <Eyebrow>GOODNESS, IN NUMBERS</Eyebrow>
          <p>
            Small acts add up.
            <br />
            <strong>That’s the power of us.</strong>
          </p>
          {stats.data?.demo && (
            <span className="demo-label">Demonstration database totals</span>
          )}
        </div>
        <div className="impact-numbers">
          {[
            ["donors", "Registered donors"],
            ["hospitals", "Verified hospitals"],
            ["donations", "Confirmed donations"],
            ["drives", "Completed drives"],
          ].map(([key, label]) => (
            <div key={key}>
              <b>
                {stats.isError
                  ? "—"
                  : (stats.data?.[key]?.toLocaleString("en-IN") ?? "…")}
                <span>↗</span>
              </b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="urgent-section section-space">
        <div className="container">
          <Reveal>
            <Heading
              label="A CHANCE TO MAKE A DIFFERENCE"
              title={
                <>
                  Someone needs
                  <br />
                  <em>you today.</em>
                </>
              }
              description="Current requirements, reviewed by the coordination team. Find the one you can show up for."
            >
              <Link className="text-link light-text" to="/urgent-requests">
                All requirements
                <ArrowUpRight size={18} />
              </Link>
            </Heading>
          </Reveal>
          <div className="request-filters">
            <div className="filter-chips">
              {["", "O-", "O+", "A+", "B+", "AB+"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={group === g ? "active" : ""}
                >
                  {g || "All blood groups"}
                </button>
              ))}
            </div>
            <span>
              <ShieldCheck size={15} />
              Verified requirements only
            </span>
          </div>
          <QueryState query={requests}>
            {(data) =>
              data.length ? (
                <div className="grid three">
                  {data.map((r) => (
                    <Reveal key={r._id}>
                      <RequestCard request={r} onDetails={setSelected} />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <Empty title="No active requirements for this group." />
              )
            }
          </QueryState>
          <p className="section-disclaimer">
            {stats.data?.demo
              ? "Demo requirements are fictitious. They are not medical alerts or live blood-bank inventory."
              : "Requirements reflect reviewed requests, not live blood-bank inventory. On-site eligibility screening is required."}
          </p>
        </div>
      </section>
      <section className="section-space container">
        <Reveal>
          <Heading
            label="01 / FIND YOUR PLACE TO GIVE"
            title={
              <>
                Good things happen
                <br />
                <em>close to home.</em>
              </>
            }
            description="Connect with a verified hospital or blood centre in your city."
          >
            <Link className="text-link" to="/hospitals">
              Explore hospitals
              <ArrowUpRight size={18} />
            </Link>
          </Heading>
        </Reveal>
        <form
          className="home-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/hospitals?city=${encodeURIComponent(city)}`);
          }}
        >
          <MapPin size={22} />
          <div>
            <label htmlFor="home-city">WHERE WOULD YOU LIKE TO GIVE?</label>
            <select
              id="home-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option>Pune</option>
              <option>Mumbai</option>
              <option>Bengaluru</option>
              <option>Delhi</option>
              <option>Chennai</option>
              <option>Hyderabad</option>
            </select>
          </div>
          <Button type="submit">Find my hospital</Button>
        </form>
        <QueryState query={hospitals}>
          {(data) =>
            data.length ? (
              <div className="grid three">
                {data.map((h) => (
                  <Reveal key={h._id}>
                    <HospitalCard hospital={h} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <Empty title="Our hospital community is growing." />
            )
          }
        </QueryState>
      </section>
      <section className="drives-home section-space">
        <div className="container">
          <Reveal>
            <Heading
              label="02 / PUT KINDNESS ON YOUR CALENDAR"
              title={
                <>
                  Show up.
                  <br />
                  <em>Make it matter.</em>
                </>
              }
              description="A little time, a welcoming community, and a shared reason to be there."
            >
              <Link className="text-link" to="/drives">
                Explore all drives
                <ArrowUpRight size={18} />
              </Link>
            </Heading>
          </Reveal>
          <QueryState query={drives}>
            {(data) =>
              data.length ? (
                <div className="grid three">
                  {data.map((d, i) => (
                    <Reveal key={d._id}>
                      <DriveCard drive={d} index={i} />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <Empty title="Your next good day is on its way." />
              )
            }
          </QueryState>
        </div>
      </section>
      <section className="how-section section-space container">
        <Heading
          label="A SIMPLE START"
          title={
            <>
              A few steps.
              <br />
              <em>A meaningful difference.</em>
            </>
          }
        />
        <div className="how-grid">
          {[
            [
              Users,
              "Make yourself known.",
              "Create your donor profile. Tell us where you are and how you’d like to help.",
            ],
            [
              MapPin,
              "Find your people.",
              "Choose a hospital or a community drive. Request a visit that works for you.",
            ],
            [
              Heart,
              "Show up with heart.",
              "Meet the care team, complete on-site screening, and donate if you’re eligible.",
            ],
          ].map(([Icon, title, text], i) => (
            <Reveal key={title}>
              <div className="how-top">
                <span>0{i + 1}</span>
                <Icon size={27} strokeWidth={1.5} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
        <div className="screening-note">
          <ShieldCheck size={17} />
          <span>
            Your wellbeing comes first. A healthcare professional decides
            donation eligibility at the site.
          </span>
          <Link to="/faq">
            Have questions?
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
      <section className="campus-section">
        <div className="container campus-inner">
          <Reveal>
            <Eyebrow>BIG HEARTS. CAMPUS ENERGY.</Eyebrow>
            <h2>
              YOUR
              <br />
              CAMPUS.
              <br />
              <span>YOUR IMPACT.</span>
            </h2>
            <p>
              Bring your friends. Start a conversation. Help organize a drive.
              There’s more than one way to be someone’s reason to hope.
            </p>
            <Button to="/campus" light>
              Find your part in the movement
            </Button>
          </Reveal>
          <div className="campus-art">
            <div className="campus-orbit" />
            <div className="campus-letter">
              GOOD
              <br />
              <span>PEOPLE.</span>
              <br />
              GREAT
              <br />
              <span>PURPOSE.</span>
            </div>
            <Heart
              className="campus-heart"
              size={155}
              strokeWidth={1}
              fill="var(--coral)"
            />
            <div className="campus-sticker">
              IT STARTS
              <br />
              WITH <span>US ↗</span>
            </div>
            <span className="campus-art-caption">
              STUDENTS. VOLUNTEERS. CHANGEMAKERS.
            </span>
          </div>
        </div>
      </section>
      <section className="section-space container">
        <Heading
          label="THE HUMAN SIDE OF GIVING"
          title={
            <>
              Behind every drop,
              <br />
              <em>there’s a story.</em>
            </>
          }
        >
          <Link className="text-link" to="/stories">
            All our stories
            <ArrowUpRight size={18} />
          </Link>
        </Heading>
        <QueryState query={stories}>
          {(data) =>
            data.length ? (
              <div className="story-list">
                {data.slice(0, 3).map((s, i) => (
                  <Link
                    className="story-row"
                    to={`/stories/${s._id}`}
                    key={s._id}
                  >
                    <span className="story-number">0{i + 1}</span>
                    <div>
                      <div className="story-category">
                        {s.category}
                        {s.demo && <span>ILLUSTRATIVE STORY</span>}
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.excerpt}</p>
                    </div>
                    <span className="round-link">
                      <ArrowUpRight size={24} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Real stories take time, trust and permission." />
            )
          }
        </QueryState>
      </section>
      <section className="about-strip container">
        <Eyebrow>MORE THAN DONATIONS. A MOVEMENT.</Eyebrow>
        <p>
          We believe that care is a community effort.
          <br />
          And every one of us <em>has a part to play.</em>
        </p>
        <Button to="/about" secondary>
          Meet the movement
        </Button>
      </section>
      <section className="final-cta">
        <div className="container">
          <span className="cta-heart">
            <Heart size={39} />
          </span>
          <h2>
            SOMEONE’S TOMORROW
            <br />
            COULD BEGIN <em>WITH YOU.</em>
          </h2>
          <p>No grand gestures needed. Just a little heart.</p>
          <Button to="/register/donor" light>
            Let’s make a difference
          </Button>
          <span className="cta-star" aria-hidden="true">
            ✳
          </span>
        </div>
      </section>
      {selected && (
        <RequestDialog request={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
