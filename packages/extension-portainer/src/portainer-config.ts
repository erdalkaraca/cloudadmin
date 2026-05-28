type DockerInspect = {
  Config?: {
    Image?: string;
    Env?: string[];
    Cmd?: string[];
    Entrypoint?: string[] | null;
    ExposedPorts?: Record<string, unknown>;
    WorkingDir?: string;
    User?: string;
    Labels?: Record<string, string>;
  };
  HostConfig?: Record<string, unknown>;
};

function composeHeader(labels: Record<string, string> | undefined): string | undefined {
  if (!labels) return undefined;
  const project = labels['com.docker.compose.project'];
  if (!project) return undefined;
  const service = labels['com.docker.compose.service'];
  const configFiles = labels['com.docker.compose.project.config_files'];
  const lines = ['# Docker Compose'];
  lines.push(`# project: ${project}`);
  if (service) lines.push(`# service: ${service}`);
  if (configFiles) lines.push(`# config_files: ${configFiles}`);
  lines.push('# (compose file content is not stored on the container; shown below: inferred image config)');
  return lines.join('\n');
}

export function dockerfileFromInspect(inspect: unknown): string | undefined {
  const data = inspect as DockerInspect;
  const config = data.Config;
  if (!config?.Image) return undefined;

  const lines: string[] = [];
  const header = composeHeader(config.Labels);
  if (header) lines.push(header, '');

  lines.push(`FROM ${config.Image}`);

  if (config.User) lines.push(`USER ${config.User}`);
  if (config.WorkingDir) lines.push(`WORKDIR ${config.WorkingDir}`);

  for (const port of Object.keys(config.ExposedPorts ?? {})) {
    const num = port.split('/')[0];
    if (num) lines.push(`EXPOSE ${num}`);
  }

  for (const env of config.Env ?? []) {
    if (env.includes('=')) lines.push(`ENV ${env}`);
  }

  const entrypoint = config.Entrypoint?.filter(Boolean);
  if (entrypoint?.length) lines.push(`ENTRYPOINT ${JSON.stringify(entrypoint)}`);

  const cmd = config.Cmd?.filter(Boolean);
  if (cmd?.length) lines.push(`CMD ${JSON.stringify(cmd)}`);

  return `${lines.join('\n')}\n`;
}

export function configJsonFromInspect(inspect: unknown): string {
  const data = inspect as DockerInspect;
  return JSON.stringify(
    {
      Config: data.Config,
      HostConfig: data.HostConfig,
    },
    null,
    2,
  );
}
