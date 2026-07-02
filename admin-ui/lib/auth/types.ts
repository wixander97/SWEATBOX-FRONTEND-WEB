export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthApiSuccess = {
  ok: true;
  token: string;
  raw: unknown;
};

export type AuthApiFailure = {
  ok: false;
  error: string;
  status: number;
};
