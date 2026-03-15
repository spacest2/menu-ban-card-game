const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6) {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}
