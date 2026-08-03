export class BitbucketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BitbucketError";
  }
}

export class BitbucketHttpError extends BitbucketError {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "BitbucketHttpError";
    this.status = status;
    this.body = body;
  }
}
