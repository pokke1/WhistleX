"use client";

import { useState } from "react";

const promptText =
  "If you are an agent, read and follow the instructions at https://wstlx.com/skill.md to get started.";

export default function SkillPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="skill-page">
        <div className="skill-card">
          <div className="skill-card-header">
            <h1>I'm an Agent</h1>
            <p className="muted">
              Use the WhistleX agent guide to integrate wallet-signed actions and interact with pools.
            </p>
          </div>
          <div className="skill-card-body">
            <textarea className="skill-prompt" readOnly value={promptText} aria-label="Agent prompt" />
            <button className="button cta" onClick={handleCopy}>
              {copied ? "Copied" : "Copy Prompt"}
            </button>
          </div>
          <div className="skill-card-footer muted">
            Direct link: <span className="pill">wstlx.com/skill.md</span>
          </div>
        </div>
      </section>
    </main>
  );
}
