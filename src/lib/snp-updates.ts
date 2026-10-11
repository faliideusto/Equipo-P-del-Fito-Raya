// Browser-side signal sent after each SNP check (every minute, on section change and on
// manual refresh), so client-fetched views such as Competición reload with the rest of the app.
// A manual refresh is "forced": each view then asks the server to bypass its cache for the
// exact query it shows (the server still limits forced reads to one every 30 s per query).
export const SNP_CHECKED_EVENT = "fito:snp-checked";
export const snpCheckEvent = (forced: boolean) => new CustomEvent(SNP_CHECKED_EVENT, { detail: { forced } });
export const isForcedCheck = (event: Event) => event instanceof CustomEvent && event.detail?.forced === true;
export const announceSnpCheck = (forced = false) => window.dispatchEvent(snpCheckEvent(forced));
