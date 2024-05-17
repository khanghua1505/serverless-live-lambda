import {ChildProcessWithoutNullStreams, spawn} from 'child_process';
import os from 'os';
import path from 'path';
import {FunctionDefinitionHandler} from 'serverless';

import {useServerless} from '../../serverless';
import {findAbove, isChild} from '../../utils/fs';
import {execAsync} from '../../utils/process';
import {RuntimeHandler} from '../handlers';
import {useRuntimeServerConfig} from '../server';
import {useRuntimeWorkers} from '../workers';

export const useGoHandler = (): RuntimeHandler => {
  const sls = useServerless();
  const processes = new Map<string, ChildProcessWithoutNullStreams>();
  const sources = new Map<string, string>();

  const handleName = os.platform() === 'win32' ? 'bootstrap.exe' : 'bootstrap';

  return {
    shouldBuild: input => {
      const parent = sources.get(input.functionId);
      if (!parent) {
        return false;
      }
      return isChild(parent, input.file);
    },
    canHandle: input => input.startsWith('go') || input.startsWith('provided'),
    startWorker: async input => {
      const workers = await useRuntimeWorkers();
      const server = await useRuntimeServerConfig();
      const proc = spawn(path.join(input.out, handleName), {
        env: {
          ...process.env,
          ...input.environment,
          IS_LOCAL: 'true',
          AWS_LAMBDA_RUNTIME_API: `localhost:${server.port}/${input.workerId}`,
        },
        cwd: input.out,
      });
      proc.on('exit', () => workers.exited(input.workerId));
      proc.stdout.on('data', (data: Buffer) => {
        workers.stdout(input.workerId, data.toString());
      });
      proc.stderr.on('data', (data: Buffer) => {
        workers.stdout(input.workerId, data.toString());
      });
      processes.set(input.workerId, proc);
    },
    stopWorker: async workerId => {
      const proc = processes.get(workerId);
      if (proc) {
        proc.kill();
        processes.delete(workerId);
      }
    },
    build: async input => {
      const props = input.props as FunctionDefinitionHandler;
      const parsed = path.parse(props.handler);
      const project = await findAbove(parsed.dir || '.', 'go.mod');
      if (!project) {
        return {
          type: 'error',
          errors: ['go.mod not found in current directory'],
        };
      }
      sources.set(input.functionId, project);

      try {
        const src = path.relative(project, props.handler);
        const target = path.join(input.out, handleName);
        const srcPath =
          os.platform() === 'win32' ? src.replaceAll('\\', '\\\\') : src;
        let buildCmd = [
          'go',
          'build',
          '-ldflags "-s -w"',
          `-o "${target}"`,
          `./${srcPath}`,
        ].join(' ');
        const custom = sls.service.custom.go;
        if (custom?.cmd) {
          const cmd = custom.cmd;
          buildCmd = [
            cmd.replaceAll(/GOOS=(\S+)|GOARCH=(\S+)/gi, ''),
            `-o "${target}"`,
            `./${srcPath}`,
          ].join(' ');
        }
        await execAsync(buildCmd, {
          cwd: project,
          env: {
            ...process.env,
          },
        });
        return {
          type: 'success',
          handler: 'bootstrap',
        };
      } catch (err) {
        return {
          type: 'error',
          errors: [String(err)],
        };
      }
    },
  };
};
