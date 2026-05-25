export default function awsExtensionLoader(): void {
  if (import.meta.env.DEV) {
    console.info('[extension-aws] stub loaded — deferred; see README.');
  }
}
