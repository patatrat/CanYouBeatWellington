"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const HANDLE = "@CanYouBeat@canyoubeatwellington.nz";

const FediverseHandle = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(HANDLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="block w-fit bg-amber-100 text-amber-900 px-3 py-1.5 rounded text-sm font-mono select-all">
        {HANDLE}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy fediverse handle"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
};

export default FediverseHandle;
