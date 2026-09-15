"use client";

import { useEffect, useState } from "react";

export default function StorageConsent() {
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Only read localStorage on the client side after mount to avoid hydration mismatch
    const consent = localStorage.getItem("q-sqool-storage-consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("q-sqool-storage-consent", "accepted");
    setShow(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem("q-sqool-storage-consent", "essential-only");
    setShow(false);
  };

  if (!show) return null;

  return (
    <>
      <div 
        role="dialog" 
        aria-label="Storage Consent Banner"
        className="fixed bottom-0 left-0 right-0 z-50 p-4"
      >
        <div className="mx-auto max-w-4xl glass bg-background/95 p-6 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.4)] border border-border flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
          <div className="flex-1 text-sm md:text-base text-foreground">
            <p>
              Q-SQOOL uses essential browser storage to keep you signed in and preserve your learning progress. Optional storage may be used to improve your experience.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
            <button 
              onClick={() => setShowDetails(true)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition px-3 py-2"
            >
              Privacy details
            </button>
            <button 
              onClick={handleEssentialOnly}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition text-foreground"
            >
              Essential only
            </button>
            <button 
              onClick={handleAccept}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-[0_0_15px_rgba(187,143,255,0.3)] hover:shadow-[0_0_25px_rgba(187,143,255,0.5)] transition"
            >
              Accept
            </button>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div 
            role="dialog"
            aria-label="Privacy Details"
            className="w-full max-w-md glass bg-card p-6 rounded-2xl shadow-2xl border border-border"
          >
            <h3 className="text-xl font-bold mb-4 text-foreground">Privacy Details</h3>
            <ul className="space-y-3 text-sm text-muted-foreground list-disc list-inside">
              <li><strong>Authentication Storage:</strong> We securely store a session token to keep you logged in.</li>
              <li><strong>Learning Progress:</strong> Your module progress and XP are saved locally to your device and synced with your account. This data is strictly tied to your authenticated profile.</li>
              <li><strong>No Passwords Saved:</strong> We never save your password in the browser.</li>
              <li><strong>Control:</strong> You may clear this data at any time through your browser settings.</li>
            </ul>
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-[0_0_15px_rgba(187,143,255,0.3)] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
