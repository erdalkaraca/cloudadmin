import { registerPortainerProvider } from './portainer-contributors';
import { registerPortainerExecTerminalProfile } from './portainer-terminal-profile';

export default function portainerExtensionLoader(): void {
  registerPortainerExecTerminalProfile();
  registerPortainerProvider();
}
