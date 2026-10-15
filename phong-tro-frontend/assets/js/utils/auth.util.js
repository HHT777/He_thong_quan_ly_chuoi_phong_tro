export function saveToken(token) {
  localStorage.setItem("trohub_token", token);
}

export function getToken() {
  return localStorage.getItem("trohub_token");
}
