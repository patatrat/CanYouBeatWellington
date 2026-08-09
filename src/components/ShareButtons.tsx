"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const SITE_URL = "https://canyoubeatwellington.nz";
const SHARE_TEXT = `"You can't beat Wellington on a good day." Even on a bad one? Find out: ${SITE_URL}`;
const MASTODON_INSTANCE_KEY = "cybw-mastodon-instance";

// Mastodon has no single domain to share to, unlike Bluesky — every instance
// running v3+ supports the same /share?text= compose-intent URL, so we just
// need to ask once which instance to use and remember it for next time.
const normalizeInstance = (raw: string): string =>
  raw.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

const ShareButtons = () => {
  const [showMastodonInput, setShowMastodonInput] = useState(false);
  const [mastodonInstance, setMastodonInstance] = useState("");
  const [copied, setCopied] = useState(false);

  const shareToBluesky = () => {
    window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(SHARE_TEXT)}`, "_blank", "noopener,noreferrer");
  };

  const openMastodonShare = (instance: string) => {
    window.open(`https://${instance}/share?text=${encodeURIComponent(SHARE_TEXT)}`, "_blank", "noopener,noreferrer");
  };

  const handleMastodonClick = () => {
    const remembered = localStorage.getItem(MASTODON_INSTANCE_KEY);
    if (remembered) {
      openMastodonShare(remembered);
      return;
    }
    setShowMastodonInput(true);
  };

  const handleMastodonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const instance = normalizeInstance(mastodonInstance);
    if (!instance) return;
    localStorage.setItem(MASTODON_INSTANCE_KEY, instance);
    setShowMastodonInput(false);
    setMastodonInstance("");
    openMastodonShare(instance);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(SITE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={shareToBluesky}
        className="px-3 py-1.5 rounded text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
      >
        Share on Bluesky
      </button>

      {showMastodonInput ? (
        <form onSubmit={handleMastodonSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            autoFocus
            value={mastodonInstance}
            onChange={(e) => setMastodonInstance(e.target.value)}
            placeholder="your instance, e.g. mastodon.social"
            className="px-2 py-1.5 rounded text-sm border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 w-56"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
          >
            Go
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={handleMastodonClick}
          className="px-3 py-1.5 rounded text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
        >
          Share on Mastodon
        </button>
      )}

      <button
        type="button"
        onClick={handleCopyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
};

export default ShareButtons;
