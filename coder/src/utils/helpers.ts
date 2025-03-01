import env from 'dotenv';

export const config = env.config().parsed ?? {};

export function getServeArg(arg: string): string | undefined {
  const argument = process.argv.indexOf(arg);
  if (argument !== -1 && process.argv.length > argument + 1) {
    const argValue = process.argv[argument + 1];
    if (argValue !== undefined) {
      return argValue;
    }
    console.error(`The serve argument ${arg} was not found. Here's the available serve args:\n ${process.argv}`);
  }
}

export function getServePort(): number {
  const pm2PortArg = process.env.NODE_PORT;
  if (pm2PortArg) return parseInt(pm2PortArg, 10);

  let port = 4000; // Default port
  const portArg = parseInt(getServeArg('--port') || '', 10);
  if (!isNaN(portArg)) {
    port = portArg;
  } else {
    console.error(`No "--port" arg supplied when serving. Falling back to default port: ${port}`);
  }
  return port;
}