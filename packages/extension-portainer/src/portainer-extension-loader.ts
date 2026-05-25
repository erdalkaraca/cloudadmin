import { registerPortainerProvider } from './portainer-contributors';

export default function portainerExtensionLoader(): void {
  registerPortainerProvider();
}
