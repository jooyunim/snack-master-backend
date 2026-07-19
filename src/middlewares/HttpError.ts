export class HttpError extends Error {
  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = status;
    if (field) this.field = field;
  }

  statusCode: number;
  field?: string;
}
