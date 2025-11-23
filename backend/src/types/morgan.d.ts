// Minimal morgan type declarations used locally without @types/morgan
declare module "morgan" {
  import { RequestHandler } from "express";
  type Format = string | ((tokens: any, req: any, res: any) => string);
  const morgan: (format: Format) => RequestHandler;
  export default morgan;
}
