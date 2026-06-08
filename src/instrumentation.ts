export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("dns");
    // Open-Meteo only advertises an IPv4 address; undici's default DNS
    // ordering can pick a route that hangs, causing ConnectTimeoutError.
    setDefaultResultOrder("ipv4first");
  }
}
