import { useState } from "react";
import { FileText, Mail, Loader2, Check, X } from "lucide-react";

interface ExportBriefingProps {
  date?: string;
}

export function ExportBriefing({ date }: ExportBriefingProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: boolean; reason: string } | null>(null);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState("");

  const exportDate = date || new Date().toISOString().split("T")[0];

  const handlePDFExport = () => {
    // Open the HTML briefing in a new tab - user can print/save as PDF
    window.open(`/api/intelligence/export/pdf?date=${exportDate}`, "_blank");
  };

  const handleEmailSend = async () => {
    if (!email || !email.includes("@")) return;

    setEmailSending(true);
    setEmailResult(null);

    try {
      const res = await fetch("/api/intelligence/export/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          date: exportDate,
          alwaysSend: true,
        }),
      });

      const data = await res.json();
      setEmailResult(data);
    } catch (err) {
      setEmailResult({ sent: false, reason: "Network error" });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* PDF Export Button */}
      <button
        onClick={handlePDFExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-gray-600 dark:text-neutral-400"
        title="Export as PDF"
      >
        <FileText className="w-3 h-3" />
        PDF
      </button>

      {/* Email Digest Button */}
      <div className="relative">
        <button
          onClick={() => setShowEmailInput(!showEmailInput)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-gray-600 dark:text-neutral-400"
          title="Email digest"
        >
          <Mail className="w-3 h-3" />
          Email
        </button>

        {/* Email Input Dropdown */}
        {showEmailInput && (
          <div className="absolute right-0 top-full mt-2 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg z-10 w-64">
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-neutral-700 bg-transparent text-gray-800 dark:text-neutral-200 placeholder:text-gray-400"
                onKeyDown={(e) => e.key === "Enter" && handleEmailSend()}
              />
              <button
                onClick={handleEmailSend}
                disabled={emailSending || !email}
                className="px-2 py-1 text-xs rounded bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
              >
                {emailSending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            </div>

            {emailResult && (
              <div className={`flex items-center gap-1 text-[10px] ${emailResult.sent ? "text-emerald-500" : "text-red-500"}`}>
                {emailResult.sent ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {emailResult.reason}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
