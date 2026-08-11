import { Platform } from "react-native";

/**
 * Hands a generated file to the user.
 *
 * The export endpoint sits behind the bearer token, so the file arrives as a
 * blob rather than a URL a browser can simply follow — an <a href> to the API
 * would be unauthenticated and 401. On web that blob is turned into a throwaway
 * object URL and clicked; on native there is no download folder to click into,
 * so the caller is told to use the web or desktop app rather than being left
 * with a button that silently does nothing.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next tick — revoking immediately can cancel the download
    // in some browsers before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
