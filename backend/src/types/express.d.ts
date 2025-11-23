// Minimal Express type definitions for local development without @types/express
// This covers the subset of the API used in the project.
declare module "express" {
  export interface Request {
    body?: any;
    params?: Record<string, string>;
    query?: Record<string, string | string[]>;
  }

  export interface Response {
    status: (code: number) => Response;
    json: (body?: any) => Response;
  }

  export interface NextFunction {
    (err?: any): void;
  }

  export interface RequestHandler {
    (req: Request, res: Response, next?: NextFunction): any;
  }

  export interface Router {
    get: (path: string, handler: RequestHandler) => Router;
    post: (path: string, handler: RequestHandler) => Router;
  }

  export interface Express {
    use: (...handlers: RequestHandler[] | any[]) => void;
    get: (path: string, handler: RequestHandler) => Express;
    post: (path: string, handler: RequestHandler) => Express;
    listen: (port: number, callback?: () => void) => any;
  }

  export interface JsonParser {
    (): RequestHandler;
  }

  export interface ExpressModule {
    (): Express;
    Router: () => Router;
    json: JsonParser;
  }

  const express: ExpressModule;
  export default express;
}
