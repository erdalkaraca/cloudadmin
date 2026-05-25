export default function azureExtensionLoader(): void {
  if (import.meta.env.DEV) {
    console.info('[extension-azure] stub loaded — deferred; see README.');
  }
}
