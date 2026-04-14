import { useState, useEffect } from "react";

type DocStatus =
  | "intake_review"
  | "program_review"
  | "intake_meeting"
  | "case_magic";

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

type IncomingDocView = DocumentItem & {
  clientName: string;
  emailId: string;
};

type Role = "intake_manager" | "program_manager";

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
  });

const getClientDocStatus = (emails: EmailThread[], clientName: string) => {
  const clientEmails = emails.filter((e) => e.clientName === clientName);
  const docs = clientEmails.flatMap((e) => e.documents);
  const receivedTypes = new Set(docs.map((d) => d.type));
  const missing = REQUIRED_DOCS.filter((doc) => !receivedTypes.has(doc));
  return { docs, missing };
};

export default function IntakeDashboard() {
  const [emails, setEmails] = useState<EmailThread[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const [role, setRole] = useState<Role>("intake_manager");
  const [reminderQueue, setReminderQueue] = useState<string[]>([]);

  // 🌙 theme (unchanged)
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
    warning: isDark ? "#facc15" : "#ca8a04",
    info: "#60a5fa",
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
    marginTop: 6,
  };

  const clients = Array.from(new Set(emails.map((e) => e.clientName)));

  // -----------------------------
  // DATA OPERATIONS (shared)
  // -----------------------------
  const simulateEmail = () => {
    let clientName: string;
    let docsToSend: string[] = [];

    if (reminderQueue.length > 0) {
      clientName = reminderQueue[0];

      const { missing } = getClientDocStatus(emails, clientName);

      // simulate that client finally responds with missing docs
      docsToSend = missing.length ? missing : [...REQUIRED_DOCS].slice(0, 1); // fallback response

      setReminderQueue((prev) => prev.slice(1));
    } else {
      const nextClientNumber = clients.length + 1;
      if (nextClientNumber > MAX_CLIENTS) return alert("Max clients reached");

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
        status: "intake_review",
      })),
    };

    setEmails((prev) => [newEmail, ...prev]);
  };

  const getIncomingDocuments = (emails: EmailThread[]) => {
    return emails
      .flatMap((email) =>
        email.documents.map((doc) => ({
          ...doc,
          clientName: email.clientName,
          emailId: email.emailId,
        })),
      )
      .sort((a, b) => b.id - a.id);
  };

  const sendReminder = (clientName: string) => {
    setReminderQueue((prev) => [...prev, clientName]);

    alert(`Reminder sent to ${clientName}`);
  };

  const routeToProgramManager = (emailId: number, docId: number) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId
          ? {
              ...email,
              documents: email.documents.map((doc) =>
                doc.id === docId ? { ...doc, status: "program_review" } : doc,
              ),
            }
          : email,
      ),
    );
  };

  const moveToIntakeMeeting = (emailId: number, docId: number) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId
          ? {
              ...email,
              documents: email.documents.map((doc) =>
                doc.id === docId ? { ...doc, status: "intake_meeting" } : doc,
              ),
            }
          : email,
      ),
    );
  };

  const sendToCaseMagic = (emailId: number, docId: number) => {
    const timestamp = getPTTimestamp();

    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId
          ? {
              ...email,
              documents: email.documents.map((doc) =>
                doc.id === docId
                  ? { ...doc, status: "case_magic", syncedAt: timestamp }
                  : doc,
              ),
            }
          : email,
      ),
    );
  };

  // =============================
  // INTake Manager VIEW
  // =============================
  const IntakeManagerView = () => {
    const incomingDocs: IncomingDocView[] = getIncomingDocuments(emails);

    const [activeDocId, setActiveDocId] = useState<number | null>(null);

    const activeDoc =
      activeDocId !== null
        ? incomingDocs.find((d) => d.id === activeDocId) || null
        : null;

    return (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* =========================
          LEFT: CLIENT + DOC LIST
      ========================== */}
        <div
          style={{
            width: 360,
            padding: 20,
            background: theme.panel,
            overflowY: "auto",
          }}
        >
          <h2>📥 Intake Inbox (Amy)</h2>

          <button style={buttonStyle} onClick={simulateEmail}>
            + Simulate Incoming Referral
          </button>

          <div style={{ marginTop: 16 }}>
            {clients.map((client) => {
              const clientDocs = incomingDocs.filter(
                (d) => d.clientName === client,
              );

              const { missing } = getClientDocStatus(emails, client);

              return (
                <div
                  key={client}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    marginBottom: 10,
                    background:
                      selectedClient === client ? theme.card : "transparent",
                  }}
                >
                  {/* CLIENT HEADER */}
                  <div
                    onClick={() => {
                      setSelectedClient(client);
                      setActiveDocId(null);
                    }}
                    style={{
                      padding: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {client}
                  </div>

                  {/* CLIENT BODY */}
                  {selectedClient === client && (
                    <div style={{ padding: "0 12px 12px 12px" }}>
                      <div style={{ fontSize: 12, color: theme.subtext }}>
                        {missing.length === 0
                          ? "Ready for handoff"
                          : `${missing.length} missing`}
                      </div>

                      {/* 🔔 REMINDER */}
                      {missing.length > 0 && (
                        <button
                          style={{
                            ...buttonStyle,
                            marginTop: 10,
                            background: theme.warning,
                            color: "#000",
                          }}
                          onClick={() => sendReminder(client)}
                        >
                          🔔 Send Reminder
                        </button>
                      )}

                      {/* EMAIL THREAD STYLE GROUPING */}
                      <div style={{ marginTop: 10 }}>
                        {Array.from(
                          new Map(clientDocs.map((d) => [d.emailId, d])).keys(),
                        ).map((emailId) => {
                          const threadDocs = clientDocs.filter(
                            (d) => d.emailId === emailId,
                          );

                          const emailMeta = emails.find(
                            (e) => e.emailId === emailId,
                          );

                          return (
                            <div
                              key={emailId}
                              style={{
                                border: `1px solid ${theme.border}`,
                                borderRadius: 8,
                                padding: 8,
                                marginBottom: 8,
                                background: theme.panel,
                              }}
                            >
                              <div
                                style={{ fontSize: 11, color: theme.subtext }}
                              >
                                📧 {emailId}
                              </div>

                              <div
                                style={{ fontSize: 11, color: theme.subtext }}
                              >
                                {emailMeta?.receivedAt}
                              </div>

                              {threadDocs.map((doc) => (
                                <div
                                  key={doc.id}
                                  onClick={() => setActiveDocId(doc.id)}
                                  style={{
                                    padding: 8,
                                    marginTop: 6,
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    border: `1px solid ${theme.border}`,
                                    background:
                                      activeDocId === doc.id
                                        ? theme.card
                                        : "transparent",
                                  }}
                                >
                                  <div
                                    style={{ fontSize: 13, fontWeight: 500 }}
                                  >
                                    {doc.type}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: theme.subtext,
                                    }}
                                  >
                                    {doc.status}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================
          RIGHT: DOCUMENT DETAIL
      ========================== */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {activeDoc ? (
            <>
              <h2>{activeDoc.type}</h2>

              <div style={{ marginTop: 12 }}>
                <p style={{ color: theme.subtext }}>
                  Client: {activeDoc.clientName}
                </p>

                <p style={{ color: theme.subtext }}>
                  Email: {activeDoc.emailId}
                </p>

                <p style={{ color: theme.subtext }}>
                  Received: {activeDoc.routedAt}
                </p>

                <p>
                  Status:{" "}
                  <span style={{ color: theme.warning }}>
                    {activeDoc.status}
                  </span>
                </p>

                <hr style={{ margin: "16px 0", borderColor: theme.border }} />

                <h3>Intake Actions</h3>

                <button
                  style={buttonStyle}
                  onClick={() =>
                    routeToProgramManager(
                      emails.find((e) =>
                        e.documents.some((d) => d.id === activeDoc.id),
                      )!.id,
                      activeDoc.id,
                    )
                  }
                >
                  Send to Program Review
                </button>

                <button
                  style={buttonStyle}
                  onClick={() => setActiveDocId(null)}
                >
                  Clear Selection
                </button>
              </div>
            </>
          ) : selectedClient ? (
            <p style={{ color: theme.subtext }}>
              Select a document to view details
            </p>
          ) : (
            <p style={{ color: theme.subtext }}>
              Select a client to begin intake review
            </p>
          )}
        </div>
      </div>
    );
  };

  // =============================
  // PROGRAM MANAGER VIEW
  // =============================
  const ProgramManagerView = () => {
    if (!selectedClient) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Program Manager</h2>
          <p>Select a client to review intake documents.</p>
        </div>
      );
    }

    const { docs } = getClientDocStatus(emails, selectedClient);
    const clientEmails = emails.filter((e) => e.clientName === selectedClient);

    return (
      <div style={{ padding: 24 }}>
        <h2>{selectedClient} — Program Review</h2>

        {docs.map((doc) => {
          const email = clientEmails.find((e) => e.documents.includes(doc))!;

          return (
            <div
              key={doc.id}
              style={{
                border: `1px solid ${theme.border}`,
                padding: 12,
                marginBottom: 10,
                borderRadius: 8,
                background: theme.card,
              }}
            >
              <div>{doc.type}</div>

              <div style={{ fontSize: 12, color: theme.subtext }}>
                Routed: {doc.routedAt}
              </div>

              <div style={{ fontSize: 12 }}>Status: {doc.status}</div>

              {doc.status === "intake_review" && (
                <button
                  style={buttonStyle}
                  onClick={() => routeToProgramManager(email.id, doc.id)}
                >
                  Send to Program Review
                </button>
              )}

              {doc.status === "program_review" && (
                <button
                  style={buttonStyle}
                  onClick={() => moveToIntakeMeeting(email.id, doc.id)}
                >
                  Schedule Intake Meeting
                </button>
              )}

              {doc.status === "intake_meeting" && (
                <button
                  style={buttonStyle}
                  onClick={() => sendToCaseMagic(email.id, doc.id)}
                >
                  Complete → Case Magic
                </button>
              )}

              {doc.syncedAt && (
                <div style={{ color: theme.success, fontSize: 12 }}>
                  ✅ Synced {doc.syncedAt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // -----------------------------
  // MAIN UI
  // -----------------------------
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: theme.bg,
        color: theme.text,
        fontFamily: "sans-serif",
      }}
    >
      {/* Role Switch */}
      <div style={{ padding: 10, display: "flex", gap: 10 }}>
        <button style={buttonStyle} onClick={() => setRole("intake_manager")}>
          Intake Manager
        </button>
        <button style={buttonStyle} onClick={() => setRole("program_manager")}>
          Program Manager
        </button>

        <div style={{ marginLeft: "auto" }}>
          <button style={buttonStyle} onClick={toggleDarkMode}>
            🌙 Theme
          </button>
        </div>
      </div>

      {/* Views */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {role === "intake_manager" ? (
          <IntakeManagerView />
        ) : (
          <ProgramManagerView />
        )}
      </div>
    </div>
  );
}
