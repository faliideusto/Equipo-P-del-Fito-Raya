// Browser-side signal sent after each SNP check (every minute, on section change and on
// manual refresh), so client-fetched views such as Competición reload with the rest of the app.
export const SNP_CHECKED_EVENT = "fito:snp-checked";
export const announceSnpCheck = () => window.dispatchEvent(new Event(SNP_CHECKED_EVENT));
