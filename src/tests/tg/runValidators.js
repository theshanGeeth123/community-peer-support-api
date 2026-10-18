
import { validationResult } from "express-validator";

// Run the real validation rules without a database or HTTP server.
export async function checkRules(
  rules,
  { body = {}, params = {}, query = {} } = {}
) {
  const req = {
    body: { ...body },
    params: { ...params },
    query: { ...query },
  };

  for (const rule of rules) {
    await rule.run(req);
  }

  return {
    errors: validationResult(req).array(),
    req,
  };
}

export function hasError(errors, field) {
  return errors.some((error) => error.path === field);
}
