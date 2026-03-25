// Minimal Express type definitions for local development without @types/express
// This covers the subset of the API used in the project.
declare module "express" {
  export interface Request {
    body?: any;
    params?: Record<string, string>;
    query?: Record<string, string | string[]>;
    headers?: Record<string, string | string[] | undefined>;
    method?: string;
    auth?: { address: string };
  }

  export interface Response {
    status: (code: number) => Response;
    json: (body?: any) => Response;
    send: (body?: any) => Response;
    set: (name: string, value: string) => Response;
    setHeader: (name: string, value: string) => void;
    type: (value: string) => Response;
    sendStatus: (code: number) => Response;
  }

  export interface NextFunction {
    (err?: any): void;
  }

  export interface RequestHandler {
    (req: Request, res: Response, next?: NextFunction): any;
  }

  export interface Router {
    get: (path: string, ...handlers: RequestHandler[]) => Router;
    post: (path: string, ...handlers: RequestHandler[]) => Router;
    put: (path: string, ...handlers: RequestHandler[]) => Router;
    patch: (path: string, ...handlers: RequestHandler[]) => Router;
    delete: (path: string, ...handlers: RequestHandler[]) => Router;
    use: (...handlers: RequestHandler[] | any[]) => Router;
  }

  export interface Express {
    use: (...handlers: RequestHandler[] | any[]) => void;
    get: (path: string, ...handlers: RequestHandler[]) => Express;
    post: (path: string, ...handlers: RequestHandler[]) => Express;
    listen: (port: number, callback?: () => void) => any;
  }

  export interface JsonParser {
    (options?: any): RequestHandler;
  }

  export interface ExpressModule {
    (): Express;
    Router: () => Router;
    json: JsonParser;
  }

  const express: ExpressModule;
  export default express;
}
