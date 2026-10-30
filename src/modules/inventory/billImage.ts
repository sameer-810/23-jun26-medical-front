import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Bill photo preparation.
 *
 * Squaring a page up is the one job a human does in a glance and a machine
 * doesn't: guessing it server-side costs an extra OCR call and, worse, forces
 * the two cross-check reads to queue behind the guess. So the pharmacist turns
 * the page here and the server is told not to guess.
 */

/** The longest side of a bill photo sent for reading. */
const MAX_EDGE_PX = 3000;

/** Quarter turns only — the four ways a page can sit in front of a camera. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Our opening guess at which way up the page is.
 *
 * Indian pharma invoices are landscape documents, so a portrait photo of one is
 * almost always the page turned a quarter turn. It's only a guess — and it
 * doesn't have to be right, because the pharmacist sees the result and fixes it
 * with one tap. Cheap heuristic, human backstop.
 */
export function suggestRotation(width?: number, height?: number): Rotation {
  if (!width || !height) return 0;
  return height > width ? 90 : 0;
}

/** One quarter turn. `dir` 1 = clockwise, -1 = anticlockwise. */
export function turn(rotation: Rotation, dir: 1 | -1): Rotation {
  return ((((rotation + dir * 90) % 360) + 360) % 360) as Rotation;
}

/**
 * Renders the picked image exactly as the pharmacist sees it: turned upright,
 * EXIF applied, flattened to JPEG.
 *
 * Two deliberate choices:
 *  1. It renders even at 0°. A camera file can carry an EXIF orientation flag
 *     that we honour in the preview but the OCR model may not — so "it looked
 *     fine on my screen" would upload something else entirely. Baking makes the
 *     bytes we send the pixels they approved, which is the only reason we're
 *     entitled to tell the server to stop guessing.
 *  2. It always renders FROM THE ORIGINAL. Turning the page four times costs
 *     one JPEG re-encode, not four stacked on top of each other.
 */
export async function renderUpright(
  originalUri: string,
  rotation: Rotation,
): Promise<string> {
  const context = ImageManipulator.manipulate(originalUri);
  if (rotation !== 0) context.rotate(rotation);
  let rendered = await context.renderAsync();
  // A 12 MP phone photo is several MB over a shop's connection for no gain: an
  // A4 page at this size still prints batch numbers about 25 pixels tall.
  if (Math.max(rendered.width, rendered.height) > MAX_EDGE_PX) {
    context.resize(
      rendered.width >= rendered.height
        ? { width: MAX_EDGE_PX }
        : { height: MAX_EDGE_PX },
    );
    rendered = await context.renderAsync();
  }
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    // High on purpose: batch numbers are the smallest print on the page and the
    // field we can least afford to soften.
    compress: 0.92,
  });
  return saved.uri;
}
