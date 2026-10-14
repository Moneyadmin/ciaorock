// Server-only: the admin panel unlock sequence never reaches the browser bundle.
const PASSWORD_ONE = "Ilcriceto771";
const PASSWORD_TWO = "adminmodeactive";
const SECRET_ANSWER = "no";

function norm(value: string) {
  return value.trim().toLowerCase();
}

export function checkAdminSequence(input: {
  passwordOne: string;
  passwordTwo: string;
  answer: string;
}): boolean {
  return (
    input.passwordOne.trim() === PASSWORD_ONE &&
    input.passwordTwo.trim() === PASSWORD_TWO &&
    norm(input.answer) === SECRET_ANSWER
  );
}

export const ADMIN_QUESTION = "lui ohp lui?";
