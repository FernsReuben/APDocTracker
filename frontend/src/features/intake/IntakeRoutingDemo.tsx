import { useState, useEffect } from "react";

type DocStatus = "routed" | "synced";

type DocumentItem = {
  id: number;
  type: string;
  routedAt: string;
  status: DocStatus;
  syncedAt?: string;
};

type EmailThread = {
  id: number;
  clientName: string;
  emailId: string;
  receivedAt: string;
  documents: DocumentItem[];
};

const REQUIRED_DOCS = [
  "Referral Packet",
  "TB Test",
  "Physician Report",
  "Seizure Plan",
  "Releases",
];

const MAX_CLIENTS = 8;

const getPTTimestamp = () =>
  new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const getClientDocStatus = (emails: EmailThread[], clientName: string) => {
  const clientEmails = emails.filter((e) => e.clientName === clientName);

  const hasStarted = clientEmails.length > 0;
  const docs = clientEmails.flatMap((e) => e.documents);

  const receivedTypes = new Set(docs.map((d) => d.type));

  const missing = hasStarted
    ? REQUIRED_DOCS.filter((doc) => !receivedTypes.has(doc))
    : [];

  return { docs, missing, hasStarted };
};

export default function IntakeDashboard() {
  const [emails, setEmails] = useState<EmailThread[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [pendingReminderClient, setPendingReminderClient] = useState<
    string | null
  >(null);

  // 🌙 DARK MODE
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  const [isDark, setIsDark] = useState(getInitialTheme);
  const [manualOverride, setManualOverride] = useState(
    localStorage.getItem("theme") !== null,
  );

  useEffect(() => {
    if (manualOverride) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [manualOverride]);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    setManualOverride(true);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const theme = {
    bg: isDark ? "#0f172a" : "#f4f6f8",
    panel: isDark ? "#111827" : "#ffffff",
    card: isDark ? "#1f2937" : "#fafafa",
    border: isDark ? "#374151" : "#dddddd",
    text: isDark ? "#e5e7eb" : "#111",
    subtext: isDark ? "#9ca3af" : "#555",

    success: isDark ? "#4ade80" : "#16a34a",
    danger: isDark ? "#f87171" : "#dc2626",
    warning: isDark ? "#facc15" : "#ca8a04",

    buttonBg: isDark ? "#374151" : "#e5e7eb",
    buttonText: isDark ? "#e5e7eb" : "#111",
  };

  const buttonStyle = {
    background: theme.buttonBg,
    color: theme.buttonText,
    border: `1px solid ${theme.border}`,
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  };

  const clients = Array.from(new Set(emails.map((e) => e.clientName)));

  const simulateEmail = () => {
    let clientName: string;
    let docsToSend: string[] = [];

    if (pendingReminderClient) {
      clientName = pendingReminderClient;
      const { missing } = getClientDocStatus(emails, clientName);
      docsToSend = missing;
      setPendingReminderClient(null);
    } else {
      const nextClientNumber = clients.length + 1;

      if (nextClientNumber > MAX_CLIENTS) {
        alert("Max clients reached");
        return;
      }

      clientName = `Client ${nextClientNumber}`;

      const count = Math.floor(Math.random() * 5) + 1;

      docsToSend = [...REQUIRED_DOCS]
        .sort(() => 0.5 - Math.random())
        .slice(0, count);
    }

    const newEmail: EmailThread = {
      id: Date.now(),
      clientName,
      emailId: "MSG-" + Math.floor(Math.random() * 10000),
      receivedAt: getPTTimestamp(),
      documents: docsToSend.map((type) => ({
        id: Date.now() + Math.random(),
        type,
        routedAt: getPTTimestamp(),
        status: "routed",
      })),
    };

    setEmails((prev) => [newEmail, ...prev]);
  };

  const sendReminder = (clientName: string) => {
    setPendingReminderClient(clientName);
    alert(`Reminder sent to ${clientName}`);
  };

  const syncDoc = (emailId: number, docId: number) => {
    const timestamp = getPTTimestamp();

    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId
          ? {
              ...email,
              documents: email.documents.map((doc) =>
                doc.id === docId
                  ? { ...doc, status: "synced", syncedAt: timestamp }
                  : doc,
              ),
            }
          : email,
      ),
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        background: theme.bg,
        color: theme.text,
        fontFamily: "sans-serif",
      }}
    >
      {/* 🌙 TOGGLE */}
      <h3 style={{ position: "fixed", top: 0, left: 2250, color: theme.text }}>
        {" "}
        Dark mode toggle{" "}
      </h3>
      <div style={{ position: "fixed", top: 16, right: 16 }}>
        <div
          onClick={toggleDarkMode}
          style={{
            width: 52,
            height: 28,
            borderRadius: 20,
            background: isDark ? theme.success : theme.border,
            display: "flex",
            alignItems: "center",
            padding: 4,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: theme.panel,
              transform: `translateX(${isDark ? "24px" : "0px"})`,
              transition: "0.2s",
            }}
          />
        </div>
      </div>

      {/* LEFT PANEL WRAPPER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: 360, // caps size on large screens
          minWidth: 240, // prevents it from getting too small
          flex: "0 0 25%", // takes ~25% of screen
          borderRight: `1px solid ${theme.border}`,
          background: theme.panel,
        }}
      >
        {/* TITLE ABOVE */}
        <div style={{ padding: 20, borderBottom: `1px solid ${theme.border}` }}>
          <h1 style={{ margin: 0, color: theme.text }}>CaseWorker</h1>
        </div>

        {/* PANEL CONTENT */}
        <div style={{ padding: 20 }}>
          <h2 style={{ marginTop: 24, color: theme.text }}>Clients</h2>

          <button style={buttonStyle} onClick={simulateEmail}>
            + Simulate Email
          </button>

          <div style={{ marginTop: 20 }}>
            {clients.length === 0 && <div>No clients yet</div>}

            {clients.map((client) => {
              const { missing, hasStarted } = getClientDocStatus(
                emails,
                client,
              );

              let status = "Not Started";

              if (hasStarted) {
                status =
                  missing.length === 0
                    ? "Complete"
                    : `In Progress (${missing.length} missing)`;
              }

              return (
                <div
                  key={client}
                  onClick={() => setSelectedClient(client)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 10,
                    cursor: "pointer",
                    background: theme.card,
                  }}
                >
                  <strong>{client}</strong>
                  <div style={{ fontSize: 12, color: theme.subtext }}>
                    {status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      {selectedClient && (
        <div
          style={{
            flex: 1,
            padding: 24,
            height: "100vh", // make it fill viewport height
            overflowY: "auto", // enable vertical scrolling
          }}
        >
          <div
            style={{
              background: theme.panel,
              borderRadius: 12,
              padding: 24,
              minHeight: "100%",
            }}
          >
            <button style={buttonStyle} onClick={() => setSelectedClient(null)}>
              ← Close
            </button>

            <h2 style={{ marginTop: 24, color: theme.text }}>
              {selectedClient}
            </h2>

            {(() => {
              const { docs, missing, hasStarted } = getClientDocStatus(
                emails,
                selectedClient,
              );

              const clientEmails = emails.filter(
                (e) => e.clientName === selectedClient,
              );

              return (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <h3>Status</h3>

                    {!hasStarted ? (
                      <div>Not Started</div>
                    ) : missing.length === 0 ? (
                      <div style={{ color: theme.success }}>✅ Complete</div>
                    ) : (
                      <div style={{ color: theme.danger }}>
                        Missing: {missing.join(", ")}
                      </div>
                    )}

                    {hasStarted && missing.length > 0 && (
                      <button
                        style={buttonStyle}
                        onClick={() => sendReminder(selectedClient)}
                      >
                        🔔 Send Reminder
                      </button>
                    )}
                  </div>

                  <div>
                    <h3>Documents</h3>

                    {docs.map((doc) => {
                      const email = clientEmails.find((e) =>
                        e.documents.includes(doc),
                      )!;

                      return (
                        <div
                          key={doc.id}
                          style={{
                            border: `1px solid ${theme.border}`,
                            padding: 10,
                            marginBottom: 8,
                            borderRadius: 8,
                            background: theme.card,
                          }}
                        >
                          <div>{doc.type}</div>

                          <div style={{ fontSize: 12, color: theme.subtext }}>
                            Routed: {doc.routedAt}
                          </div>

                          <div style={{ fontSize: 12 }}>
                            Status:{" "}
                            <span
                              style={{
                                color:
                                  doc.status === "routed"
                                    ? theme.warning
                                    : theme.success,
                              }}
                            >
                              {doc.status === "routed"
                                ? "🟡 Awaiting Review"
                                : "🟢 Synced"}
                            </span>
                          </div>

                          {doc.status === "routed" && (
                            <button
                              style={buttonStyle}
                              onClick={() => syncDoc(email.id, doc.id)}
                            >
                              Send to CMS
                            </button>
                          )}

                          {doc.syncedAt && (
                            <div
                              style={{
                                fontSize: 12,
                                color: theme.success,
                              }}
                            >
                              ✅ Synced: {doc.syncedAt}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <h3>Email History</h3>

                    {clientEmails.map((email) => (
                      <div
                        key={email.id}
                        style={{
                          border: `1px solid ${theme.border}`,
                          padding: 10,
                          marginBottom: 10,
                          borderRadius: 8,
                          background: theme.card,
                        }}
                      >
                        📩 {email.emailId} —{" "}
                        {email.documents.map((d) => d.type).join(", ")}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
