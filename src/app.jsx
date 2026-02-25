import { useEffect, useState, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./App.css";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

/* ===============================
   CONFIG
================================ */

const API_URL = "/chat";
const API_TIMEOUT = 60000;


/* ===============================
   CONSTANTS
================================ */

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#64748b"
];

const formatNumber = (num) => {
  if (!num) return 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(0) + "k";
  return num;
};


/* ===============================
   AXIOS INSTANCE
================================ */

const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json"
  }
});


/* ===============================
   MAIN APP
================================ */

export default function App() {

  /* Dashboard */
  const [kpis, setKpis] = useState(null);

  /* Chat */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  /* Session (Safe UUID) */
  const [sessionId] = useState(() =>
    crypto?.randomUUID?.() || Math.random().toString(36).substring(2)
  );

  const chatEndRef = useRef(null);


  /* ===============================
     Auto Scroll
  ================================ */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  /* ===============================
     Load KPI Data
  ================================ */

  useEffect(() => {

    axios
      .get("/kpis_final.json")
      .then((res) => setKpis(res.data))
      .catch((err) => {
        console.error("KPI load error:", err);
      });

  }, []);


  /* ===============================
     Send Message
  ================================ */

  const sendMessage = async () => {

    if (!input.trim()) return;
    if (loading) return;

    const userMsg = {
      role: "user",
      content: input.trim()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {

      const res = await api.post("", {
        session_id: sessionId,
        message: userMsg.content
      });

      const answer =
        res.data?.answer ||
        res.data?.response ||
        "No response from AI.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer
        }
      ]);

    } catch (err) {

      console.error("Chat API error:", err);

      let errorMsg = "AI service unavailable.";

      if (err.code === "ECONNABORTED") {
        errorMsg = "Request timed out. Try again.";
      }

      if (err.response?.status === 500) {
        errorMsg = "Server error. Backend crashed.";
      }

      if (!err.response) {
        errorMsg = "Network error. Cannot reach server.";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMsg
        }
      ]);

    } finally {
      setLoading(false);
    }
  };


  /* ===============================
     Loading
  ================================ */

  if (!kpis) {
    return <p style={{ color: "white" }}>Loading dashboard...</p>;
  }


  /* ===============================
     Render
  ================================ */

  return (

    <div style={styles.container}>

      {/* ========== DASHBOARD ========== */}

      <div style={styles.dashboard}>

        {/* HEADER */}
        <header style={styles.headerBox}>
          <div style={styles.headerRow}>
            <img
              src="/cw-logo2026.png"
              alt="Company Logo"
              style={styles.logo}
            />
            <div>
              <h1 style={styles.mainTitle}>
                Wind Turbine Intelligence
              </h1>
              <p style={styles.subtitle}>
                Real-time analytics across U.S. wind energy assets
              </p>
            </div>
          </div>
        </header>


        {/* KPI */}
        <section style={styles.kpiRow}>

          <KpiBox title="Turbines Deployed" value={kpis?.meta?.unique_turbines ?? "N/A"} />
          <KpiBox title="Leading State" value={kpis?.top_states?.[0]?.t_state ?? "N/A"} />
          <KpiBox title="Peak Installation Year" value={kpis?.top_years?.at(-1)?.p_year ?? "N/A"} />
          <KpiBox title="Leading Manufacturer" value={kpis?.top_manufacturers?.[0]?.t_manu ?? "N/A"} />

        </section>


        {/* ROW 1 */}
        <section style={styles.row3}>

          <BarBox title="Turbines by State" data={kpis?.top_states ?? []} x="t_state" y="count" />
          <BarBox title="Installations by Year" data={kpis?.top_years ?? []} x="p_year" y="count" />

          <PieBox
            title="Onshore vs Offshore Turbines"
            data={kpis?.onshore_offshore ?? []}
            name="type"
            value="count"
          />

        </section>


        {/* ROW 2 */}
        <section style={styles.row3}>

          <BarBox title="Turbines by Manufacturer" data={kpis?.top_manufacturers ?? []} x="t_manu" y="count" />
          <BarBox title="Turbines by County" data={kpis?.top_counties ?? []} x="t_county" y="count" />

          <BarBox
            title="Installed Capacity (2015–2025)"
            data={kpis?.capacity_2015_2025 ?? []}
            x="p_year"
            y="total_capacity"
            formatY
          />

        </section>


        {/* ROW 3 */}
        <section style={styles.row3}>

          <BarBox title="Operators by Fleet Size" data={kpis?.org_size_distribution ?? []} x="bucket" y="org_count" />

          <TallPieBox
            title="Operator Type Breakdown"
            data={kpis?.org_type_distribution ?? []}
            name="org_type"
            value="count"
          />

          <TallPieBox
            title="Turbines by Country"
            data={kpis?.country_distribution ?? []}
            name="country"
            value="count"
          />

        </section>


        {/* ROW 4 */}
        <section style={styles.row2}>

          <StatePieBox
            title="Turbines by State/Province"
            data={kpis?.state_province_distribution ?? []}
            name="state"
            value="count"
          />

        </section>

      </div>


      {/* ========== CHAT ========== */}

      <div style={styles.chatPanel}>

        <div style={styles.chatHeader}>
          AI Assistant
        </div>


        <div style={styles.chatBody}>

          {messages.map((msg, i) => (

            <div
              key={i}
              style={{
                ...styles.chatMessage,
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#2563eb" : "#1e293b",
                maxWidth: msg.role === "assistant" ? "92%" : "80%"
              }}
            >
              {msg.role === "assistant" ? (
                <div className="md-chat">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>

          ))}


          {loading && (
            <div style={styles.chatMessage}>
              Thinking...
            </div>
          )}

          <div ref={chatEndRef} />

        </div>


        <div style={styles.chatInputRow}>

          <input
            style={styles.chatInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about this dashboard..."
            disabled={loading}
          />

          <button
            style={styles.chatButton}
            onClick={sendMessage}
            disabled={loading}
          >
            Send
          </button>

        </div>

      </div>

    </div>
  );
}


/* ===============================
   COMPONENTS
================================ */

function KpiBox({ title, value }) {
  return (
    <div style={styles.kpiBox}>
      <p style={styles.kpiTitle}>{title}</p>
      <p style={styles.kpiValue}>{value}</p>
    </div>
  );
}


function BarBox({ data, x, y, title, formatY = false }) {

  if (!data.length) return null;

  return (
    <div style={styles.card}>

      <h3 style={styles.cardTitle}>{title}</h3>

      <ResponsiveContainer width="100%" height={240}>

        <BarChart data={data}>

          <XAxis dataKey={x} stroke="#94a3b8" />

          <YAxis
            stroke="#94a3b8"
            tickFormatter={formatY ? formatNumber : undefined}
          />

          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.15)" }}
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#f8fafc", fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: "#f87171" }}
            formatter={(value) => [formatNumber(value), y]}
            labelFormatter={(label) => `${x}: ${label}`}
          />

          <Bar
            dataKey={y}
            fill="#f87171"
            radius={[6, 6, 0, 0]}
          />

        </BarChart>

      </ResponsiveContainer>

    </div>
  );
}


function PieBox({ data, name, value, title }) {

  if (!data.length) return null;

  return (
    <div style={{ ...styles.card, height: 360 }}>

      <h3 style={styles.cardTitle}>{title}</h3>

      <ResponsiveContainer width="100%" height={300}>

        <PieChart>

          <Pie
            data={data}
            dataKey={value}
            nameKey={name}
            cx="50%"
            cy="45%"
            outerRadius={95}
            innerRadius={40}
            label
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip />
          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>
  );
}


function TallPieBox({ data, name, value, title }) {

  if (!data.length) return null;

  return (
    <div style={{ ...styles.card, height: 420 }}>

      <h3 style={styles.cardTitle}>{title}</h3>

      <ResponsiveContainer width="100%" height={360}>

        <PieChart>

          <Pie
            data={data}
            dataKey={value}
            nameKey={name}
            cx="50%"
            cy="42%"
            outerRadius={110}
            innerRadius={50}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip />
          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>
  );
}


function StatePieBox({ data, name, value, title }) {

  if (!data.length) return null;

  return (
    <div style={{ ...styles.card, height: 460 }}>

      <h3 style={styles.cardTitle}>{title}</h3>

      <ResponsiveContainer width="100%" height={400}>

        <PieChart>

          <Pie
            data={data}
            dataKey={value}
            nameKey={name}
            cx="50%"
            cy="42%"
            outerRadius={120}
            innerRadius={50}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip />
          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>
  );
}


/* ===============================
   STYLES
================================ */

/* (UNCHANGED BELOW) */

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    width: "100vw",
    background: "#020617",
    color: "white",
    fontFamily: "Inter, Arial"
  },

  dashboard: {
    flex: 1,
    padding: "24px 28px",
    overflowY: "auto"
  },

  headerBox: {
    marginBottom: 24,
    paddingBottom: 18,
    borderBottom: "1px solid #1e293b"
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 16
  },

  logo: {
    height: 48,
    width: "auto",
    objectFit: "contain"
  },

  mainTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f87171",
    lineHeight: 1.2,
    margin: 0
  },

  subtitle: {
    fontSize: 12,
    color: "#64748b",
    margin: "2px 0 0",
    fontWeight: 400,
    letterSpacing: 0.3
  },

  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 14,
    marginBottom: 20
  },

  kpiBox: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderTop: "2px solid #f87171",
    borderRadius: 8,
    padding: "14px 12px",
    textAlign: "center"
  },

  kpiTitle: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4
  },

  kpiValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9"
  },

  row3: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 14,
    marginBottom: 18
  },

  row2: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 14,
    marginBottom: 18
  },

  card: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "16px 14px"
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 8
  },

  chatPanel: {
    width: 380,
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid #1e293b",
    background: "#0a0f1e"
  },

  chatHeader: {
    padding: "14px 16px",
    fontWeight: "600",
    fontSize: 14,
    borderBottom: "1px solid #1e293b",
    color: "#f87171",
    letterSpacing: 0.3
  },

  chatBody: {
    flex: 1,
    padding: 14,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  chatMessage: {
    padding: "10px 14px",
    borderRadius: 12,
    maxWidth: "80%",
    fontSize: 13,
    lineHeight: 1.5
  },

  chatInputRow: {
    display: "flex",
    borderTop: "1px solid #1e293b",
    background: "#020617"
  },

  chatInput: {
    flex: 1,
    padding: "12px 14px",
    background: "transparent",
    border: "none",
    color: "white",
    outline: "none",
    fontSize: 13
  },

  chatButton: {
    padding: "0 20px",
    background: "#f87171",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    borderRadius: 0
  }
};