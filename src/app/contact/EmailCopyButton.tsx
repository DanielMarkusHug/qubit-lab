"use client";

export default function EmailCopyButton() {
  const email = "contact@qubit-lab.ch";

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
        } catch {
          window.location.href = `mailto:${email}`;
        }
      }}
      className="px-5 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-semibold hover:bg-white/10 transition"
    >
      📋 Copy email: {email}
    </button>
  );
}