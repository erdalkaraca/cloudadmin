import { registerK8sProvider } from './k8s-contributors';

export default function k8sExtensionLoader(): void {
  registerK8sProvider();
}
