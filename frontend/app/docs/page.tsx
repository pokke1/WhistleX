"use client";

import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="app-shell space-y-4">
      <header className="panel space-y-2">
        <h1 className="title">WhistleX Docs</h1>
        <p className="muted">
          WhistleX is a trustless intelligence platform where whistleblowers can monetize sensitive intel and buyers
          (traders, journalists, investigators) can purchase it without counterparty risk.
        </p>
      </header>

      <div className="docs-grid">
        <aside className="panel docs-toc">
          <h2 className="section-title">Contents</h2>
          <nav className="docs-links">
            <a href="#overview">Overview</a>
            <a href="#trust">Trust model</a>
            <a href="#data-paths">Data paths</a>
            <a href="#flow">Protocol flow</a>
            <a href="#roles">Roles</a>
            <a href="#pool">Pool anatomy</a>
            <a href="#contribute">Contributing</a>
            <a href="#unlock">Unlock & decrypt</a>
            <a href="#refunds">Refunds</a>
            <a href="#profiles">Profiles & reputation</a>
            <a href="#polymarket">Polymarket integration</a>
            <a href="#attachments">Attachments</a>
            <a href="#security">Security notes</a>
            <a href="#examples">Usage examples</a>
            <a href="#faq">FAQ</a>
            <a href="#start">Get started</a>
          </nav>
        </aside>

        <div className="docs-body space-y-4">
          <section id="overview" className="panel space-y-2">
            <h2 className="section-title">Overview</h2>
            <p className="muted">
              WhistleX lets you sell the intel itself, not a trade. This avoids market exposure for the whistleblower and lets
              the buyer decide how to act. The platform uses on-chain escrow and TACo key sharding so neither party must trust
              the other.
            </p>
            <p className="muted">
              The key concept is that the intel is encrypted locally, the ciphertext is stored on-chain, and the decryption key
              can only be reconstructed if on-chain conditions are met.
            </p>
          </section>

          <section id="trust" className="panel space-y-2">
            <h2 className="section-title">Trust Model</h2>
            <p className="muted">
              WhistleX is designed so the backend never sees plaintext intel or decryption keys. The only on-chain payload
              is the ciphertext blob, and the only key material is protected by TACo under an on-chain policy. Learn more
              by exploring <Link href="/">Marketplace</Link> pools and the <Link href="/create">Create</Link> flow.
            </p>
            <p className="muted">
              The “blob” is simply the encrypted intel bytes (ciphertext) stored as hex. It is public but useless without
              the symmetric key. TACo shards that key across independent nodes; the key is released only if the on-chain
              policy is satisfied.
            </p>
            <ul className="list-decimal list-inside space-y-2 muted">
              <li>The intel is encrypted locally in the whistleblower’s browser. Only ciphertext is stored and shared.</li>
              <li>The ciphertext is embedded in the pool creation calldata and stored on-chain as bytes.</li>
              <li>The symmetric key is wrapped and sharded by TACo nodes. The key never passes through WhistleX servers.</li>
              <li>The TACo policy is tied to the pool contract and decrypt floor; if unmet, the key cannot be reconstructed.</li>
              <li>Contributors can refund if the pool fails to unlock by the deadline.</li>
            </ul>
          </section>

          <section id="data-paths" className="panel space-y-2">
            <h2 className="section-title">Data Paths</h2>
            <p className="muted">
              On-chain: pool parameters, ciphertext blob, thresholds, and unlock state. Off-chain: pool metadata (title,
              description), attachments, and TACo policy reference. The backend never stores or transmits the decryption key.
              You can view live pools in <Link href="/">Marketplace</Link>.
            </p>
            <p className="muted">
              Buyers download ciphertext from the pool and request a TACo key once eligible. Decryption happens in the browser.
              WhistleX acts as a coordinator and indexer, not a trusted custodian.
            </p>
          </section>

          <section id="flow" className="panel space-y-2">
            <h2 className="section-title">Protocol Flow</h2>
            <ul className="list-decimal list-inside space-y-2 muted">
              <li>Whistleblower encrypts intel locally and creates a pool on-chain with threshold, decrypt floor, and deadline.</li>
              <li>TACo generates a policy bound to the pool contract and shards the symmetric key across nodes.</li>
              <li>Contributors fund the pool. When threshold is met, the pool unlocks.</li>
              <li>Eligible contributors request the key from TACo and decrypt locally.</li>
              <li>If the deadline passes without unlocking, contributors can claim refunds on-chain.</li>
            </ul>
          </section>

          <section id="roles" className="panel space-y-2">
            <h2 className="section-title">Roles</h2>
            <p className="muted"><strong>Whistleblower:</strong> Creates pools, encrypts intel locally, and sets thresholds.</p>
            <p className="muted"><strong>Contributor:</strong> Funds pools, gains decrypt rights when eligible.</p>
            <p className="muted"><strong>Buyer:</strong> Usually a contributor who uses decrypted intel to take action.</p>
          </section>

          <section id="pool" className="panel space-y-2">
            <h2 className="section-title">Pool Anatomy</h2>
            <ul className="list-decimal list-inside space-y-2 muted">
              <li><strong>Threshold:</strong> Total funding required to unlock the pool.</li>
              <li><strong>Decrypt floor:</strong> Minimum individual contribution required to request the TACo key.</li>
              <li><strong>Deadline:</strong> If the pool fails to unlock before this time, refunds are enabled.</li>
              <li><strong>Ciphertext:</strong> Encrypted intel bytes stored on-chain.</li>
              <li><strong>Attachments:</strong> Optional images/PDFs stored off-chain for context.</li>
            </ul>
          </section>

          <section id="contribute" className="panel space-y-2">
            <h2 className="section-title">Contributing</h2>
            <p className="muted">
              Contributors fund pools in USDC on Polygon Amoy. If you contribute less than the decrypt floor, you may help
              unlock the pool but will not be able to decrypt.
            </p>
            <p className="muted">
              Contributions are escrowed by the pool contract until unlock or refund. WhistleX does not custody funds.
            </p>
          </section>

          <section id="unlock" className="panel space-y-2">
            <h2 className="section-title">Unlock & Decrypt</h2>
            <p className="muted">
              Once the threshold is reached, the pool unlocks. Eligible contributors request the TACo key and decrypt locally.
              The whistleblower cannot block this process once the policy is met.
            </p>
          </section>

          <section id="refunds" className="panel space-y-2">
            <h2 className="section-title">Refunds</h2>
            <p className="muted">
              If the pool does not reach threshold by the deadline, contributors can claim refunds on-chain. This enforces
              a fair outcome without relying on the whistleblower.
            </p>
          </section>

          <section id="profiles" className="panel space-y-2">
            <h2 className="section-title">Profiles & Reputation</h2>
            <p className="muted">
              Every whistleblower has a profile page with a marketplace rating derived from community votes and feedback. Buyers can
              evaluate track record, see contributed/created pools, and make informed decisions before funding a pool. Visit a
              <Link href="/profile"> Profile</Link> to explore ratings and history.
            </p>
            <p className="muted">
              Profiles also display Polymarket activity (recent trades, category exposure, and PnL by category). This helps contextualize
              the whistleblower’s market expertise and past performance.
            </p>
          </section>

          <section id="polymarket" className="panel space-y-2">
            <h2 className="section-title">Polymarket Integration</h2>
            <p className="muted">
              The Whistle widget surfaces live Polymarket markets. A whistleblower can click “Whistle” on a market to prefill pool
              metadata and create an intel pool tied to that market. Try it from <Link href="/">Marketplace</Link>.
            </p>
            <p className="muted">
              Pool metadata includes embedded Polymarket references, enabling the marketplace to show tips available for specific markets
              and allow buyers to jump directly to relevant pools.
            </p>
          </section>

          <section id="attachments" className="panel space-y-2">
            <h2 className="section-title">Attachments</h2>
            <p className="muted">
              Pools can include up to three optional attachments (images or PDFs, 5MB max each). Attachments are stored off-chain
              and previewed in the pool card and detail page.
            </p>
          </section>

          <section id="security" className="panel space-y-2">
            <h2 className="section-title">Security Notes</h2>
            <ul className="list-decimal list-inside space-y-2 muted">
              <li>Never share plaintext intel or the symmetric key outside WhistleX.</li>
              <li>The ciphertext is public by design; security relies on the key remaining protected by TACo policy.</li>
              <li>Use a wallet you control; refunds and decrypt requests are on-chain actions.</li>
            </ul>
          </section>

          <section id="examples" className="panel space-y-2">
            <h2 className="section-title">Usage Examples</h2>
            <p className="muted">
              Political transcript: You obtained a draft transcript for an upcoming speech. Trading the market is risky because the
              speech may change. WhistleX lets you sell the transcript itself without market exposure.
            </p>
            <p className="muted">
              Regulatory leak: A regulator is about to issue a notice that affects a sector. You monetize the intel without directly
              trading the market; the buyer decides how to act.
            </p>
            <p className="muted">
              Sports lineup: You have a confirmed lineup change before public release. You sell the intel and the buyer places the trade.
            </p>
          </section>

          <section id="faq" className="panel space-y-2">
            <h2 className="section-title">FAQ</h2>
            <p className="muted">
              <strong>Can I see the intel before contributing?</strong> No. The ciphertext is public, but only eligible contributors can request the TACo key.
            </p>
            <p className="muted">
              <strong>What if the whistleblower disappears?</strong> The ciphertext and policy are already on-chain. If the pool unlocks, TACo can still release the key.
            </p>
            <p className="muted">
              <strong>What if the pool never unlocks?</strong> Contributors can refund. The key cannot be reconstructed if the policy is unmet.
            </p>
          </section>

          <section id="start" className="panel space-y-2">
            <h2 className="section-title">Get Started</h2>
            <p className="muted">
              Create your first pool in <Link href="/create">Create</Link>, or explore open pools in{" "}
              <Link href="/">Marketplace</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
